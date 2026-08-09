// TEST-ONLY. Returns invented NormalizedEldSnapshot data so verification
// scripts can exercise the EldAdapter contract, strict validation, and
// AbortSignal cancellation without real credentials or a network call.
// Nothing under app/ or lib/eld-adapters/index.ts may import this —
// production always goes through getEldAdapter(), whose stubs are
// inactive until a provider is actually approved and implemented.
import type {
  EldAdapter,
  EldProvider,
  NormalizedEldSnapshot,
  NormalizedEldDriver,
  EldVerification,
  EldCapabilities,
} from "../types";

const FULL_CAPABILITIES: EldCapabilities = {
  drivers_read: true,
  vehicles_read: true,
  hos_read: true,
  locations_read: true,
};

export type FixtureEldOptions = {
  active?: boolean;
  delayMs?: number;
  // Lets a test build a deliberately invalid snapshot (negative minutes,
  // bad coordinates, broken dates) to exercise assertValidEldSnapshot's
  // all-or-nothing rejection without hand-rolling a whole object each time.
  overrides?: Partial<NormalizedEldSnapshot>;
  // Same idea for listDrivers() — defaults to two fixture drivers so tests
  // can look up a real externalDriverId without hand-building the list.
  drivers?: NormalizedEldDriver[];
  // Lets a test simulate a credential that's only partially authorized
  // (e.g. drivers_read but not hos_read) without hand-building a
  // verification object each time.
  verification?: Partial<EldVerification>;
  // Lets a test simulate a credential that fails verification outright
  // (wrong/expired key) rather than merely lacking a capability.
  verifyFails?: boolean;
  // How many external driver ids fetchSnapshots() accepts per call —
  // small by default so a test can exercise chunking with just a handful
  // of drivers instead of needing dozens.
  maxBatchSize?: number;
  // Full control over what fetchSnapshots() returns for a given request,
  // for tests that need to simulate a missing driver, a duplicate id, or
  // an id nobody asked for — the shapes lib/eld-refresh-job.ts has to
  // detect and reject. Defaults to "one snapshot per requested id."
  batchResponse?: (externalDriverIds: string[]) => NormalizedEldSnapshot[];
};

const DEFAULT_FIXTURE_DRIVERS: NormalizedEldDriver[] = [
  { externalDriverId: "fixture-driver-1", name: "Fixture Driver One", externalVehicleId: "veh-fixture-1", vehicleName: "Fixture Truck 204" },
  { externalDriverId: "fixture-driver-2", name: "Fixture Driver Two", externalVehicleId: null, vehicleName: null },
];

function abortError(): Error {
  return new DOMException("Aborted", "AbortError");
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    if (signal?.aborted) return Promise.reject(abortError());
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true }
    );
  });
}

function fixtureSnapshotFor(provider: EldProvider, externalDriverId: string, overrides?: Partial<NormalizedEldSnapshot>): NormalizedEldSnapshot {
  return {
    provider,
    externalDriverId,
    externalVehicleId: "veh-fixture-1",
    vehicleName: "Fixture Truck 204",
    vehicleVin: "1FUJGHDV8CLBF1234",
    dutyStatus: "driving",
    driveRemainingMin: 385,
    shiftRemainingMin: 610,
    cycleRemainingMin: 2820,
    breakRemainingMin: 165,
    location: { lat: 41.5, lng: -90.0, at: "2026-08-09T08:00:00.000Z" },
    sourceUpdatedAt: "2026-08-09T08:01:00.000Z",
    fetchedAt: "2026-08-09T08:02:00.000Z",
    ...overrides,
  };
}

export function fixtureEldAdapter(provider: EldProvider, opts: FixtureEldOptions = {}): EldAdapter {
  const active = opts.active ?? true;
  const delayMs = opts.delayMs ?? 0;

  return {
    provider,
    active,
    maxBatchSize: opts.maxBatchSize ?? 10,
    async verifyConnection(_credential: string, signal?: AbortSignal): Promise<EldVerification> {
      if (signal?.aborted) throw abortError();
      await delay(delayMs, signal);
      if (opts.verifyFails) {
        throw new Error(`${provider} rejected these credentials.`);
      }
      return {
        accountId: "fixture-account-1",
        capabilities: FULL_CAPABILITIES,
        ...opts.verification,
      };
    },
    async fetchSnapshot(externalDriverId: string, signal?: AbortSignal): Promise<NormalizedEldSnapshot> {
      if (signal?.aborted) throw abortError();
      await delay(delayMs, signal);
      return fixtureSnapshotFor(provider, externalDriverId, opts.overrides);
    },
    async fetchSnapshots(
      _credential: string,
      externalDriverIds: string[],
      signal?: AbortSignal
    ): Promise<NormalizedEldSnapshot[]> {
      if (signal?.aborted) throw abortError();
      await delay(delayMs, signal);
      if (opts.batchResponse) return opts.batchResponse(externalDriverIds);
      return externalDriverIds.map((id) => fixtureSnapshotFor(provider, id, opts.overrides));
    },
    async listDrivers(signal?: AbortSignal): Promise<NormalizedEldDriver[]> {
      if (signal?.aborted) throw abortError();
      await delay(delayMs, signal);
      return opts.drivers ?? DEFAULT_FIXTURE_DRIVERS;
    },
  };
}
