import type { AccountRole } from "@/lib/auth";

// /dashboard is a dispatcher page that bounces admins to /admin and everyone
// else to /loads. Point links straight at the role's real landing page so
// signed-in visitors don't watch two redirects go by.
export function homeHref(role?: AccountRole) {
  if (role === "admin") return "/admin";
  if (role && role !== "dispatcher") return "/loads";
  return "/dashboard";
}
