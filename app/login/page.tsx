import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in — LoadSprint",
  description: "Sign in to your LoadSprint account.",
};

export default function LoginPage() {
  return (
    <AuthShell premium>
      <LoginForm />
    </AuthShell>
  );
}
