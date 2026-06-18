import { NextResponse } from "next/server";

// Self-serve subscription purchase is disabled. Plans are granted by an admin
// from the admin panel. (Payment/self-checkout will be added later via Stripe.)
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Plans are activated by your administrator." },
    { status: 403 }
  );
}
