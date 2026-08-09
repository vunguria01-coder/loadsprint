import fs from "fs";
import path from "path";
import crypto from "crypto";
import { LOAD_SOURCE_PROVIDERS, type LoadSourceProvider } from "@/lib/load-source-connections";

// Admin-managed, persisted rights registry — replaces a hardcoded in-memory
// table specifically so a provider can never be turned on by editing code
// or by a dispatcher saving credentials. The only way any of this ever
// stops being fully restrictive is an admin explicitly writing an
// "approved" record through setPolicyRecord() (see app/api/admin/
// load-provider-policy/route.ts), after reading that provider's actual
// terms — never guessed from a marketing page.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const POLICY_FILE = path.join(DATA_DIR, "load-provider-policy.json");
const AUDIT_FILE = path.join(DATA_DIR, "load-provider-policy-audit.json");

export type PolicyStatus = "pending" | "approved" | "revoked";

// The full admin record. agreementRef is a reference number only — never
// the agreement's text, and never a secret.
export type PolicyRecord = {
  status: PolicyStatus;
  agreementRef: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  allowFetch: boolean;
  allowStore: boolean;
  allowDisplay: boolean;
  cacheTtlSeconds: number;
  refreshIntervalSeconds: number;
  allowBrokerContactStorage: boolean;
  updatedAt: string;
  updatedBy: string;
};

const PENDING_DEFAULT: PolicyRecord = {
  status: "pending",
  agreementRef: null,
  approvedAt: null,
  expiresAt: null,
  allowFetch: false,
  allowStore: false,
  allowDisplay: false,
  cacheTtlSeconds: 0,
  refreshIntervalSeconds: 0,
  allowBrokerContactStorage: false,
  updatedAt: new Date(0).toISOString(),
  updatedBy: "system",
};

// What runtime code (lib/load-search.ts, lib/load-ingest.ts, lib/load-
// ingest-job.ts, lib/load-cache.ts) actually consumes — unchanged shape, so
// none of those call sites needed to change when this became a persisted
// admin registry instead of a hardcoded table.
export type LoadProviderPolicy = {
  allowFetch: boolean;
  allowStore: boolean;
  allowDisplay: boolean;
  cacheTtlSeconds: number;
  allowBrokerContactStorage: boolean;
  refreshIntervalSeconds: number;
};

const DENY_ALL: LoadProviderPolicy = {
  allowFetch: false,
  allowStore: false,
  allowDisplay: false,
  cacheTtlSeconds: 0,
  allowBrokerContactStorage: false,
  refreshIntervalSeconds: 0,
};

type Store = Partial<Record<LoadSourceProvider, PolicyRecord>>;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(POLICY_FILE)) fs.writeFileSync(POLICY_FILE, "{}", "utf8");
  if (!fs.existsSync(AUDIT_FILE)) fs.writeFileSync(AUDIT_FILE, "[]", "utf8");
}

function readAll(): Store {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(POLICY_FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeAll(s: Store) {
  ensure();
  fs.writeFileSync(POLICY_FILE, JSON.stringify(s, null, 2), "utf8");
}

// Admin read — the full record, defaulting to an untouched "pending" shape
// for a provider nothing has ever been set for. A corrupted store (readAll
// already fails safe to {}) resolves the same way: pending, fully denied.
export function getPolicyRecord(provider: LoadSourceProvider): PolicyRecord {
  return readAll()[provider] || { ...PENDING_DEFAULT };
}

export function listPolicyRecords(): { provider: LoadSourceProvider; record: PolicyRecord }[] {
  return LOAD_SOURCE_PROVIDERS.map((provider) => ({ provider, record: getPolicyRecord(provider) }));
}

export type PolicyInput = {
  status: PolicyStatus;
  agreementRef?: string | null;
  approvedAt?: string | null;
  expiresAt?: string | null;
  allowFetch: boolean;
  allowStore: boolean;
  allowDisplay: boolean;
  cacheTtlSeconds: number;
  refreshIntervalSeconds: number;
  allowBrokerContactStorage: boolean;
};

export type PolicyValidationError = { field: string; message: string };

// The admin route validates with this before ever calling setPolicyRecord;
// setPolicyRecord re-validates too, so there's no way to persist an invalid
// record even by calling it directly.
export function validatePolicyInput(input: PolicyInput): PolicyValidationError[] {
  const errors: PolicyValidationError[] = [];
  if (input.status === "approved") {
    if (!(input.cacheTtlSeconds > 0)) {
      errors.push({ field: "cacheTtlSeconds", message: "Approved policies need a positive cache TTL." });
    }
    if (!(input.refreshIntervalSeconds > 0)) {
      errors.push({ field: "refreshIntervalSeconds", message: "Approved policies need a positive refresh interval." });
    }
  }
  if (input.allowBrokerContactStorage && !input.allowStore) {
    errors.push({ field: "allowBrokerContactStorage", message: "Broker contact storage requires allowStore." });
  }
  return errors;
}

export type AuditEntry = {
  id: string;
  provider: LoadSourceProvider;
  adminId: string;
  at: string;
  before: PolicyRecord;
  after: PolicyRecord;
};

function appendAudit(provider: LoadSourceProvider, adminId: string, before: PolicyRecord, after: PolicyRecord) {
  ensure();
  let log: AuditEntry[] = [];
  try {
    log = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8")) as AuditEntry[];
  } catch {
    log = [];
  }
  log.push({ id: crypto.randomUUID(), provider, adminId, at: new Date().toISOString(), before, after });
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(log, null, 2), "utf8");
}

export function listAuditLog(provider?: LoadSourceProvider): AuditEntry[] {
  ensure();
  try {
    const log = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8")) as AuditEntry[];
    return provider ? log.filter((e) => e.provider === provider) : log;
  } catch {
    return [];
  }
}

// Persists a validated record and appends a who/when/before/after audit
// entry — never the agreement text or a secret, since the record itself
// never holds either. Throws on invalid input (see validatePolicyInput);
// the admin route validates first, this is the backstop for any other
// caller.
export function setPolicyRecord(provider: LoadSourceProvider, input: PolicyInput, adminId: string): PolicyRecord {
  const errors = validatePolicyInput(input);
  if (errors.length > 0) {
    throw new Error("Invalid policy: " + errors.map((e) => `${e.field}: ${e.message}`).join("; "));
  }
  const before = getPolicyRecord(provider);
  const after: PolicyRecord = {
    status: input.status,
    agreementRef: input.agreementRef ?? null,
    approvedAt: input.approvedAt ?? null,
    expiresAt: input.expiresAt ?? null,
    allowFetch: input.allowFetch,
    allowStore: input.allowStore,
    allowDisplay: input.allowDisplay,
    cacheTtlSeconds: input.cacheTtlSeconds,
    refreshIntervalSeconds: input.refreshIntervalSeconds,
    allowBrokerContactStorage: input.allowBrokerContactStorage,
    updatedAt: new Date().toISOString(),
    updatedBy: adminId,
  };
  const s = readAll();
  s[provider] = after;
  writeAll(s);
  appendAudit(provider, adminId, before, after);
  return after;
}

// What every runtime consumer actually calls. A missing record, a
// corrupted store, a status other than "approved", or an expired
// expiresAt all resolve exactly the same way: full deny. There is no path
// through this function that can turn a provider on except a current,
// explicitly-approved admin record.
export function getProviderPolicy(provider: LoadSourceProvider): LoadProviderPolicy {
  const record = getPolicyRecord(provider);
  if (record.status !== "approved") return { ...DENY_ALL };
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) return { ...DENY_ALL };
  return {
    allowFetch: record.allowFetch,
    allowStore: record.allowStore,
    allowDisplay: record.allowDisplay,
    cacheTtlSeconds: record.cacheTtlSeconds,
    refreshIntervalSeconds: record.refreshIntervalSeconds,
    allowBrokerContactStorage: record.allowBrokerContactStorage,
  };
}

// Shared by the readiness route and tests, so both agree on exactly one
// definition of "ready" — every gate at once, nothing implied.
export function computeReadiness(
  credentials: "saved" | "missing",
  writtenPermission: "pending" | "approved",
  adapterActive: boolean,
  policy: LoadProviderPolicy
): "ready" | "pending_approval" {
  return credentials === "saved" && writtenPermission === "approved" && adapterActive && policy.allowDisplay
    ? "ready"
    : "pending_approval";
}
