import type { CSSProperties } from "react";
import type { Locale } from "@/i18n/locale";
import type { Stage3ProjectOutput, Stage3Section } from "@/lib/build/stage3Types";
import { OUTPUT_COPY } from "@/lib/publishing/copy";
import { PublicResponseForm } from "@/components/publishing/PublicResponseForm";
import { ExperienceRenderer } from "@/components/build/ExperienceRenderer";
import { ParallaxAmbient, ScrollReveal } from "@/components/build/ScrollReveal";

interface ProjectOutputRendererProps {
  projectKey: string;
  output: Stage3ProjectOutput;
  locale: Locale;
  mode?: "preview" | "public";
  slug?: string;
  revealKey?: number;
}

function VisualPlaceholder({ prompt, label }: { prompt: string; label: string }) {
  if (!prompt) return null;
  return (
    <div className="project-output-visual-placeholder">
      <span className="project-output-visual-placeholder-icon" aria-hidden>◆</span>
      <span className="project-output-visual-placeholder-tag">{label}</span>
      <p>{prompt}</p>
    </div>
  );
}

function HeroVisual({ hero, copy }: { hero: Stage3ProjectOutput["hero"]; copy: Record<string, string> }) {
  if (hero.visualKind === "stat") {
    const [value, ...rest] = hero.visualPrompt.split("→").map((part) => part.trim());
    const label = rest.join("→") || hero.visualPrompt;
    return (
      <div className="project-output-hero-visual project-output-hero-visual-stat">
        <span className="project-output-stat-value">{value || hero.visualPrompt}</span>
        {rest.length > 0 && <span className="project-output-stat-label">{label}</span>}
      </div>
    );
  }
  if (hero.visualKind === "mockup") {
    return (
      <div className="project-output-hero-visual project-output-hero-visual-mockup">
        <div className="project-output-mockup-chrome"><span /><span /><span /></div>
        <div className="project-output-mockup-body">
          <div className="project-output-mockup-line project-output-mockup-line-wide" />
          <div className="project-output-mockup-line" />
          <div className="project-output-mockup-line project-output-mockup-line-short" />
          {hero.visualPrompt && <p className="project-output-mockup-caption">{hero.visualPrompt}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="project-output-hero-visual project-output-hero-visual-image">
      <span className="project-output-visual-placeholder-icon" aria-hidden>◆</span>
      <span className="project-output-visual-placeholder-tag">{copy.imageLabel}</span>
      {hero.visualPrompt && <p>{hero.visualPrompt}</p>}
    </div>
  );
}

function SectionView({
  section,
  index,
  projectKey,
  locale,
  mode,
}: {
  section: Stage3Section;
  index: number;
  projectKey: string;
  locale: Locale;
  mode: "preview" | "public";
}) {
  const kicker = String(index + 1).padStart(2, "0");
  const copy = OUTPUT_COPY[locale];

  if (section.kind === "showcase") {
    return (
      <section className="project-output-section project-output-section-showcase">
        <p className="project-output-kicker">{kicker}</p>
        <h2>{section.title}</h2>
        <p className="project-output-section-body">{section.body}</p>
        <div className="project-output-items">
          {section.items.map((item, itemIndex) => (
            <div key={`${item.title}-${itemIndex}`}>
              {item.visualPrompt && <VisualPlaceholder prompt={item.visualPrompt} label={copy.imageLabel} />}
              <span>{String(itemIndex + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section.kind === "stats") {
    return (
      <section className="project-output-section project-output-section-stats">
        <p className="project-output-kicker">{kicker}</p>
        <h2>{section.title}</h2>
        <p className="project-output-section-body">{section.body}</p>
        <div className="project-output-stats-row">
          {section.stats.map((stat, statIndex) => (
            <div key={`${stat.label}-${statIndex}`}>
              <span className="project-output-stat-value">{stat.value}</span>
              <span className="project-output-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section.kind === "process") {
    return (
      <section className="project-output-section project-output-section-process">
        <p className="project-output-kicker">{kicker}</p>
        <h2>{section.title}</h2>
        <p className="project-output-section-body">{section.body}</p>
        <ol className="project-output-process-list">
          {section.steps.map((step, stepIndex) => (
            <li key={`${step.title}-${stepIndex}`}>
              <span>{String(stepIndex + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (section.kind === "compare") {
    return (
      <section className="project-output-section project-output-section-compare">
        <p className="project-output-kicker">{kicker}</p>
        <h2>{section.title}</h2>
        <p className="project-output-section-body">{section.body}</p>
        <div className="project-output-compare-grid">
          <div>
            <span className="project-output-kicker">{section.leftLabel}</span>
            <p>{section.leftBody}</p>
          </div>
          <div>
            <span className="project-output-kicker">{section.rightLabel}</span>
            <p>{section.rightBody}</p>
          </div>
        </div>
      </section>
    );
  }

  if (section.kind === "interactive") {
    return (
      <section className="project-output-section project-output-section-interactive">
        <p className="project-output-kicker">{kicker}</p>
        <h2>{section.title}</h2>
        <p className="project-output-section-body">{section.body}</p>
        <div className="project-output-interactive-wrap">
          <ExperienceRenderer projectId={projectKey} experience={section.experience} locale={locale} mode={mode} />
        </div>
      </section>
    );
  }

  return (
    <section className="project-output-section">
      <p className="project-output-kicker">{kicker}</p>
      <h2>{section.title}</h2>
      <p className="project-output-section-body">{section.body}</p>
    </section>
  );
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
    <article
      key={revealKey}
      className={`project-output output-${output.preset} output-theme-${output.visual.theme}`}
      style={style}
      lang={locale}
    >
      <ParallaxAmbient />

      <header className="project-output-hero stage3-reveal-block">
        <div className="flex items-center justify-between gap-4">
          <span className="project-output-wordmark">{output.identity.name}</span>
          <span className="project-output-mood">{output.visual.mood}</span>
        </div>
        <div className="project-output-hero-layout">
          <div className="project-output-hero-text">
            {output.hero.eyebrow && <p className="project-output-eyebrow">{output.hero.eyebrow}</p>}
            <h1 className="project-output-title">{output.hero.headline}</h1>
            <p className="project-output-subtitle">{output.hero.subheadline}</p>
            <a href={`#${formId}`} className="project-output-cta">
              {output.cta.label} <span aria-hidden>→</span>
            </a>
          </div>
          <HeroVisual hero={output.hero} copy={copy} />
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
        {output.sections.map((section, index) => (
          <ScrollReveal key={`${section.kind}-${index}`}>
            <SectionView section={section} index={index} projectKey={projectKey} locale={locale} mode={mode} />
          </ScrollReveal>
        ))}
      </div>

      <section id={formId} className="stage3-reveal-block project-output-action">
        <div>
          <p className="project-output-kicker">{copy.mainActionLabel}</p>
          <h2>{output.form.title}</h2>
          <p>{output.form.description}</p>
          <p className="project-output-cta-supporting">{output.cta.supportingText}</p>
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
