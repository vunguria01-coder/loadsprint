import { LOAD_SOURCE_PROVIDERS, type LoadSourceProvider } from "@/lib/load-source-connections";
import type { LoadSourceAdapter, LoadSearchQuery, NormalizedLoad } from "./types";

export type { LoadSourceAdapter, LoadSearchQuery, NormalizedLoad };

// No provider is approved to call out yet — every adapter below is inactive
// and throws instead of guessing at an API. Flip one provider's stub for a
// real implementation (and its `active` flag to true) only after the
// integration is contractually approved and its API verified against
// NormalizedLoad; leave the rest as inactive stubs.
function notImplementedAdapter(provider: LoadSourceProvider): LoadSourceAdapter {
  return {
    provider,
    active: false,
    async searchLoads(): Promise<NormalizedLoad[]> {
      throw new Error(
        `${provider} adapter is not implemented yet — pending contract approval and API verification.`
      );
    },
  };
}

const ADAPTERS: Record<LoadSourceProvider, LoadSourceAdapter> = Object.fromEntries(
  LOAD_SOURCE_PROVIDERS.map((provider) => [provider, notImplementedAdapter(provider)])
) as Record<LoadSourceProvider, LoadSourceAdapter>;

export function getAdapter(provider: LoadSourceProvider): LoadSourceAdapter {
  return ADAPTERS[provider];
}
