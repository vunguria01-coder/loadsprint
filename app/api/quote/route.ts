import { NextResponse } from "next/server";
import { quoteSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const parsed = quoteSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    // TODO: forward to your CRM / email / dispatch system.
    console.log("[quote] new request:", parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
