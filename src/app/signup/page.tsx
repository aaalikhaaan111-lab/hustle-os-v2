import { SignupForm } from "@/components/auth/SignupForm";
import { PublicShell } from "@/components/public/PublicShell";

export default function SignupPage() {
  return (
    <PublicShell>
      <SignupForm />
    </PublicShell>
  );
}
