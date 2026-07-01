import { NextResponse } from "next/server";
import { requestUser } from "@/lib/guard";
import { corsHeaders } from "@/lib/mobile-auth";
import { deleteUser, SESSION_COOKIE } from "@/lib/auth";
import { getInvitesBy, deleteInvite, removeInvitesByEmail } from "@/lib/invites";
import { deleteDriverGlobalLocation } from "@/lib/driver-location";

// POST /api/account/delete
// Permanently deletes the signed-in user's account and their personal data, then
// clears the session. Works from the web (session cookie) and the mobile app
// (bearer token) via requestUser. This satisfies Apple Guideline 5.1.1(v):
// any account created in the app can be deleted from within the app.
export async function POST(req: Request) {
  const me = await requestUser(req);
  if (!me) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: corsHeaders() }
    );
  }

  // Clean up data tied to this account.
  if (me.role === "dispatcher") {
    // Remove the driver invites this dispatcher created.
    for (const inv of getInvitesBy(me.id)) deleteInvite(inv.id, me.id, false);
  }
  if (me.role === "driver") {
    // Remove any invites addressed to this driver's email.
    removeInvitesByEmail(me.email);
  }
  deleteDriverGlobalLocation(me.email);

  const ok = deleteUser(me.id);

  const res = NextResponse.json({ ok }, { headers: corsHeaders() });
  // End the session so the deleted account is signed out everywhere.
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
