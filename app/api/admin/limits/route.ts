import { NextResponse } from "next/server";
import { limitsSchema } from "@/lib/schemas";
import { currentUser } from "@/lib/guard";
import { setLimits } from "@/lib/settings";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const parsed = limitsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid limits" }, { status: 400 });
  }
  const limits = setLimits(parsed.data);
  return NextResponse.json({ ok: true, limits });
}
