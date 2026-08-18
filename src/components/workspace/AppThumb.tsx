/**
 * A generated application's card.
 *
 * WHY THIS AND NOT THE APPLICATION ITSELF. An app is source, so the only true
 * picture of it is a running copy — and running one per card is exactly what
 * made the gallery slow, made cards appear at different moments, and cropped
 * a desktop layout into a corner. A stored render taken at generate time would
 * solve it properly; that is backend work and is not this pass.
 *
 * So the card shows what IS known instantly and IS true of this app and no
 * other: its own name and the routes it actually answers. Two apps are told
 * apart by looking at them, which is the job of a gallery, and nothing here is
 * a headline or a palette invented to resemble a page.
 *
 * Drawn at page scale inside `.s-thumb`, like every other card, so the gallery
 * keeps one aspect ratio and never reflows as things load.
 */
export function AppThumb({
  app,
}: {
  app: { name: string; description: string; routes: string[] };
}) {
  return (
    <div className="s-appthumb">
      {/* Window chrome, so the tile reads as an application rather than as a
          document — which is the one thing that distinguishes these projects
          from the page-shaped ones beside them. */}
      <div className="s-appthumb-bar">
        <span className="s-appthumb-dot" />
        <span className="s-appthumb-dot" />
        <span className="s-appthumb-dot" />
        <span className="s-appthumb-name">{app.name}</span>
      </div>
      <div className="s-appthumb-body">
        {/* The app's own one-line description — real metadata, and the thing
            that tells two apps apart fastest when both answer one route. */}
        {app.description && <p className="s-appthumb-desc">{app.description}</p>}
        <ul className="s-appthumb-routes">
          {app.routes.map((route, index) => (
            <li key={route} data-active={index === 0 ? "true" : undefined}>
              {route}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
