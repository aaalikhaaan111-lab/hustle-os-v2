"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { loginAction, type AuthActionState } from "@/lib/actions/auth";

const initialState: AuthActionState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const displayError = state.error || oauthError;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-12 sm:py-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
        <p className="text-sm text-ink-secondary">Log in to continue your daily challenge.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <GoogleSignInButton label="Continue with Google" />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-ink-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

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
            <Field label="Password" htmlFor="password" required>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </Field>
            {displayError && <p className="text-sm text-danger">{displayError}</p>}
            <Button type="submit" disabled={isPending} className="mt-1">
              {isPending ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-ink-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-accent hover:text-accent-hover">
          Sign up
        </Link>
      </p>
    </div>
  );
}
