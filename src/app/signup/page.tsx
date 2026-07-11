"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { InfoIcon } from "@/components/ui/icons";
import { signupAction, type SignupActionState } from "@/lib/actions/auth";

const initialState: SignupActionState = { error: null, success: false };

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);

  if (state.success) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-5 py-16 text-center animate-page-in">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <InfoIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            We sent a confirmation link to finish creating your account.
          </p>
        </div>
        <Button href="/login" variant="secondary">
          Back to login
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-12 sm:py-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your account</h1>
        <p className="text-sm text-ink-secondary">Start turning missions into ventures.</p>
      </div>

      <Card>
        <CardContent className="py-5">
          <form action={formAction} className="flex flex-col gap-4">
            <Field label="Email" htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" htmlFor="password" required hint="At least 8 characters.">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="••••••••"
              />
            </Field>
            {state.error && <p className="text-sm text-danger">{state.error}</p>}
            <Button type="submit" disabled={isPending} className="mt-1">
              {isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-ink-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Log in
        </Link>
      </p>
    </div>
  );
}
