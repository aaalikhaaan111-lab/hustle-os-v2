"use client";

import { useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/locale";
import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";
import { OUTPUT_COPY } from "@/lib/publishing/copy";

interface PublicResponseFormProps {
  slug: string;
  locale: Locale;
  output: Stage3ProjectOutput;
}

type SubmitState = "idle" | "submitting" | "accepted" | "invalid" | "rate_limited" | "unavailable";

function confirmation(output: Stage3ProjectOutput, locale: Locale): string {
  const copy = OUTPUT_COPY[locale];
  if (output.preset === "community_social") return copy.acceptedCommunity;
  if (output.preset === "service") return copy.acceptedService;
  if (output.preset === "content_media") return copy.acceptedContent;
  return copy.acceptedProduct;
}

export function PublicResponseForm({ slug, locale, output }: PublicResponseFormProps) {
  const copy = OUTPUT_COPY[locale];
  const [state, setState] = useState<SubmitState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting" || state === "accepted") return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setState("submitting");

    const data = new FormData(form);
    const values: Record<string, string> = {};
    for (const field of output.form.fields) {
      const value = data.get(field.id);
      if (typeof value === "string") values[field.id] = value;
    }

    try {
      const result = await fetch(`/api/public/projects/${encodeURIComponent(slug)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, website: String(data.get("website") ?? "") }),
      });
      const body = await result.json().catch(() => null) as { status?: string } | null;
      if (result.ok && body?.status === "accepted") {
        form.reset();
        setState("accepted");
      } else if (body?.status === "rate_limited") {
        setState("rate_limited");
      } else if (body?.status === "invalid") {
        setState("invalid");
      } else {
        setState("unavailable");
      }
    } catch {
      setState("unavailable");
    }
  }

  return (
    <form onSubmit={submit} className="project-output-form">
      <div className="public-form-honeypot" aria-hidden="true">
        <label htmlFor={`website-${slug}`}>Website</label>
        <input id={`website-${slug}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {output.form.fields.map((field) => (
        <label key={field.id}>
          <span>{field.label}{field.required ? " *" : ""}</span>
          {field.type === "textarea" ? (
            <textarea name={field.id} required={field.required} rows={4} maxLength={2000} />
          ) : field.type === "select" ? (
            <select name={field.id} required={field.required} defaultValue="">
              <option value="" disabled>{copy.selectPlaceholder}</option>
              {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : (
            <input
              name={field.id}
              type={field.type}
              required={field.required}
              maxLength={field.type === "email" ? 254 : 320}
              autoComplete={field.type === "email" ? "email" : field.id.toLowerCase().includes("name") ? "name" : "off"}
            />
          )}
        </label>
      ))}
      <button type="submit" disabled={state === "submitting" || state === "accepted"}>
        {state === "submitting" ? copy.submitting : output.form.submitLabel}
      </button>
      <div className="min-h-5" aria-live="polite">
        {state === "accepted" && <p role="status" className="project-output-confirmation">{confirmation(output, locale)}</p>}
        {state === "invalid" && <p role="alert" className="project-output-form-error">{copy.invalid}</p>}
        {state === "rate_limited" && <p role="alert" className="project-output-form-error">{copy.rateLimited}</p>}
        {state === "unavailable" && <p role="alert" className="project-output-form-error">{copy.unavailable}</p>}
      </div>
    </form>
  );
}
