import fs from "node:fs";
import path from "node:path";

// Dev-only file watcher hub. One recursive watcher per source directory is
// shared by every open browser tab: subscribers come and go, the watchers stay.
// Events are coalesced per path in a short window so that a "save all" in the
// editor arrives as one batch instead of a hundred round trips.
//
// Never import this from anything that ships to production — the SSE route that
// consumes it 404s outside of `next dev`.

export type LiveScope = "hot" | "data" | "asset" | "config";

export type LiveEvent = {
  /** Monotonic per-process id, used as a React key on the client. */
  id: number;
  /** Project-relative, forward slashes. Absolute paths never leave the server. */
  path: string;
  kind: "add" | "change" | "delete";
  scope: LiveScope;
  at: number;
};

export type LiveBatch = { events: LiveEvent[]; dropped: number };

type Subscriber = (batch: LiveBatch) => void;

type Hub = {
  bootId: string;
  subs: Set<Subscriber>;
  watchers: fs.FSWatcher[];
  pending: Map<string, LiveEvent>;
  dropped: number;
  flushTimer: ReturnType<typeof setTimeout> | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
  seq: number;
};

const ROOT = process.cwd();

/** Recursively watched source trees and the scope reported for each. */
const TREES: Array<{ dir: string; scope: LiveScope }> = [
  { dir: "app", scope: "hot" },
  { dir: "components", scope: "hot" },
  { dir: "lib", scope: "hot" },
  { dir: "data", scope: "data" },
  { dir: "public", scope: "asset" },
];

/** Root-level files that need a dev-server restart to take effect. */
const CONFIG_FILES = new Set([
  "next.config.mjs",
  "tailwind.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "package.json",
  ".env",
  ".env.local",
  ".env.development",
]);

const IGNORED_SEGMENTS = new Set(["node_modules", ".next", ".git", ".vercel"]);
const IGNORED_FILE = /(\.tsbuildinfo|\.map|~|\.swp|\.swx|\.tmp)$/;

/** Coalescing window. Long enough to merge a save-all, short enough to feel live. */
const FLUSH_MS = 60;
/** Hard cap per batch so a `git checkout` can't flood the stream. */
const MAX_BATCH = 120;
/** Keep watchers alive briefly after the last tab closes — a reload is not a stop. */
const IDLE_STOP_MS = 15_000;

// Survives module re-evaluation, which the dev server does on every edit.
const globalForHub = globalThis as unknown as { __loadsprintLiveHub?: Hub };

function hub(): Hub {
  if (!globalForHub.__loadsprintLiveHub) {
    globalForHub.__loadsprintLiveHub = {
      bootId: `${process.pid}-${Date.now().toString(36)}`,
      subs: new Set(),
      watchers: [],
      pending: new Map(),
      dropped: 0,
      flushTimer: null,
      stopTimer: null,
      seq: 0,
    };
  }
  return globalForHub.__loadsprintLiveHub;
}

export function bootId(): string {
  return hub().bootId;
}

function isIgnored(rel: string): boolean {
  const parts = rel.split("/");
  if (parts.some((p) => IGNORED_SEGMENTS.has(p))) return true;
  const base = parts[parts.length - 1];
  return !base || base.startsWith(".#") || IGNORED_FILE.test(base);
}

function record(rel: string, scope: LiveScope, eventType: string) {
  if (isIgnored(rel)) return;

  const h = hub();
  const exists = fs.existsSync(path.join(ROOT, rel));
  const kind: LiveEvent["kind"] = !exists
    ? "delete"
    : eventType === "rename"
      ? "add"
      : "change";

  // `fs.watch` fires for directories too; those carry no useful signal.
  if (exists) {
    try {
      if (fs.statSync(path.join(ROOT, rel)).isDirectory()) return;
    } catch {
      return;
    }
  }

  if (h.pending.size >= MAX_BATCH && !h.pending.has(rel)) {
    h.dropped++;
  } else {
    // Re-set so the latest kind/timestamp wins for a path touched twice.
    h.pending.set(rel, { id: ++h.seq, path: rel, kind, scope, at: Date.now() });
  }

  if (h.flushTimer) return;
  h.flushTimer = setTimeout(flush, FLUSH_MS);
  h.flushTimer.unref?.();
}

function flush() {
  const h = hub();
  h.flushTimer = null;
  if (!h.pending.size) return;

  const batch: LiveBatch = {
    events: [...h.pending.values()].sort((a, b) => a.id - b.id),
    dropped: h.dropped,
  };
  h.pending.clear();
  h.dropped = 0;

  for (const sub of h.subs) {
    try {
      sub(batch);
    } catch {
      // A dead stream must not take the watcher down with it.
    }
  }
}

function start() {
  const h = hub();
  if (h.watchers.length) return;

  for (const { dir, scope } of TREES) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    try {
      const w = fs.watch(abs, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        record(`${dir}/${filename.toString().split(path.sep).join("/")}`, scope, eventType);
      });
      w.on("error", () => {});
      h.watchers.push(w);
    } catch {
      // A watch limit or an unreadable tree is not fatal — skip that tree.
    }
  }

  // Root, non-recursive: config files only. Watching the root recursively would
  // pull in .next/ and node_modules/, which is exactly what we want to avoid.
  try {
    const w = fs.watch(ROOT, { recursive: false }, (eventType, filename) => {
      if (!filename) return;
      const base = filename.toString();
      if (!CONFIG_FILES.has(base)) return;
      record(base, "config", eventType);
    });
    w.on("error", () => {});
    h.watchers.push(w);
  } catch {
    // ignore
  }
}

function stop() {
  const h = hub();
  for (const w of h.watchers) {
    try {
      w.close();
    } catch {
      // ignore
    }
  }
  h.watchers = [];
  h.pending.clear();
  h.dropped = 0;
  if (h.flushTimer) {
    clearTimeout(h.flushTimer);
    h.flushTimer = null;
  }
}

/** Attach a listener; returns the detach function. Watchers start on first sub. */
export function subscribe(fn: Subscriber): () => void {
  const h = hub();
  if (h.stopTimer) {
    clearTimeout(h.stopTimer);
    h.stopTimer = null;
  }
  h.subs.add(fn);
  start();

  return () => {
    h.subs.delete(fn);
    if (h.subs.size || h.stopTimer) return;
    h.stopTimer = setTimeout(() => {
      h.stopTimer = null;
      if (!h.subs.size) stop();
    }, IDLE_STOP_MS);
    h.stopTimer.unref?.();
  };
}

/** What the client watches, for display in the overlay. */
export function watchedRoots(): string[] {
  return TREES.map((t) => t.dir);
}
