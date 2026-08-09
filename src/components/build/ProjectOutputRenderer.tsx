import type { CSSProperties } from "react";
import type { Locale } from "@/i18n/locale";
import type { Stage3ProjectOutput, Stage3Section } from "@/lib/build/stage3Types";
import { OUTPUT_COPY } from "@/lib/publishing/copy";
import { resolveMedia } from "@/lib/build/mediaAssets";
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

/**
 * The described visual, set as type rather than framed as a fake image.
 *
 * This used to draw a bordered box with a diamond glyph and the word "image" —
 * a placeholder presented as finished content, on every showcase card of every
 * project. Until real image generation exists, describing the subject honestly
 * beats a slot that looks like a picture failed to load.
 */
/**
 * The project's image, in the treatment its direction calls for.
 *
 * The id is resolved against a registry Ventrio owns — a model-authored string
 * can only ever be a key, never a URL — and when there is no asset this renders
 * nothing at all rather than reserving an empty column.
 */
function ProjectMedia({ design }: { design: Stage3ProjectOutput["design"] }) {
  const asset = resolveMedia(design.mediaAsset);
  if (!asset || design.mediaTreatment === "none") return null;
  return (
    <figure className={`project-output-media project-output-media-${design.mediaTreatment}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.src} alt={asset.alt} loading="lazy" decoding="async" />
    </figure>
  );
}

function VisualPlaceholder({ prompt, label }: { prompt: string; label: string }) {
  if (!prompt) return null;
  return (
    <div className="project-output-visual-placeholder">
      <span className="project-output-visual-placeholder-tag">{label}</span>
      <p>{prompt}</p>
    </div>
  );
}

function HeroVisual({
  hero,
  copy,
  design,
}: {
  hero: Stage3ProjectOutput["hero"];
  copy: Record<string, string>;
  design: Stage3ProjectOutput["design"];
}) {
  // "No image" is a real answer, not a missing one. The old renderer always
  // drew something on the right of the headline, and when there was nothing to
  // draw it drew a bordered box with a diamond glyph and the word "image" —
  // a placeholder presented as if it were finished content, identically on
  // every project. A page with no image at all is better than that.
  if (design.imageryStrategy === "none") return null;


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
  // Typographic: the described subject is *set*, not framed. No border, no
  // icon, nothing pretending to be a photograph that has not been made.
  if (design.imageryStrategy === "typographic" || !hero.visualPrompt) {
    return (
      <div className="project-output-hero-visual project-output-hero-visual-type">
        <p className="project-output-hero-visual-line">{hero.visualPrompt || hero.eyebrow || hero.subheadline}</p>
      </div>
    );
  }
  // Abstract or photographic: a composed field that reads as deliberate art
  // direction rather than a slot waiting for an upload. It still carries the
  // description, so nothing about the intent is lost.
  return (
    <div className="project-output-hero-visual project-output-hero-visual-image">
      <span className="project-output-visual-placeholder-tag">{copy.imageLabel}</span>
      <p>{hero.visualPrompt}</p>
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
  // The design decisions taken for this project. Sanitized on read, so an
  // artifact generated before the strategy existed still renders.
  const design = output.design;
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
      // Every design decision reaches the stylesheet as an attribute, so the
      // same components compose into materially different pages instead of one
      // template wearing different colours.
      data-art-direction={design.artDirection}
      data-type-system={design.typeSystem}
      data-surface={design.surface}
      data-graphic={design.graphic}
      data-rhythm={design.rhythm}
      data-media={design.mediaTreatment}
      data-motion-vocab={design.motion}
      data-archetype={design.archetype}
      data-hero={design.heroComposition}
      data-type-scale={design.typeScale}
      data-density={design.density}
      data-grid={design.grid}
      data-cards={design.cardTreatment}
      data-corners={design.cornerStyle}
      data-color-logic={design.colorLogic}
      data-imagery={design.imageryStrategy}
      data-motion={design.motionLevel}
      data-cta={design.ctaPattern}
      data-nav={design.navModel}
      style={style}
      lang={locale}
    >
      {design.motionLevel !== "still" && <ParallaxAmbient />}
      {(design.mediaTreatment === "background" || design.mediaTreatment === "full_bleed") && (
        <ProjectMedia design={design} />
      )}

      <header className="project-output-hero stage3-reveal-block">
        {design.navModel !== "none" && (
          <div className="project-output-nav">
            <span className="project-output-wordmark">{output.identity.name}</span>
            {design.navModel === "anchors" && (
              <nav className="project-output-anchors" aria-label={output.identity.name}>
                <a href={`#${formId}`}>{output.cta.label}</a>
              </nav>
            )}
          </div>
        )}
        <div className="project-output-hero-layout">
          <div className="project-output-hero-text">
            {output.hero.eyebrow && <p className="project-output-eyebrow">{output.hero.eyebrow}</p>}
            <h1 className="project-output-title">{output.hero.headline}</h1>
            <p className="project-output-subtitle">{output.hero.subheadline}</p>
            {design.ctaPattern !== "section_end" && (
              <a href={`#${formId}`} className="project-output-cta">
                {output.cta.label} <span aria-hidden>→</span>
              </a>
            )}
          </div>
          {/* Compositions that are typographic by definition carry no visual
              beside the headline; rendering one anyway is what produced the
              same split-screen hero on every project. */}
          {/* A real asset takes the place beside the headline when the
              direction splits or frames it; the typographic fallback is only
              for directions with no media at all. */}
          {(design.mediaTreatment === "split" || design.mediaTreatment === "framed"
            || design.mediaTreatment === "editorial_crop" || design.mediaTreatment === "collage") ? (
            <ProjectMedia design={design} />
          ) : (
            design.heroComposition !== "editorial_lede" && design.heroComposition !== "full_bleed_type" && (
              <HeroVisual hero={output.hero} copy={copy} design={design} />
            )
          )}
        </div>
      </header>

      {design.showIdentityBlock && (
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
      )}

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

      {design.showLaunchBlock && (
      <section className="stage3-reveal-block project-output-launch">
        <p className="project-output-kicker">{copy.launchCopyLabel}</p>
        <h2>{output.launchCopy.headline}</h2>
        <p>{output.launchCopy.body}</p>
        <blockquote>{output.launchCopy.shortPost}</blockquote>
      </section>
      )}

      <footer className="project-output-footer">
        <span>{output.identity.name}</span>
        {mode === "public" ? (
          <a href="https://ventrio.org" target="_blank" rel="noreferrer">{copy.madeWith}</a>
        ) : (
          <span>{output.identity.tagline}</span>
        )}
      </footer>
    </article>
  );
}
