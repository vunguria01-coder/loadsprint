import { saveEldConnection, deleteEldConnection } from "@/lib/eld-connections";
import { deleteEldDriverLinksForProvider } from "@/lib/eld-driver-links";
import { deleteEldSnapshotsForProvider } from "@/lib/eld-snapshots";
import type { EldConnectionSummary } from "@/lib/eld-connections";
import type { EldProvider } from "@/lib/eld-adapters";

// The orchestration layer that ties the connection store together with
// driver links and snapshots — kept separate from lib/eld-connections.ts
// on purpose: eld-connections.ts needs to stay a leaf module that lib/eld-
// driver-links.ts can safely import (for the verification gate check)
// without creating a cycle back to it.

// Re-saving credentials (a fresh secret, a fresh revision) invalidates
// everything that was authorized under the OLD ones. eld-connections.ts
// already resets `verified` itself; this additionally removes driver links
// and cached snapshots made under the previous credential, since a new
// secret hasn't proven it points at the same provider account yet.
export async function saveEldConnectionAndReset(
  ownerId: string,
  provider: EldProvider,
  secret: string
): Promise<EldConnectionSummary> {
  const summary = await saveEldConnection(ownerId, provider, secret);
  await deleteEldDriverLinksForProvider(ownerId, provider);
  await deleteEldSnapshotsForProvider(ownerId, provider);
  return summary;
}

// deleteEldConnection() already purges that provider's snapshots for this
// owner; this adds purging its driver links too.
export async function deleteEldConnectionAndCleanup(ownerId: string, provider: EldProvider): Promise<void> {
  await deleteEldConnection(ownerId, provider);
  await deleteEldDriverLinksForProvider(ownerId, provider);
}
