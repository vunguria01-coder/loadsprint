"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronDown,
  Check,
  Infinity as InfinityIcon,
  CalendarClock,
  Plus,
  RotateCcw,
  Ban,
  Copy,
  Users,
} from "lucide-react";
import type { SafeUser, AccountRole } from "@/lib/auth";
import type { AccountTier } from "@/lib/schemas";
import { driverAllowance } from "@/lib/billing-plans";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";

/* ---------------- plans ---------------- */

// Admin grant options — each maps directly to a tier.
const planOptions: { value: AccountTier; label: string; drivers: number }[] = [
  { value: "none", label: "Free", drivers: 0 },
  { value: "silver", label: "Silver", drivers: 2 },
  { value: "gold", label: "Gold", drivers: 8 },
  { value: "platinum", label: "Platinum", drivers: 30 },
];

// Duration shortcuts; 0 = open-ended (no expiry).
const dayPresets = [7, 30, 90, 365, 0];

/* ---------------- status helpers ---------------- */

const DAY = 86400000;
/** Anything at or under this many days left counts as "expiring soon". */
const SOON_DAYS = 7;

function daysLeft(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY);
}

type Status = "free" | "active" | "soon" | "expired";

function statusOf(u: SafeUser): Status {
  if (u.tier === "none") return "free";
  const left = daysLeft(u.tierExpiresAt);
  if (left === null) return "active";
  if (left < 0) return "expired";
  return left <= SOON_DAYS ? "soon" : "active";
}

const statusLabel: Record<Status, string> = {
  free: "Free",
  active: "Active",
  soon: "Expiring",
  expired: "Expired",
};

function planName(tier: AccountTier): string {
  if (tier === "none") return "Free";
  return tier[0].toUpperCase() + tier.slice(1);
}

/** Human line under the plan name — "12 days left", "No expiry", … */
function subLabel(u: SafeUser): string {
  if (u.tier === "none") return "No plan";
  const left = daysLeft(u.tierExpiresAt);
  if (left === null) return "No expiry";
  if (left < 0) return `Expired ${-left}d ago`;
  if (left === 0) return "Expires today";
  return `${left} day${left === 1 ? "" : "s"} left`;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Same format as fmtDate, from a stored ISO string; "—" when absent/unparsable. */
function fmtIso(iso?: string): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? "—" : fmtDate(ms);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ---------------- draft state ---------------- */

type Draft = { tier: AccountTier; days: number };

/**
 * The draft an untouched row starts from. Deriving it from the user (rather
 * than storing it on open) keeps "dirty" honest: after a save the row's user
 * has changed, so the same function yields the new baseline.
 */
function baseDraft(u: SafeUser): Draft {
  if (u.tier === "none") return { tier: "none", days: 30 };
  const left = daysLeft(u.tierExpiresAt);
  return { tier: u.tier, days: left === null ? 0 : Math.max(0, left) };
}

function sameDraft(a: Draft, b: Draft): boolean {
  // Days are irrelevant while the account is on Free — nothing to expire.
  if (a.tier === "none" && b.tier === "none") return true;
  return a.tier === b.tier && a.days === b.days;
}

/* ---------------- filters ---------------- */

const filters: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "soon", label: "Expiring" },
  { key: "expired", label: "Expired" },
  { key: "free", label: "Free" },
];

type SortKey = "name" | "expiry" | "plan" | "newest";

function roleLabel(role: string): string {
  return role[0].toUpperCase() + role.slice(1);
}

const tierRank: Record<string, number> = { platinum: 3, gold: 2, silver: 1, none: 0 };

export function AdminUserManager({
  users,
  extras = {},
  showFreeze = false,
}: {
  users: SafeUser[];
  extras?: Record<string, string>;
  showFreeze?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [role, setRole] = useState<"all" | AccountRole>("all");
  const [sort, setSort] = useState<SortKey>("name");
  // Id of the row whose e-mail was just copied — drives the button's tick.
  const [copied, setCopied] = useState<string | null>(null);
  // Saved rows are patched in place so the card updates before the server
  // round-trip lands; router.refresh() then reconciles with the real data.
  const [patched, setPatched] = useState<Record<string, Partial<SafeUser>>>({});
  // Revoking strips a paid plan and the driver seats with it — never on one
  // stray click, so the button opens this confirmation instead of acting.
  const [confirming, setConfirming] = useState<SafeUser | null>(null);

  const rows = useMemo(
    () => users.map((u) => (patched[u.id] ? { ...u, ...patched[u.id] } : u)),
    [users, patched]
  );

  // Roles actually present, with their headcount. A page that lists a single
  // role (admin/drivers, admin/brokers…) gets no role picker — nothing to pick.
  const roles = useMemo(() => {
    const c = new Map<AccountRole, number>();
    for (const u of rows) c.set(u.role, (c.get(u.role) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const inRole = useMemo(
    () => (role === "all" ? rows : rows.filter((u) => u.role === role)),
    [rows, role]
  );

  // Status counts follow the role picker, so the chips always match the list.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: inRole.length, free: 0, active: 0, soon: 0, expired: 0 };
    for (const u of inRole) c[statusOf(u)]++;
    return c;
  }, [inRole]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = inRole.filter((u) => {
      if (filter !== "all" && statusOf(u) !== filter) return false;
      if (!needle) return true;
      return (
        u.name.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.company || "").toLowerCase().includes(needle)
      );
    });
    out.sort((a, b) => {
      switch (sort) {
        case "expiry": {
          // Soonest expiry first, then open-ended plans, then free accounts.
          const rank = (u: SafeUser) =>
            u.tier === "none" ? 2e9 : daysLeft(u.tierExpiresAt) ?? 1e9;
          return rank(a) - rank(b) || a.name.localeCompare(b.name);
        }
        case "plan":
          return tierRank[b.tier] - tierRank[a.tier] || a.name.localeCompare(b.name);
        case "newest":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return out;
  }, [rows, q, filter, sort]);

  async function patch(
    userId: string,
    body: { tier?: AccountTier; days?: number; planId?: string; canFreezeLocation?: boolean; canConfirmationPdf?: boolean },
    successMsg: string
  ) {
    setBusy(userId);
    try {
      const res = await fetch("/api/admin/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...body }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) toast("Update failed", data.error || "Try again.");
      else {
        setPatched((p) => ({ ...p, [userId]: data.user }));
        setDrafts((d) => {
          const { [userId]: _drop, ...rest } = d;
          void _drop;
          return rest;
        });
        toast("Saved", successMsg);
        router.refresh();
      }
    } catch {
      toast("Network error", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function applyDraft(u: SafeUser, d: Draft) {
    if (d.tier === "none") {
      patch(u.id, { tier: "none", planId: "", days: 0 }, `${u.name} moved to Free.`);
    } else {
      const when = d.days > 0 ? ` until ${fmtDate(Date.now() + d.days * DAY)}` : " with no expiry";
      patch(u.id, { tier: d.tier, planId: "", days: d.days }, `${u.name}: ${planName(d.tier)}${when}.`);
    }
  }

  function copyEmail(u: SafeUser) {
    navigator.clipboard?.writeText(u.email);
    setCopied(u.id);
    toast("E-mail copied", `${u.email} is on your clipboard.`);
    window.setTimeout(() => setCopied((c) => (c === u.id ? null : c)), 1800);
  }

  /** Extend from the *remaining* time, not from today, so time is never lost. */
  function extend(u: SafeUser, add: number) {
    const left = daysLeft(u.tierExpiresAt);
    const base = left === null ? 0 : Math.max(0, left);
    const days = base + add;
    patch(
      u.id,
      { tier: u.tier, days },
      `${u.name}: +${add} days — now until ${fmtDate(Date.now() + days * DAY)}.`
    );
  }

  if (users.length === 0) {
    return (
      <EmptyState
        icon={<Users size={26} />}
        title="No accounts yet"
        sub="Registered accounts will show up here once someone signs up."
      />
    );
  }

  return (
    <div className="am">
      <div className="am-bar">
        <div className="driver-search am-search">
          <Search size={18} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or company…"
            aria-label="Search accounts"
          />
          {q && (
            <button type="button" className="ds-clear" onClick={() => setQ("")} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        <div className="am-filters" role="group" aria-label="Filter by status">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`am-chip${filter === f.key ? " on" : ""}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="am-chip-n">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {roles.length > 1 && (
          <label className="am-sort">
            <span className="am-flabel">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as "all" | AccountRole)}>
              <option value="all">All roles ({rows.length})</option>
              {roles.map(([r, n]) => (
                <option key={r} value={r}>
                  {roleLabel(r)} ({n})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="am-sort">
          <span className="am-flabel">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="name">Name (A–Z)</option>
            <option value="expiry">Expires soonest</option>
            <option value="plan">Highest plan</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="am-empty">
          No accounts match{q ? ` “${q}”` : ""}
          {filter !== "all" ? ` in ${statusLabel[filter as Status].toLowerCase()}` : ""}
          {role !== "all" ? ` among ${roleLabel(role).toLowerCase()} accounts` : ""}.
        </p>
      ) : (
        <div className="am-list">
          {visible.map((u, i) => {
            const base = baseDraft(u);
            const draft = drafts[u.id] ?? base;
            const dirty = !sameDraft(draft, base);
            const status = statusOf(u);
            const expanded = open === u.id;
            const isBusy = busy === u.id;
            const allowance = driverAllowance(undefined, u.tier);
            const previewMs = Date.now() + draft.days * DAY;

            function setDraft(next: Partial<Draft>) {
              setDrafts((d) => ({ ...d, [u.id]: { ...draft, ...next } }));
            }

            return (
              <Fragment key={u.id}>
              {/* Hairline between accounts so one row never bleeds into the next. */}
              {i > 0 && <div className="am-div" aria-hidden="true" />}
              <div
                className={`am-card st-${status}${expanded ? " open" : ""}${isBusy ? " busy" : ""}`}
              >
                <button
                  type="button"
                  className="am-head"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : u.id)}
                >
                  <span className={`am-av tier-${u.tier}`} aria-hidden="true">
                    {initials(u.name)}
                  </span>

                  <span className="am-id">
                    <span className="am-name">
                      {u.name}
                      <span className="role-pill">{u.role}</span>
                    </span>
                    <span className="am-mail">{u.email}</span>
                    {extras[u.id] && <span className="am-extra">{extras[u.id]}</span>}
                  </span>

                  <span className="am-plan">
                    <span className={`am-status st-${status}`}>
                      <span className="am-dot" aria-hidden="true" />
                      {statusLabel[status]}
                    </span>
                    <span className={`am-tier tier-${u.tier}`}>
                      <span className="am-tier-dot" aria-hidden="true" />
                      {planName(u.tier)}
                    </span>
                    <span className="am-sub">
                      {subLabel(u)}
                      {u.tier !== "none" ? ` · ${allowance} drivers` : ""}
                    </span>
                  </span>

                  <ChevronDown size={18} className="am-caret" aria-hidden="true" />
                </button>

                {/* One-tap renewal, no need to open the editor. The copy button
                    lives here rather than next to the address: the header is
                    itself a button, and a button cannot nest inside one. */}
                <div className="am-quick">
                  <button
                    type="button"
                    className="am-qbtn"
                    onClick={() => copyEmail(u)}
                    title={`Copy ${u.email} to the clipboard`}
                  >
                    {copied === u.id ? <Check size={13} /> : <Copy size={13} />}
                    {copied === u.id ? "Copied" : "Copy e-mail"}
                  </button>

                  {u.tier === "none" ? (
                    !expanded && (
                      <button
                        type="button"
                        className="am-qbtn"
                        disabled={isBusy}
                        onClick={() => setOpen(u.id)}
                      >
                        <Plus size={13} /> Grant a plan
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        type="button"
                        className="am-qbtn"
                        disabled={isBusy}
                        onClick={() => extend(u, 30)}
                        title="Add 30 days on top of the time that is left"
                      >
                        <Plus size={13} /> 30 days
                      </button>
                      <button
                        type="button"
                        className="am-qbtn"
                        disabled={isBusy}
                        onClick={() => extend(u, 365)}
                        title="Add a year on top of the time that is left"
                      >
                        <Plus size={13} /> 1 year
                      </button>
                      <button
                        type="button"
                        className="am-qbtn danger"
                        disabled={isBusy}
                        onClick={() => setConfirming(u)}
                        title="Remove the plan and drop this account to Free"
                      >
                        <Ban size={13} /> Revoke
                      </button>
                    </>
                  )}
                </div>

                {expanded && (
                  <div className="am-panel">
                    {/* Who this account is, before any editing control: the
                        facts an admin needs to decide what to grant. */}
                    <dl className="am-facts">
                      <div>
                        <dt>Company</dt>
                        <dd>{u.company || "—"}</dd>
                      </div>
                      <div>
                        <dt>Registered</dt>
                        <dd>{fmtIso(u.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>Plan id</dt>
                        <dd>{u.planId || (u.tier === "none" ? "—" : "Admin grant")}</dd>
                      </div>
                      <div>
                        <dt>Driver limit</dt>
                        <dd>{driverAllowance(u.planId, u.tier)}</dd>
                      </div>
                      <div>
                        <dt>Plan ends</dt>
                        <dd>
                          {u.tier === "none"
                            ? "—"
                            : u.tierExpiresAt
                              ? fmtIso(u.tierExpiresAt)
                              : "Never"}
                        </dd>
                      </div>
                    </dl>

                    <div className="am-group">
                      <span className="am-flabel">Plan</span>
                      <div className="am-opts">
                        {planOptions.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            className={`am-opt tier-${o.value}${draft.tier === o.value ? " on" : ""}`}
                            aria-pressed={draft.tier === o.value}
                            disabled={isBusy}
                            onClick={() => setDraft({ tier: o.value })}
                          >
                            {draft.tier === o.value && <Check size={13} />}
                            {o.label}
                            {o.drivers > 0 && <span className="am-opt-n">{o.drivers} drivers</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {draft.tier !== "none" && (
                      <div className="am-group">
                        <span className="am-flabel">Valid for</span>
                        <div className="am-opts">
                          {dayPresets.map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={`am-opt${draft.days === d ? " on" : ""}`}
                              aria-pressed={draft.days === d}
                              disabled={isBusy}
                              onClick={() => setDraft({ days: d })}
                            >
                              {d === 0 ? (
                                <>
                                  <InfinityIcon size={13} /> Forever
                                </>
                              ) : d === 365 ? (
                                "1 year"
                              ) : (
                                `${d} days`
                              )}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={0}
                            className="am-days"
                            aria-label="Custom number of days"
                            title="Custom number of days (0 = no expiry)"
                            value={draft.days}
                            disabled={isBusy}
                            onChange={(e) => setDraft({ days: Math.max(0, Number(e.target.value) || 0) })}
                          />
                        </div>
                      </div>
                    )}

                    {/* Apply and the restricted-tool switches act on this one
                        account — keep them in a single framed band. */}
                    <div className="am-bottom">
                    <div className="am-foot">
                      {/* Projects the pending change; with nothing staged it
                          states what the account *is* — an expired plan must
                          never read back as "never expires". */}
                      <p className={`am-preview${dirty ? " staged" : ""}`}>
                        <CalendarClock size={14} />
                        {!dirty ? (
                          <>
                            <b>{planName(u.tier)}</b> · {subLabel(u).toLowerCase()}
                          </>
                        ) : draft.tier === "none" ? (
                          <>No plan — driver access removed.</>
                        ) : draft.days === 0 ? (
                          <>
                            <b>{planName(draft.tier)}</b> · never expires
                          </>
                        ) : (
                          <>
                            <b>{planName(draft.tier)}</b> · until {fmtDate(previewMs)}
                          </>
                        )}
                      </p>

                      <div className="am-actions">
                        {dirty && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={isBusy}
                            onClick={() =>
                              setDrafts((d) => {
                                const { [u.id]: _drop, ...rest } = d;
                                void _drop;
                                return rest;
                              })
                            }
                          >
                            <RotateCcw size={14} /> Reset
                          </button>
                        )}
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={isBusy || !dirty}
                          onClick={() => applyDraft(u, draft)}
                        >
                          {isBusy ? "Saving…" : dirty ? "Apply changes" : "No changes"}
                        </button>
                      </div>
                    </div>

                    {showFreeze && (
                      <div className="am-tools">
                        <span className="am-flabel">Restricted tools</span>
                        <label className="sw">
                          <input
                            type="checkbox"
                            checked={u.canFreezeLocation}
                            disabled={isBusy}
                            onChange={(e) =>
                              patch(
                                u.id,
                                { canFreezeLocation: e.target.checked },
                                e.target.checked ? `Location freeze granted to ${u.name}.` : `Location freeze revoked from ${u.name}.`
                              )
                            }
                          />
                          <span className="track" />
                          <span className="sw-lbl">Location freeze</span>
                        </label>
                        <label className="sw">
                          <input
                            type="checkbox"
                            checked={!!u.canConfirmationPdf}
                            disabled={isBusy}
                            onChange={(e) =>
                              patch(
                                u.id,
                                { canConfirmationPdf: e.target.checked },
                                e.target.checked ? `Clean rate-con PDF granted to ${u.name}.` : `Clean rate-con PDF revoked from ${u.name}.`
                              )
                            }
                          />
                          <span className="track" />
                          <span className="sw-lbl">Clean rate-con PDF</span>
                        </label>
                      </div>
                    )}
                    </div>
                  </div>
                )}
              </div>
              </Fragment>
            );
          })}
        </div>
      )}

      {confirming && (
        <>
          <div className="pkg-scrim" onClick={() => setConfirming(null)} />
          <div className="pkg-modal am-confirm" role="dialog" aria-modal="true" aria-labelledby="am-confirm-t">
            <h3 id="am-confirm-t" className="am-confirm-title">
              Revoke {planName(confirming.tier)} from {confirming.name}?
            </h3>
            <p className="am-confirm-sub">
              The account drops to Free right away and loses its {driverAllowance(confirming.planId, confirming.tier)} driver
              seats. You can grant a plan again at any time.
            </p>
            <div className="am-confirm-acts">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm am-confirm-go"
                onClick={() => {
                  const u = confirming;
                  setConfirming(null);
                  patch(u.id, { tier: "none", planId: "", days: 0 }, `${u.name} moved to Free.`);
                }}
              >
                <Ban size={14} /> Revoke plan
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
