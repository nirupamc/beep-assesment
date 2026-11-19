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

function Badge({ children, muted }) {
  return (
    <span
      className={
        "inline-flex items-center rounded border px-2 py-0.5 text-xs " +
        (muted
          ? "border-border bg-subtle text-muted"
          : "border-border bg-subtle text-text")
      }
    >
      {children}
    </span>
  );
}

export default function JobCard({ job, sources }) {
  const sourceNames = (job.sources || [])
    .map((id) => (sources || []).find((s) => s.id === id)?.name || id)
    .filter(Boolean)
    .join(", ");

  const firstSeen = formatDate(job.first_seen);
  const posted = job.posted_at ? formatDate(job.posted_at) : null;

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="min-w-0">
        <p className="text-sm font-bold text-text">{job.company}</p>
        <h2 className="mt-0.5 text-base font-medium leading-snug text-text">
          {job.title}
        </h2>
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

      {sourceNames ? (
        <p className="text-xs text-muted">Source: {sourceNames}</p>
      ) : null}

      <div className="mt-auto flex items-center gap-3 pt-1">
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Apply
        </a>
        <a
          href={reportUrl(job)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted underline-offset-2 hover:underline"
        >
          Report
        </a>
      </div>
    </article>
  );
}
