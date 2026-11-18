import { useEffect, useMemo, useState } from "react";
import JobCard from "./JobCard.jsx";
import Sources from "./Sources.jsx";

const CITY_ORDER = [
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Delhi NCR",
  "Mumbai",
  "Chennai",
  "Kolkata",
  "Remote (India)",
  "Multiple / Pan-India",
];
const ROLE_ORDER = [
  "Software Engineering",
  "AI / ML",
  "Data Science & Analytics",
  "Frontend",
  "Backend",
  "DevOps / Cloud",
  "Hardware / Embedded",
  "Product / Design",
  "Other",
];
const TYPE_ORDER = ["Internship", "Fresher / New Grad"];

function formatIST(iso) {
  if (!iso) return "unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  const text = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
  return `${text} IST`;
}

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route.startsWith("#/sources") ? "sources" : "listings";
}

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition " +
        (active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500")
      }
    >
      {children}
    </button>
  );
}

function ChipRow({ label, options, selected, onToggle }) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {options.map((option) => (
        <Chip
          key={option}
          active={selected.includes(option)}
          onClick={() => onToggle(option)}
        >
          {option}
        </Chip>
      ))}
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  const [jobs, setJobs] = useState(null);
  const [sources, setSources] = useState([]);
  const [refreshed, setRefreshed] = useState(null);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState("");
  const [cities, setCities] = useState([]);
  const [roles, setRoles] = useState([]);
  const [types, setTypes] = useState([]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}jobs.json`).then((r) => {
        if (!r.ok) throw new Error(`jobs.json (HTTP ${r.status})`);
        return r.json();
      }),
      fetch(`${base}sources.json`)
        .then((r) => (r.ok ? r.json() : { sources: [] }))
        .catch(() => ({ sources: [] })),
    ])
      .then(([jobsData, sourcesData]) => {
        const list = Array.isArray(jobsData) ? jobsData : jobsData.jobs || [];
        setJobs(list);
        setSources(sourcesData.sources || []);
        setRefreshed(sourcesData.last_refreshed || null);
      })
      .catch((err) => setError(err.message));
  }, []);

  const available = useMemo(() => {
    if (!jobs) return { cities: [], roles: [], types: [] };
    const present = (order, key) => {
      const values = new Set(jobs.map((job) => job[key]));
      return order.filter((value) => values.has(value));
    };
    return {
      cities: present(CITY_ORDER, "city"),
      roles: present(ROLE_ORDER, "role_category"),
      types: present(TYPE_ORDER, "experience_type"),
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (q && !job.company.toLowerCase().includes(q) &&
          !job.title.toLowerCase().includes(q)) return false;
      if (cities.length && !cities.includes(job.city)) return false;
      if (roles.length && !roles.includes(job.role_category)) return false;
      if (types.length && !types.includes(job.experience_type)) return false;
      return true;
    });
  }, [jobs, query, cities, roles, types]);

  const toggle = (setter) => (value) =>
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );

  const hasFilters = query || cities.length || roles.length || types.length;

  if (route === "sources") {
    return (
      <div className="min-h-screen">
        <Sources sources={sources} refreshed={formatIST(refreshed)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto w-full max-w-6xl px-4 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              India Fresher Tech Radar
            </h1>
            <a
              href="#/sources"
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Sources &amp; credits
            </a>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Internships and fresher roles in India, aggregated from public GitHub
            trackers. Refreshed daily.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        {error ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            Could not load listings: {error}. The last good data file may be
            missing — please try again later.
          </div>
        ) : null}

        {!error && jobs === null ? (
          <p className="text-sm text-slate-500">Loading listings…</p>
        ) : null}

        {jobs ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Last refreshed: {formatIST(refreshed)}
                <span className="mx-2 text-slate-300 dark:text-slate-700">·</span>
                Showing {filtered.length} live{" "}
                {filtered.length === 1 ? "role" : "roles"}
                {filtered.length !== jobs.length ? ` of ${jobs.length}` : ""}
              </p>

              <div className="mt-3">
                <label htmlFor="search" className="sr-only">
                  Search by company or title
                </label>
                <input
                  id="search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search company or role…"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-indigo-900"
                />
              </div>

              <div className="mt-4 space-y-3">
                <ChipRow label="City" options={available.cities} selected={cities}
                  onToggle={toggle(setCities)} />
                <ChipRow label="Role" options={available.roles} selected={roles}
                  onToggle={toggle(setRoles)} />
                <ChipRow label="Type" options={available.types} selected={types}
                  onToggle={toggle(setTypes)} />
              </div>

              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCities([]);
                    setRoles([]);
                    setTypes([]);
                  }}
                  className="mt-3 text-xs font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No roles match these filters. Try removing one.
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}

            <footer className="mt-10 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-500">
              <p>
                Unofficial aggregator. Listings are copied from community
                trackers and may be outdated — always verify on the company site.
                We never charge for access and we never scrape job boards.
              </p>
              <p className="mt-1">
                <a className="underline underline-offset-2" href="#/sources">
                  Sources, licences and credits
                </a>
                {" · "}
                <a
                  className="underline underline-offset-2"
                  href={`https://github.com/${
                    import.meta.env.VITE_GITHUB_REPO ||
                    "your-username/india-fresher-tech-radar"
                  }/issues/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Report a problem
                </a>
              </p>
            </footer>
          </>
        ) : null}
      </main>
    </div>
  );
}
