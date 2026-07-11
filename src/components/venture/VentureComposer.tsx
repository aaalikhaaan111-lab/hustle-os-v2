"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  VENTURE_CONTEXT_FIELDS,
  VENTURE_DESCRIPTION_MIN_LENGTH,
  VENTURE_EXAMPLE_PROMPTS,
} from "@/lib/constants";
import { createVentureAction } from "@/lib/actions/ventures";
import type { VentureContextFieldId } from "@/types/venture";

type ActiveFields = Partial<Record<VentureContextFieldId, string>>;

const TEXTAREA_MAX_HEIGHT = 320;

export function VentureComposer() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [description, setDescription] = useState("");
  const [activeFields, setActiveFields] = useState<ActiveFields>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, [description]);

  function revealField(id: VentureContextFieldId) {
    setActiveFields((prev) => ({ ...prev, [id]: prev[id] ?? "" }));
  }

  function removeField(id: VentureContextFieldId) {
    setActiveFields((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateField(id: VentureContextFieldId, value: string) {
    setActiveFields((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    const trimmed = description.trim();
    if (trimmed.length < VENTURE_DESCRIPTION_MIN_LENGTH) {
      setError("Add a bit more detail before you start building.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createVentureAction({
        description: trimmed,
        budget: activeFields.budget ?? "",
        deadline: activeFields.deadline ?? "",
        location: activeFields.location ?? "",
        resources: activeFields.resources ?? "",
      });
      // On success, createVentureAction redirects and this line is unreachable.
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function applyExample(example: string) {
    setDescription(example);
    setError(null);
    textareaRef.current?.focus();
  }

  const revealedFields = VENTURE_CONTEXT_FIELDS.filter((field) => field.id in activeFields);
  const availableFields = VENTURE_CONTEXT_FIELDS.filter((field) => !(field.id in activeFields));
  const hasText = description.trim().length > 0;

  return (
    <div className="flex flex-col items-center gap-10 py-4 sm:py-8">
      <div className="flex max-w-xl flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          What do you want to build?
        </h1>
        <p className="max-w-md text-sm text-ink-secondary sm:text-base">
          Describe an idea, a problem, a mission, or simply the result you want to create.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <div
          className={cn(
            "rounded-xl border bg-surface transition-colors duration-150",
            error ? "border-danger" : "border-border focus-within:border-accent"
          )}
        >
          <textarea
            ref={textareaRef}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isPending}
            placeholder="I want to build..."
            className="min-h-[120px] max-h-[320px] w-full resize-none overflow-y-auto bg-transparent px-5 pt-5 text-base text-ink placeholder:text-ink-muted focus:outline-none disabled:opacity-60 sm:text-lg"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-2">
            <span className="text-xs text-ink-muted">
              {hasText ? `${description.length} characters` : ""}
            </span>
            <Button onClick={handleSubmit} disabled={!hasText || isPending}>
              {isPending ? "Building venture..." : "Start building"}
            </Button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {!error && hasText && !isPending && (
          <p className="mt-2 text-xs text-ink-muted">⌘+Enter or Ctrl+Enter to start building</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {availableFields.map((field) => (
            <button
              key={field.id}
              type="button"
              onClick={() => revealField(field.id)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors duration-150 hover:border-border-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60"
            >
              <PlusIcon className="h-3 w-3" />
              Add {field.label.toLowerCase()}
            </button>
          ))}
        </div>

        {revealedFields.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {revealedFields.map((field) => (
              <div key={field.id} className="animate-field-in flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-medium text-ink-secondary">
                  {field.label}
                </span>
                <Input
                  type={field.type}
                  value={activeFields[field.id] ?? ""}
                  onChange={(event) => updateField(field.id, event.target.value)}
                  placeholder={field.placeholder}
                  disabled={isPending}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeField(field.id)}
                  disabled={isPending}
                  aria-label={`Remove ${field.label.toLowerCase()}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink disabled:opacity-60"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Or try an example
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {VENTURE_EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => applyExample(example)}
              disabled={isPending}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink-secondary transition-colors duration-150 hover:border-border-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60 sm:w-auto"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
