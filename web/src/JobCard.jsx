const REPO = import.meta.env.VITE_GITHUB_REPO || "your-username/india-fresher-tech-radar";

function reportUrl(job) {
  const title = encodeURIComponent(`Problem with listing: ${job.company} — ${job.title}`);
  const body = encodeURIComponent(
    [
      `Listing id: ${job.id}`,
      `Company: ${job.company}`,
      `Title: ${job.title}`,
      `Location: ${job.location_raw}`,
      `Apply URL: ${job.apply_url}`,
      "",
      "What is wrong? (expired / wrong location / not a fresher role / other)",
    ].join("\n"),
  );
  return `https://github.com/${REPO}/issues/new?title=${title}&body=${body}`;
}

function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  }).format(date);
}

function typeLabel(type) {
  if (type === "Unspecified") return "Entry-level (unspecified)";
  return type;
}

function initials(company) {
  const parts = String(company || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Badge({ children, muted }) {
  return (
    <span
      className={
        "inline-flex items-center rounded border px-2 py-0.5 text-xs " +
        (muted ? "border-border bg-subtle text-muted" : "border-border bg-subtle text-text")
      }
    >
      {children}
    </span>
  );
}

export default function JobCard({
  job,
  sources,
  isNew,
  saved,
  applied,
  onSave,
  onHide,
  onToggleApplied,
}) {
  const sourceNames = (job.sources || [])
    .map((id) => (sources || []).find((s) => s.id === id)?.name || id)
    .filter(Boolean)
    .join(", ");

  const firstSeen = formatDate(job.first_seen);
  const posted = job.posted_at ? formatDate(job.posted_at) : null;

  return (
    <article className="group flex flex-col gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-muted">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-xs font-semibold text-muted"
          aria-hidden="true"
        >
          {initials(job.company)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">{job.company}</p>
          <h2 className="mt-0.5 text-base font-semibold leading-snug text-text">
            {job.title}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {isNew ? (
            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              New
            </span>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            aria-label={saved ? "Unsave job" : "Save job"}
            aria-pressed={saved}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-muted hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 2.5A1.5 1.5 0 014.5 1h7A1.5 1.5 0 0113 2.5v12l-5-3-5 3v-12z"
                fill={saved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge>{job.city}</Badge>
        <Badge>{job.role_category}</Badge>
        <Badge muted={job.experience_type === "Experienced"}>
          {typeLabel(job.experience_type)}
        </Badge>
      </div>

      <p className="text-xs text-muted">
        First seen {firstSeen || "—"}
        {posted ? ` · Posted ${posted}` : ""}
      </p>

      {sourceNames ? <p className="text-xs text-muted">Source: {sourceNames}</p> : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center rounded-md border border-accent px-4 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-white focus-visible:bg-accent focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Apply
        </a>
        <button
          type="button"
          onClick={onToggleApplied}
          aria-pressed={applied}
          className={
            "inline-flex min-h-10 items-center rounded-md border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
            (applied
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-muted hover:text-text")
          }
        >
          {applied ? "Applied" : "Mark applied"}
        </button>
        <button
          type="button"
          onClick={onHide}
          className="inline-flex min-h-10 items-center text-xs text-muted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Hide
        </button>
        <a
          href={reportUrl(job)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-muted underline-offset-2 hover:underline"
        >
          Report
        </a>
      </div>
    </article>
  );
}
