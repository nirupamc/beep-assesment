// Set VITE_GITHUB_REPO at build time (e.g. "you/india-fresher-tech-radar") so
// "Report a problem" opens an issue in this project rather than nowhere.
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
  return `${REPO}/issues/new?title=${title}&body=${body}`;
}

export default function JobCard({ job }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug">{job.title}</h2>
          <p className="mt-0.5 truncate text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {job.company}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {job.experience_type}
        </span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {job.city}
        <span className="text-slate-400 dark:text-slate-500">
          {" · "}
          {job.location_raw}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
          {job.role_category}
        </span>
        {job.posted_at ? <span>Posted {job.posted_at.slice(0, 10)}</span> : null}
      </div>

      <div className="mt-auto flex items-center gap-3 pt-1">
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Apply
        </a>
        <a
          href={reportUrl(job)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
        >
          Report a problem
        </a>
      </div>
    </article>
  );
}
