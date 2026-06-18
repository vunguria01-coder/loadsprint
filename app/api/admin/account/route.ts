import { NextResponse } from "next/server";
import { adminAccountSchema } from "@/lib/schemas";
import { updateUser, toSafe } from "@/lib/auth";
import { currentUser } from "@/lib/guard";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const parsed = adminAccountSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { userId, tier, canFreezeLocation } = parsed.data;
  const patch: Record<string, unknown> = {};
  if (tier !== undefined) patch.tier = tier;
  if (canFreezeLocation !== undefined) patch.canFreezeLocation = canFreezeLocation;
  const updated = updateUser(userId, patch);
  if (!updated) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, user: toSafe(updated) });
}
