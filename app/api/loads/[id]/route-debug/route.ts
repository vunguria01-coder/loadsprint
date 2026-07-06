import { NextResponse } from "next/server";
import { currentUser } from "@/lib/guard";
import { getLoadById } from "@/lib/loads";

// TEMP diagnostic: why does HERE routing return nothing? Reports whether the key
// is present (length only, never the value) and the exact HERE HTTP status/body.
// Restricted to the load owner or an admin. Remove once routing is confirmed.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const load = getLoadById(id);
  if (!load) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const owns = me.role === "admin" || load.dispatcherId === me.id;
  if (!owns) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const key = process.env.HERE_API_KEY;
  const envKeys = Object.keys(process.env).filter((k) => /here/i.test(k));
  const info = { hasKey: !!key, keyLen: key ? key.length : 0, hereEnvVarNames: envKeys };
  if (!key) {
    return NextResponse.json({ ok: true, ...info, note: "process.env.HERE_API_KEY is empty" });
  }

  const o = load.origin;
  const d = load.dest;
  const url =
    `https://router.hereapi.com/v8/routes?transportMode=truck&routingMode=fast` +
    `&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}` +
    `&return=summary&units=imperial&apikey=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const body = await res.text();
    return NextResponse.json({
      ok: true,
      ...info,
      hereStatus: res.status,
      hereOk: res.ok,
      hereBody: body.slice(0, 400),
    });
  } catch (e) {
    return NextResponse.json({ ok: true, ...info, error: String(e).slice(0, 200) });
  }
}
