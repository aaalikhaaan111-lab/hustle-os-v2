import { SignupForm } from "@/components/auth/SignupForm";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function SignupPage() {
  return (
    <>
      <SignupForm />
      <div className="mx-auto w-[min(100%-2rem,1280px)]">
        <PublicFooter />
      </div>
    </>
  );
}
