import type { CSSProperties } from "react";
import type { Locale } from "@/i18n/locale";
import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";
import { OUTPUT_COPY } from "@/lib/publishing/copy";
import { PublicResponseForm } from "@/components/publishing/PublicResponseForm";

interface ProjectOutputRendererProps {
  projectKey: string;
  output: Stage3ProjectOutput;
  locale: Locale;
  mode?: "preview" | "public";
  slug?: string;
  revealKey?: number;
}

export function ProjectOutputRenderer({
  projectKey,
  output,
  locale,
  mode = "preview",
  slug,
  revealKey = 0,
}: ProjectOutputRendererProps) {
  const copy = OUTPUT_COPY[locale];
  const formId = `project-action-${projectKey}`;
  const style = {
    "--output-primary": output.visual.palette[0],
    "--output-secondary": output.visual.palette[1],
    "--output-dark": output.visual.palette[2],
  } as CSSProperties;

  return (
    <article key={revealKey} className={`project-output output-${output.preset}`} style={style} lang={locale}>
      <div className="project-output-ambient" aria-hidden />

      <header className="project-output-hero stage3-reveal-block">
        <div className="flex items-center justify-between gap-4">
          <span className="project-output-wordmark">{output.identity.name}</span>
          <span className="project-output-mood">{output.visual.mood}</span>
        </div>
        <div className="mt-20 max-w-3xl sm:mt-28">
          {output.hero.eyebrow && <p className="project-output-eyebrow">{output.hero.eyebrow}</p>}
          <h1 className="project-output-title">{output.hero.headline}</h1>
          <p className="project-output-subtitle">{output.hero.subheadline}</p>
          <a href={`#${formId}`} className="project-output-cta">
            {output.cta.label} <span aria-hidden>→</span>
          </a>
          <p className="mt-3 max-w-md text-xs leading-5 text-white/50">{output.cta.supportingText}</p>
        </div>
      </header>

      <section className="stage3-reveal-block project-output-intro">
        <div>
          <p className="project-output-kicker">{copy.identityLabel}</p>
          <h2>{output.identity.tagline}</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="project-output-kicker">{copy.targetUserLabel}</p>
            <p>{output.targetUser}</p>
          </div>
          <div>
            <p className="project-output-kicker">{copy.primaryValueLabel}</p>
            <p>{output.primaryValue}</p>
          </div>
        </div>
      </section>

      <div className="project-output-sections">
        {output.sections.map((section, sectionIndex) => (
          <section key={`${section.type}-${sectionIndex}`} className="stage3-reveal-block project-output-section" style={{ animationDelay: `${Math.min(sectionIndex + 2, 7) * 90}ms` }}>
            <p className="project-output-kicker">{String(sectionIndex + 1).padStart(2, "0")}</p>
            <h2>{section.title}</h2>
            <p className="project-output-section-body">{section.body}</p>
            {section.items.length > 0 && (
              <div className="project-output-items">
                {section.items.map((item, itemIndex) => (
                  <div key={`${item.title}-${itemIndex}`}>
                    <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <section id={formId} className="stage3-reveal-block project-output-action">
        <div>
          <p className="project-output-kicker">{copy.mainActionLabel}</p>
          <h2>{output.form.title}</h2>
          <p>{output.form.description}</p>
        </div>
        {mode === "public" && slug ? (
          <PublicResponseForm slug={slug} locale={locale} output={output} />
        ) : (
          <div className="project-output-form" aria-label={copy.previewConfirmation}>
            {output.form.fields.map((field) => (
              <label key={field.id}>
                <span>{field.label}{field.required ? " *" : ""}</span>
                {field.type === "textarea" ? (
                  <textarea rows={3} readOnly />
                ) : field.type === "select" ? (
                  <select defaultValue="" aria-disabled="true">
                    <option value="" disabled>{copy.selectPlaceholder}</option>
                    {field.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <input type={field.type} readOnly />
                )}
              </label>
            ))}
            <button type="button" aria-disabled="true">{output.form.submitLabel}</button>
            <p className="project-output-confirmation">{copy.previewConfirmation}</p>
          </div>
        )}
      </section>

      <section className="stage3-reveal-block project-output-launch">
        <p className="project-output-kicker">{copy.launchCopyLabel}</p>
        <h2>{output.launchCopy.headline}</h2>
        <p>{output.launchCopy.body}</p>
        <blockquote>{output.launchCopy.shortPost}</blockquote>
      </section>

      <footer className="project-output-footer">
        <span>{output.identity.name}</span>
        {mode === "public" ? (
          <a href="https://ventrio.org" target="_blank" rel="noreferrer">{copy.madeWith}</a>
        ) : (
          <span>{output.visual.styleNotes}</span>
        )}
      </footer>
    </article>
  );
}
