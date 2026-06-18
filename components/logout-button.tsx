"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
  return (
    <button className="btn btn-ghost" onClick={logout} style={{ padding: "10px 16px" }}>
      <LogOut size={16} /> Sign out
    </button>
  );
}
