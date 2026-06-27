import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getPlan } from "@/lib/billing-plans";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  if (me.role !== "dispatcher" && me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = getPlan(String(body.planId || ""));
  if (!plan) return NextResponse.json({ ok: false, error: "Unknown plan" }, { status: 400 });

  // Build the base URL from the incoming request (works on Railway + custom domain).
  const origin =
    req.headers.get("origin") ||
    (() => {
      try {
        return new URL(req.url).origin;
      } catch {
        return "";
      }
    })();

  const session = await createCheckoutSession({
    plan,
    userId: me.id,
    email: me.email,
    baseUrl: origin,
  });
  if (!session.ok || !session.url) {
    return NextResponse.json({ ok: false, error: session.error || "Could not start checkout" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: session.url });
}
