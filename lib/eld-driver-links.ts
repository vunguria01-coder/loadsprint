import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getEldAdapter } from "@/lib/eld-adapters";
import { withEldConnectionLock } from "@/lib/eld-connections-lock";
import { deleteEldSnapshotsForDriver } from "@/lib/eld-snapshots";
import { getEldConnectionGate, checkEldConnectionGate } from "@/lib/eld-connections";
import type { EldAdapter, EldProvider } from "@/lib/eld-adapters";

// Tenant-scoped link between one LoadSprint driver and one ELD provider's
// driver record — company-wide (ownerId), same pooling as lib/eld-
// connections.ts, since the ELD connection itself is per-company. Roster
// membership (which LoadSprint driver a given dispatcher may even see) is
// checked separately, per-dispatcher, by the API route — see
// app/api/eld-driver-links/route.ts.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const LINKS_FILE = path.join(DATA_DIR, "eld-driver-links.json");

export type EldDriverLink = {
  provider: EldProvider;
  externalDriverId: string;
  externalVehicleId: string | null;
  vehicleName: string | null;
  linkedAt: string;
  linkedBy: string;
};

// ownerId -> driver email (lowercased) -> link. A driver key holds at most
// one entry, which is what "one active link per LoadSprint driver" means
// structurally — linking again replaces it rather than adding a second one.
type Store = Record<string, Record<string, EldDriverLink>>;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LINKS_FILE)) fs.writeFileSync(LINKS_FILE, "{}", "utf8");
}

function readAllSync(): Store {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(LINKS_FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeAllAtomicSync(s: Store) {
  ensure();
  const tmp = path.join(DATA_DIR, `.eld-driver-links.${process.pid}.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), "utf8");
  fs.renameSync(tmp, LINKS_FILE);
}

export function getEldDriverLink(ownerId: string, driverEmail: string): EldDriverLink | null {
  const key = driverEmail.trim().toLowerCase();
  return readAllSync()[ownerId]?.[key] ?? null;
}

// Every link across every owner — used only by lib/eld-refresh-job.ts to
// group drivers by owner+provider for batch refresh. Not a lock-protected
// read (same as getEldDriverLink); the job re-validates each link fresh,
// under the lock, right before it writes anything.
export function listAllEldDriverLinks(): { ownerId: string; driverEmail: string; link: EldDriverLink }[] {
  const s = readAllSync();
  const out: { ownerId: string; driverEmail: string; link: EldDriverLink }[] = [];
  for (const [ownerId, drivers] of Object.entries(s)) {
    for (const [driverEmail, link] of Object.entries(drivers)) {
      out.push({ ownerId, driverEmail, link });
    }
  }
  return out;
}

export class EldDriverLinkError extends Error {
  code:
    | "adapter_inactive"
    | "connection_missing"
    | "not_verified"
    | "missing_capability"
    | "external_driver_not_found"
    | "external_driver_already_linked";
  constructor(code: EldDriverLinkError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

// Links `driverEmail` (already confirmed to be on the calling dispatcher's
// roster — the route checks that, not this function) to `externalDriverId`
// on `provider`. Never trusts a client-supplied externalDriverId at face
// value: it must show up in a FRESH call to the adapter's listDrivers()
// right now, and the vehicle fields saved come from that same live lookup,
// never from whatever the client happened to send. Also enforces that this
// externalDriverId isn't already linked to a DIFFERENT driver under the
// same owner — one ELD driver record can't quietly back two LoadSprint
// driver accounts.
export async function linkEldDriver(
  ownerId: string,
  driverEmail: string,
  provider: EldProvider,
  externalDriverId: string,
  linkedBy: string,
  adapterFor: (p: EldProvider) => EldAdapter = getEldAdapter,
  signal?: AbortSignal
): Promise<EldDriverLink> {
  const adapter = adapterFor(provider);
  if (!adapter.active) {
    throw new EldDriverLinkError("adapter_inactive", `${provider} adapter is not active.`);
  }

  // Fail-closed BEFORE any network call: a saved credential that hasn't
  // been verified (or was verified under a since-replaced revision, or
  // lacks drivers_read) never reaches listDrivers().
  const gate = checkEldConnectionGate(getEldConnectionGate(ownerId, provider), "drivers_read");
  if (!gate.ok) {
    throw new EldDriverLinkError(gate.code as EldDriverLinkError["code"], gate.message);
  }

  const drivers = await adapter.listDrivers(signal);
  const match = drivers.find((d) => d.externalDriverId === externalDriverId);
  if (!match) {
    throw new EldDriverLinkError(
      "external_driver_not_found",
      "This external driver id wasn't found in the provider's current driver list."
    );
  }

  const key = driverEmail.trim().toLowerCase();
  return withEldConnectionLock(ownerId, () => {
    const s = readAllSync();
    const owned = s[ownerId] || {};
    for (const [email, link] of Object.entries(owned)) {
      if (email !== key && link.provider === provider && link.externalDriverId === externalDriverId) {
        throw new EldDriverLinkError(
          "external_driver_already_linked",
          "This external driver id is already linked to a different driver."
        );
      }
    }
    const record: EldDriverLink = {
      provider,
      externalDriverId,
      externalVehicleId: match.externalVehicleId,
      vehicleName: match.vehicleName,
      linkedAt: new Date().toISOString(),
      linkedBy,
    };
    if (!s[ownerId]) s[ownerId] = {};
    s[ownerId][key] = record;
    writeAllAtomicSync(s);
    return record;
  });
}

// Removing the link also removes whatever snapshot was fetched under it —
// there's no longer an authorization basis for keeping that driver's HOS
// data around.
export async function unlinkEldDriver(ownerId: string, driverEmail: string): Promise<void> {
  const key = driverEmail.trim().toLowerCase();
  await withEldConnectionLock(ownerId, () => {
    const s = readAllSync();
    if (s[ownerId]?.[key]) {
      delete s[ownerId][key];
      writeAllAtomicSync(s);
    }
  });
  await deleteEldSnapshotsForDriver(ownerId, key);
}

// Called when a connection's credentials are replaced or removed (see
// lib/eld-connection-lifecycle.ts) — every link made under the OLD
// credential loses its basis: the new credential hasn't verified as the
// same provider account, so any driver it was pointed at could now be
// wrong.
export async function deleteEldDriverLinksForProvider(ownerId: string, provider: EldProvider): Promise<void> {
  await withEldConnectionLock(ownerId, () => {
    const s = readAllSync();
    const owned = s[ownerId];
    if (!owned) return;
    let changed = false;
    for (const [email, link] of Object.entries(owned)) {
      if (link.provider === provider) {
        delete owned[email];
        changed = true;
      }
    }
    if (changed) writeAllAtomicSync(s);
  });
}
