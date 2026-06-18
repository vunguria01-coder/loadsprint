import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { invoiceProfileSchema } from "@/lib/schemas";
import { getInvoiceProfile, setInvoiceProfile } from "@/lib/invoice-profile";

export async function GET() {
  const me = await currentUser();
  if (!me || (me.role !== "dispatcher" && me.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, profile: getInvoiceProfile(me.id) });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || (me.role !== "dispatcher" && me.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const parsed = invoiceProfileSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid data" }, { status: 400 });
  }
  const profile = setInvoiceProfile(me.id, parsed.data);
  return NextResponse.json({ ok: true, profile });
}
