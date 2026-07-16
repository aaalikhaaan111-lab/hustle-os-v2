import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { DevAutoLoginButton } from "@/components/auth/DevAutoLoginButton";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function LoginPage() {
  const showDevAutoLogin =
    process.env.NODE_ENV === "development" && process.env.DEV_AUTO_LOGIN_ENABLED === "true";

  return (
    <>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      {showDevAutoLogin && <DevAutoLoginButton />}
      <div className="mx-auto w-full max-w-sm">
        <PublicFooter />
      </div>
    </>
  );
}
