"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CloseIcon, InfoIcon, PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  VENTURE_CONTEXT_FIELDS,
  VENTURE_DESCRIPTION_MIN_LENGTH,
  VENTURE_DRAFT_STORAGE_KEY,
  VENTURE_EXAMPLE_PROMPTS,
} from "@/lib/constants";
import type { VentureContextFieldId, VentureDraft } from "@/types/venture";

type ActiveFields = Partial<Record<VentureContextFieldId, string>>;
type Phase = "composing" | "ready";

const TEXTAREA_MAX_HEIGHT = 320;

export function VentureComposer() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [description, setDescription] = useState("");
  const [activeFields, setActiveFields] = useState<ActiveFields>({});
  const [phase, setPhase] = useState<Phase>("composing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(VENTURE_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<VentureDraft>;
      // One-time restore from sessionStorage on mount, guarded so SSR/hydration
      // renders with the empty default before this client-only sync runs.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (draft.description) setDescription(draft.description);

      const restored: ActiveFields = {};
      for (const field of VENTURE_CONTEXT_FIELDS) {
        const value = draft[field.id];
        if (value) restored[field.id] = value;
      }
      setActiveFields(restored);
    } catch {
      // Ignore malformed or inaccessible session data.
    }
  }, []);

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
    setPhase("ready");
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

  function handleContinue() {
    const draft: VentureDraft = {
      description: description.trim(),
      budget: activeFields.budget?.trim() ?? "",
      deadline: activeFields.deadline?.trim() ?? "",
      location: activeFields.location?.trim() ?? "",
      resources: activeFields.resources?.trim() ?? "",
      createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem(VENTURE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    router.push("/ventures/preview");
  }

  if (phase === "ready") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center animate-page-in">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <InfoIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-ink">Your venture brief is ready.</h2>
          <p className="mt-2 text-sm text-ink-secondary">
            Venture creation will be connected in the next phase.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setPhase("composing")}>
            Edit brief
          </Button>
          <Button onClick={handleContinue}>Continue to preview</Button>
        </div>
      </div>
    );
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
            placeholder="I want to build..."
            className="min-h-[120px] max-h-[320px] w-full resize-none overflow-y-auto bg-transparent px-5 pt-5 text-base text-ink placeholder:text-ink-muted focus:outline-none sm:text-lg"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-2">
            <span className="text-xs text-ink-muted">
              {hasText ? `${description.length} characters` : ""}
            </span>
            <Button onClick={handleSubmit} disabled={!hasText}>
              Start building
            </Button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {!error && hasText && (
          <p className="mt-2 text-xs text-ink-muted">⌘+Enter or Ctrl+Enter to start building</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {availableFields.map((field) => (
            <button
              key={field.id}
              type="button"
              onClick={() => revealField(field.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors duration-150 hover:border-border-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeField(field.id)}
                  aria-label={`Remove ${field.label.toLowerCase()}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
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
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink-secondary transition-colors duration-150 hover:border-border-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:w-auto"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
