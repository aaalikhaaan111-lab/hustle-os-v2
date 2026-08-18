import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { DevAutoLoginButton } from "@/components/auth/DevAutoLoginButton";
import { PublicShell } from "@/components/public/PublicShell";

export default function LoginPage() {
  const showDevAutoLogin =
    process.env.NODE_ENV === "development" && process.env.DEV_AUTO_LOGIN_ENABLED === "true";

  return (
    <PublicShell>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      {showDevAutoLogin && <DevAutoLoginButton />}
    </PublicShell>
  );
}
