import { getEldDriverLink } from "@/lib/eld-driver-links";
import { getEldConnectionGate, checkEldConnectionGate, getDecryptedEldCredential } from "@/lib/eld-connections";
import { getEldAdapter, validateEldSnapshot } from "@/lib/eld-adapters";
import { recordEldSnapshotFailure, recordEldSnapshotFailureSync, recordEldSnapshotSuccessSync } from "@/lib/eld-snapshots";
import { withEldConnectionLock } from "@/lib/eld-connections-lock";
import { encryptEldData } from "@/lib/eld-data-crypto";
import type { EldAdapter, EldProvider, NormalizedEldSnapshot } from "@/lib/eld-adapters";

const DEFAULT_TIMEOUT_MS = 20_000;

export type RefreshEldSnapshotResult =
  | { ok: true; snapshot: NormalizedEldSnapshot }
  | { ok: false; code: string; message: string };

// One-shot "pull the latest ELD snapshot for this driver" — no schedule,
// no job runner, no UI wired to it yet (that's future work, same as
// lib/load-ingest-job.ts was for load sources). Every failure path records
// itself via lib/eld-snapshots.ts's recordEldSnapshotFailure, which never
// touches a previously-stored good snapshot — only this call's own
// attempt/error metadata changes.
export async function refreshEldSnapshot(
  ownerId: string,
  driverEmail: string,
  adapterFor: (p: EldProvider) => EldAdapter = getEldAdapter,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<RefreshEldSnapshotResult> {
  const key = driverEmail.trim().toLowerCase();

  const link = getEldDriverLink(ownerId, key);
  if (!link) {
    return { ok: false, code: "not_linked", message: "This driver has no ELD link." };
  }

  // Fail-closed BEFORE any network call: a connection that's missing,
  // unverified, verified under a since-replaced credential revision, or
  // missing hos_read specifically never reaches fetchSnapshot().
  const gate = checkEldConnectionGate(getEldConnectionGate(ownerId, link.provider), "hos_read");
  if (!gate.ok) {
    await recordEldSnapshotFailure(ownerId, key, link.provider, link.externalDriverId, gate.code);
    return { ok: false, code: gate.code, message: gate.message };
  }

  const adapter = adapterFor(link.provider);
  if (!adapter.active) {
    await recordEldSnapshotFailure(ownerId, key, link.provider, link.externalDriverId, "adapter_inactive");
    return { ok: false, code: "adapter_inactive", message: `${link.provider} adapter is not active.` };
  }

  // Decrypted only for the duration of this call, held in a local
  // variable, never persisted or logged. Today's EldAdapter.fetchSnapshot
  // doesn't take a credential parameter — every real adapter is still an
  // inactive stub — so this step exists to prove decryption actually
  // succeeds (and to fail closed if it doesn't) ahead of the day
  // fetchSnapshot grows a slot for it.
  let credential: string | null;
  try {
    credential = await getDecryptedEldCredential(ownerId, link.provider);
  } catch {
    await recordEldSnapshotFailure(ownerId, key, link.provider, link.externalDriverId, "credential_decrypt_failed");
    return { ok: false, code: "credential_decrypt_failed", message: "Could not decrypt the saved connection." };
  }
  if (!credential) {
    await recordEldSnapshotFailure(ownerId, key, link.provider, link.externalDriverId, "connection_missing");
    return { ok: false, code: "connection_missing", message: "No saved connection for this provider." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let raw: NormalizedEldSnapshot;
  try {
    raw = await adapter.fetchSnapshot(link.externalDriverId, controller.signal);
  } catch (e) {
    clearTimeout(timer);
    const code = e instanceof Error && e.name === "AbortError" ? "timeout" : "fetch_failed";
    await recordEldSnapshotFailure(ownerId, key, link.provider, link.externalDriverId, code);
    return {
      ok: false,
      code,
      message: code === "timeout" ? "Timed out waiting for the provider." : "The provider call failed.",
    };
  }
  clearTimeout(timer);

  const errors = validateEldSnapshot(raw);
  if (errors.length > 0) {
    await recordEldSnapshotFailure(ownerId, key, link.provider, link.externalDriverId, "invalid_snapshot");
    return { ok: false, code: "invalid_snapshot", message: "Provider returned data that failed validation." };
  }

  // A misbehaving or misconfigured adapter returning some OTHER driver's
  // data is a distinct failure from "data was invalid" — never store it
  // under this driver's key even though it individually validates fine.
  if (raw.provider !== link.provider || raw.externalDriverId !== link.externalDriverId) {
    await recordEldSnapshotFailure(ownerId, key, link.provider, link.externalDriverId, "snapshot_mismatch");
    return { ok: false, code: "snapshot_mismatch", message: "Snapshot didn't match the linked provider/driver." };
  }

  // fetchSnapshot had no lock held across it — it can take seconds, and in
  // that window credentials can be replaced, the link removed or
  // repointed, or the connection deleted entirely. So right before writing
  // (not before the network call), re-check everything fresh in the SAME
  // lock acquisition as the write itself: if the link is gone or now
  // points at a different externalDriverId, or the connection's
  // revision/verification/capability no longer holds, this response is
  // stale — discard it silently rather than resurrecting data under
  // authorization that no longer applies.
  return withEldConnectionLock(ownerId, () => {
    const freshLink = getEldDriverLink(ownerId, key);
    const staleLink =
      !freshLink || freshLink.provider !== link.provider || freshLink.externalDriverId !== link.externalDriverId;
    const freshGate = checkEldConnectionGate(getEldConnectionGate(ownerId, link.provider), "hos_read");

    if (staleLink || !freshGate.ok) {
      recordEldSnapshotFailureSync(ownerId, key, link.provider, link.externalDriverId, "stale_response_discarded");
      return {
        ok: false,
        code: "stale_response_discarded",
        message: "The link or connection changed while this refresh was in flight; the result was discarded.",
      };
    }

    const encrypted = encryptEldData(JSON.stringify(raw), ownerId, key, link.provider, link.externalDriverId);
    recordEldSnapshotSuccessSync(ownerId, key, link.provider, link.externalDriverId, encrypted);
    return { ok: true, snapshot: raw };
  });
}
