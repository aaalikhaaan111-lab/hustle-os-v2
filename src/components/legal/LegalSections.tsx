interface LegalSection {
  title: string;
  body: string;
}

/**
 * The body of a legal document, in the public site's prose style.
 *
 * It used to carry its own Tailwind type scale, which is how the legal pages
 * ended up reading at a different size from every other page on the site. The
 * measure, the leading and the heading rhythm now come from `.lp-prose`, so
 * changing the site's reading style changes these too.
 */
export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="lp-prose">
      {sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p style={{ whiteSpace: "pre-line" }}>{section.body}</p>
        </section>
      ))}
    </div>
  );
}
