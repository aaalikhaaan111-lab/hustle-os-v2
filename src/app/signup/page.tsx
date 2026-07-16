import { SignupForm } from "@/components/auth/SignupForm";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function SignupPage() {
  return (
    <>
      <SignupForm />
      <div className="mx-auto w-full max-w-sm">
        <PublicFooter />
      </div>
    </>
  );
}
