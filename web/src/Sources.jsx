export default function Sources({ sources, refreshed }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <a
        href="#/"
        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← Back to listings
      </a>

      <h1 className="mt-4 text-2xl font-bold">Sources &amp; credits</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Every listing here comes from a public GitHub repository whose
        maintainers publish their data openly. We never scrape job boards or
        company career pages, and we show each source's licence and attribution
        below. If a source asks us to stop, we remove it.
      </p>

      <ul className="mt-6 space-y-4">
        {sources.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="font-semibold">{s.name}</h2>
            <dl className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-slate-700 dark:text-slate-300">Repo:</dt>
                <dd>
                  <a
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.repo}
                  </a>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-slate-700 dark:text-slate-300">Licence:</dt>
                <dd>{s.license}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-slate-700 dark:text-slate-300">Credit:</dt>
                <dd>{s.attribution}</dd>
              </div>
              {s.notes ? (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Note:</dt>
                  <dd>{s.notes}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <h2 className="font-semibold">Disclaimer</h2>
        <p className="mt-1 leading-relaxed">
          This is an unofficial, community-built aggregator. We do not own or
          verify these listings. Roles may have closed, changed location, or
          require experience beyond what a tracker assumed. Always confirm
          details on the company's own page before applying, and never pay
          anyone for a job or internship.
        </p>
      </section>

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
        {refreshed
          ? `Data refreshed ${refreshed}.`
          : "Refresh time unavailable."}
      </p>
    </main>
  );
}
