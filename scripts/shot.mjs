// Dev helper: screenshot an authenticated page via the Chrome DevTools Protocol.
// Usage: node scripts/shot.mjs <url> <out.png> [cookieName=value ...]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [url, out, ...cookieArgs] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node scripts/shot.mjs <url> <out.png> [name=value ...]");
  process.exit(1);
}

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222 + Number(process.env.SHOT_PORT_OFFSET || 0);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "shot-"));
const width = Number(process.env.SHOT_W || 1440);
const height = Number(process.env.SHOT_H || 1000);

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(p) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${p}`);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(250);
  }
  throw new Error(`CDP not reachable on ${PORT}`);
}

const target = await getJson("/json/new?about:blank").catch(() => null)
  ?? (await getJson("/json/list"))[0];
const wsUrl = target.webSocketDebuggerUrl;
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send("Page.enable");
await send("Network.enable");
const origin = new URL(url);
for (const c of cookieArgs) {
  const eq = c.indexOf("=");
  await send("Network.setCookie", {
    name: c.slice(0, eq),
    value: c.slice(eq + 1),
    domain: origin.hostname,
    path: "/",
    httpOnly: true,
  });
}
await send("Emulation.setDeviceMetricsOverride", {
  width, height, deviceScaleFactor: 2, mobile: false,
});
await send("Page.navigate", { url });
await sleep(Number(process.env.SHOT_WAIT || 3500));
// Optional: drive the page (open a panel, focus a field) before capturing.
if (process.env.SHOT_JS) {
  const r = await send("Runtime.evaluate", {
    expression: process.env.SHOT_JS,
    awaitPromise: true,
    returnByValue: true,
  });
  const err = r.exceptionDetails;
  console.log("js:", err ? `ERROR ${err.text} ${err.exception?.description || ""}` : JSON.stringify(r.result?.value));
  await sleep(Number(process.env.SHOT_JS_WAIT || 900));
}
const { data } = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
});
fs.writeFileSync(out, Buffer.from(data, "base64"));
ws.close();
chrome.kill();
console.log(`saved ${out}`);
process.exit(0);
