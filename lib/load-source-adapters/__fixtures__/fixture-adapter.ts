// TEST-ONLY. Returns invented NormalizedLoad data so verification scripts
// can exercise the LoadSourceAdapter contract and lib/load-search.ts's
// dependency-injected adapter lookup without real credentials or a network
// call. Nothing under app/ or lib/load-source-adapters/index.ts may import
// this — production always goes through getAdapter(), whose stubs are
// inactive until a provider is actually approved and implemented.
import type { LoadSourceAdapter, LoadSearchQuery, NormalizedLoad } from "../types";
import type { LoadSourceProvider } from "@/lib/load-source-connections";

// Two loads with different deadhead/RPM so sort-order tests have something
// to distinguish: fixture-2 is closer but pays less per mile than fixture-1.
export function fixtureAdapter(provider: LoadSourceProvider, active = true): LoadSourceAdapter {
  return {
    provider,
    active,
    async searchLoads(query: LoadSearchQuery): Promise<NormalizedLoad[]> {
      // Fixed, invented data — deliberately does NOT echo the query's own
      // filter fields back into the result. A real adapter's provider
      // decides equipment/trailer/rate; echoing the query here would make
      // every hard filter trivially "pass" and defeat the point of testing
      // lib/load-search.ts's filtering against this fixture.
      const base = (
        externalId: string,
        deadheadMi: number | null,
        rateCents: number,
        miles: number,
        direction: string | null
      ): NormalizedLoad => ({
        provider,
        externalId,
        origin: `${query.originLat.toFixed(2)}, ${query.originLng.toFixed(2)}`,
        destination: "Dallas, TX",
        pickupDate: "2026-08-10",
        equipment: "Dry Van",
        trailerLengthFt: 53,
        miles,
        deadheadMi,
        direction,
        rateCents,
        ratePerMileCents: Math.round(rateCents / miles),
        broker: { name: "Fixture Brokerage", contact: "dispatch@fixture-brokerage.test" },
        originalUrl: `https://example.test/${provider}/loads/${externalId}`,
      });

      return [
        base("fixture-1", 40, 210000, 925, "S"),
        base("fixture-2", 12, 150000, 925, "SW"),
        // Unknown deadhead and unknown direction — exists so tests can
        // confirm both filters exclude "unknown" rather than assume a pass.
        base("fixture-3", null, 180000, 925, null),
      ];
    },
  };
}
