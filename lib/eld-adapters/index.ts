import { ELD_PROVIDERS, type EldProvider } from "./types";
import type { EldAdapter, NormalizedEldSnapshot, NormalizedEldDriver, EldVerification } from "./types";

export type { EldAdapter, NormalizedEldSnapshot, NormalizedEldDriver, EldVerification, EldProvider };
export {
  ELD_PROVIDERS,
  DUTY_STATUSES,
  type DutyStatus,
  type EldLocation,
  type EldCapabilities,
} from "./types";
export { validateEldSnapshot, assertValidEldSnapshot, type EldValidationError } from "./validate";

// No provider is approved to call out yet — every adapter below is
// inactive and throws instead of guessing at an API (see
// docs/eld-providers-research.md — none of the four have confirmed test
// access). Flip one provider's stub for a real implementation (and its
// `active` flag to true) only after the integration is contractually
// approved and its API verified against NormalizedEldSnapshot.
function notImplementedAdapter(provider: EldProvider): EldAdapter {
  const notImplemented = () => {
    throw new Error(
      `${provider} ELD adapter is not implemented yet — pending contract approval and API verification.`
    );
  };
  return {
    provider,
    active: false,
    // Never actually consulted — no code path calls fetchSnapshots() on an
    // inactive adapter — but a real, plausible-looking number so nothing
    // downstream divides by zero or chunks into 0-sized batches if it ever
    // is.
    maxBatchSize: 50,
    async verifyConnection(): Promise<EldVerification> {
      return notImplemented();
    },
    async fetchSnapshot(): Promise<NormalizedEldSnapshot> {
      return notImplemented();
    },
    async fetchSnapshots(): Promise<NormalizedEldSnapshot[]> {
      return notImplemented();
    },
    async listDrivers(): Promise<NormalizedEldDriver[]> {
      return notImplemented();
    },
  };
}

const ADAPTERS: Record<EldProvider, EldAdapter> = Object.fromEntries(
  ELD_PROVIDERS.map((provider) => [provider, notImplementedAdapter(provider)])
) as Record<EldProvider, EldAdapter>;

export function getEldAdapter(provider: EldProvider): EldAdapter {
  return ADAPTERS[provider];
}
