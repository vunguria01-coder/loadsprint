import { NextResponse } from "next/server";
import { pricingSchema } from "@/lib/schemas";
import { currentUser } from "@/lib/guard";
import { setPricing } from "@/lib/settings";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const parsed = pricingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid prices" }, { status: 400 });
  }
  const pricing = setPricing(parsed.data);
  return NextResponse.json({ ok: true, pricing });
}
