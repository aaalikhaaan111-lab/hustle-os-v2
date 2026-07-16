interface LegalSection {
  title: string;
  body: string;
}

export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-2">
          <h2 className="text-base font-bold tracking-tight text-ink">{section.title}</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-secondary">
            {section.body}
          </p>
        </div>
      ))}
    </div>
  );
}
