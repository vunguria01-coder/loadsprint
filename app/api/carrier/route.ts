import { NextResponse } from "next/server";
import { carrierSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const parsed = carrierSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    // TODO: forward to your onboarding / MC-DOT verification system.
    console.log("[carrier] new application:", parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
