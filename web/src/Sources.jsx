export default function Sources({ sources, refreshed }) {
  return (
    <section className="max-w-3xl space-y-6">
      <a
        href="#/"
        className="inline-flex min-h-10 items-center text-sm text-muted hover:text-text"
      >
        ← Back to listings
      </a>

      <div>
        <h1 className="text-xl font-semibold text-text">Sources &amp; credits</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Every listing comes from a public GitHub repository whose maintainers
          publish their data openly. We never scrape job boards or company career
          pages, and we show each source's licence and attribution below. If a
          source asks us to stop, we remove it.
        </p>
      </div>

      <ul className="space-y-3">
        {sources.map((s) => (
          <li
            key={s.id}
            className="rounded-md border border-border bg-surface p-4"
          >
            <h2 className="text-sm font-semibold text-text">{s.name}</h2>
            <dl className="mt-2 space-y-1 text-sm text-muted">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-text">Repo:</dt>
                <dd>
                  <a
                    className="text-link hover:underline"
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.repo}
                  </a>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-text">Licence:</dt>
                <dd>
                  {s.license_url ? (
                    <a
                      className="text-link hover:underline"
                      href={s.license_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.license}
                    </a>
                  ) : (
                    s.license
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-text">Credit:</dt>
                <dd>{s.attribution}</dd>
              </div>
              {s.notes ? (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-text">Note:</dt>
                  <dd>{s.notes}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>

      <section className="rounded-md border border-border bg-subtle p-4 text-sm text-muted">
        <h2 className="font-semibold text-text">Disclaimer</h2>
        <p className="mt-1 leading-relaxed">
          This is an unofficial, community-built aggregator. We do not own or
          verify these listings. Roles may have closed, changed location, or
          require experience beyond what a tracker assumed. Always confirm
          details on the company's own page before applying, and never pay
          anyone for a job or internship. Links go to the original posting.
        </p>
      </section>

      <p className="text-xs text-muted">
        {refreshed
          ? `Data refreshed ${refreshed}.`
          : "Refresh time unavailable."}
      </p>
    </section>
  );
}
