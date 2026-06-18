import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Create account — LoadSprint",
  description: "Register as a broker or dispatcher on LoadSprint.",
};

export default function RegisterPage() {
  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}
