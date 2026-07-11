"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { InfoIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CURRENCIES } from "@/lib/constants";
import type { VentureBrief } from "@/types/venture";

const EMPTY_BRIEF: VentureBrief = {
  mission: "",
  targetAudience: "",
  location: "",
  deadline: "",
  budget: "",
  currency: "USD",
  resources: "",
  desiredFirstResult: "",
};

type FieldErrors = Partial<Record<keyof VentureBrief, string>>;

const REQUIRED_MESSAGE = "This field is required.";

export function VentureBriefForm() {
  const [brief, setBrief] = useState<VentureBrief>(EMPTY_BRIEF);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  function updateField<K extends keyof VentureBrief>(key: K, value: VentureBrief[K]) {
    setBrief((prev) => ({ ...prev, [key]: value }));
    setSubmitted(false);
  }

  function validate(): FieldErrors {
    const nextErrors: FieldErrors = {};
    (Object.keys(EMPTY_BRIEF) as (keyof VentureBrief)[]).forEach((key) => {
      if (!brief[key] || !brief[key].trim()) {
        nextErrors[key] = REQUIRED_MESSAGE;
      }
    });
    if (brief.budget && Number(brief.budget) < 0) {
      nextErrors.budget = "Budget cannot be negative.";
    }
    return nextErrors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitted(Object.keys(nextErrors).length === 0);
  }

  function handleReset() {
    setBrief(EMPTY_BRIEF);
    setErrors({});
    setSubmitted(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {submitted && (
        <Card className="border-accent/30 bg-accent-soft/40">
          <CardContent className="flex gap-3 py-4">
            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-medium text-ink">Brief captured — not yet saved</p>
              <p className="mt-1 text-sm text-ink-secondary">
                Persistence isn&apos;t connected yet. This venture brief will be saved
                automatically once backend integration is completed in the next phase.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-5">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <Field
              label="Mission"
              htmlFor="mission"
              required
              error={errors.mission}
              hint="What are you building, for whom, and why does it matter?"
            >
              <Textarea
                id="mission"
                rows={4}
                value={brief.mission}
                onChange={(e) => updateField("mission", e.target.value)}
                placeholder="Describe the mission in a few sentences."
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Target audience"
                htmlFor="targetAudience"
                required
                error={errors.targetAudience}
              >
                <Input
                  id="targetAudience"
                  value={brief.targetAudience}
                  onChange={(e) => updateField("targetAudience", e.target.value)}
                  placeholder="Who is this for, specifically?"
                />
              </Field>
              <Field label="Location" htmlFor="location" required error={errors.location}>
                <Input
                  id="location"
                  value={brief.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="City, country, or remote"
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Deadline" htmlFor="deadline" required error={errors.deadline}>
                <Input
                  id="deadline"
                  type="date"
                  value={brief.deadline}
                  onChange={(e) => updateField("deadline", e.target.value)}
                />
              </Field>
              <Field label="Budget" htmlFor="budget" required error={errors.budget}>
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={brief.budget}
                  onChange={(e) => updateField("budget", e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Currency" htmlFor="currency" required error={errors.currency}>
                <Select
                  id="currency"
                  value={brief.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Available resources"
              htmlFor="resources"
              required
              error={errors.resources}
              hint="Time, money, skills, network — whatever you can put to work now."
            >
              <Textarea
                id="resources"
                rows={3}
                value={brief.resources}
                onChange={(e) => updateField("resources", e.target.value)}
                placeholder="List what you have available."
              />
            </Field>

            <Field
              label="Desired first result"
              htmlFor="desiredFirstResult"
              required
              error={errors.desiredFirstResult}
              hint="What does a real, measurable first win look like?"
            >
              <Textarea
                id="desiredFirstResult"
                rows={3}
                value={brief.desiredFirstResult}
                onChange={(e) => updateField("desiredFirstResult", e.target.value)}
                placeholder="Describe the first meaningful outcome."
              />
            </Field>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Badge variant="muted">Frontend only — nothing is saved yet</Badge>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={handleReset}>
                  Clear
                </Button>
                <Button type="submit" variant="primary">
                  Review venture brief
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
