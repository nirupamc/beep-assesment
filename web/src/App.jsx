import { useEffect, useMemo, useState } from "react";
import JobCard from "./JobCard.jsx";
import Sources from "./Sources.jsx";
import { ThemeToggle, useTheme } from "./Theme.jsx";

const CITY_ORDER = [
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Delhi NCR",
  "Mumbai",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Kochi",
  "Chandigarh",
  "Coimbatore",
  "Indore",
  "Lucknow",
  "Bhubaneswar",
  "Surat",
  "Nagpur",
  "Vadodara",
  "Thiruvananthapuram",
  "Remote (India)",
  "Other India",
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
const TYPE_ORDER = ["Internship", "Fresher / New Grad", "Experienced", "Unspecified"];

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
  if (route.startsWith("#/sources")) return "sources";
  if (route.startsWith("#/about")) return "about";
  return "listings";
}

function typeLabel(type) {
  if (type === "Unspecified") return "Entry-level (unspecified)";
  return type;
}

function Chip({ active, children, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={
        "inline-flex min-h-10 items-center rounded border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
        (active
          ? "border-accent bg-accent text-white"
          : "border-border bg-surface text-text hover:border-muted")
      }
    >
      {children}
    </button>
  );
}

function ChipRow({ label, options, selected, onToggle, display }) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <span className="shrink-0 pt-2 text-xs font-semibold uppercase tracking-wide text-muted sm:w-12">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option}
            active={selected.includes(option)}
            onClick={() => onToggle(option)}
            ariaLabel={`${label}: ${display ? display(option) : option}`}
          >
            {display ? display(option) : option}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function About() {
  return (
    <section className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-text">About</h1>
      <p className="text-sm leading-relaxed text-muted">
        India Fresher Tech Radar is an unofficial, community-built aggregator of
        internship and fresher tech roles in India, sourced from public GitHub
        trackers. It is not affiliated with any company or tracker.
      </p>
      <p className="text-sm leading-relaxed text-muted">
        Listings may be stale or inaccurate. Always verify details on the
        company's own page before applying. Links go to the original posting.
        We never charge for access and never scrape job boards or company career
        pages.
      </p>
      <p className="text-sm">
        <a href="#/" className="text-link hover:underline">
          Back to listings
        </a>
      </p>
    </section>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <a href="#/" className="text-sm font-semibold tracking-tight text-text">
            India Fresher Tech Radar
          </a>
          <nav className="flex items-center gap-2">
            <a
              href="#/sources"
              className="inline-flex min-h-10 items-center px-2 text-sm text-muted hover:text-text"
            >
              Sources
            </a>
            <a
              href="#/about"
              className="inline-flex min-h-10 items-center px-2 text-sm text-muted hover:text-text"
            >
              About
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  const { theme } = useTheme();
  const [jobs, setJobs] = useState(null);
  const [sources, setSources] = useState([]);
  const [refreshed, setRefreshed] = useState(null);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState("");
  const [cities, setCities] = useState([]);
  const [roles, setRoles] = useState([]);
  const [types, setTypes] = useState([]);
  const [sort, setSort] = useState("newest");
  const [showExperienced, setShowExperienced] = useState(false);

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

  // keep html class in sync (provider already does, this is a no-op safety)
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

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

  const toggle = (setter) => (value) =>
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );

  const toggleType = (value) => {
    if (value === "Experienced") setShowExperienced(true);
    setTypes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = query.trim().toLowerCase();
    let list = jobs.filter((job) => {
      if (!showExperienced && job.experience_type === "Experienced") return false;
      if (
        q &&
        !job.company.toLowerCase().includes(q) &&
        !job.title.toLowerCase().includes(q)
      )
        return false;
      if (cities.length && !cities.includes(job.city)) return false;
      if (roles.length && !roles.includes(job.role_category)) return false;
      if (types.length && !types.includes(job.experience_type)) return false;
      return true;
    });
    if (sort === "company") {
      list = [...list].sort(
        (a, b) =>
          a.company.localeCompare(b.company) ||
          a.title.localeCompare(b.title),
      );
    } else {
      list = [...list].sort(
        (a, b) =>
          new Date(b.first_seen || 0).getTime() -
          new Date(a.first_seen || 0).getTime(),
      );
    }
    return list;
  }, [jobs, query, cities, roles, types, showExperienced, sort]);

  const hasFilters =
    query.trim() || cities.length || roles.length || types.length;

  const clearFilters = () => {
    setQuery("");
    setCities([]);
    setRoles([]);
    setTypes([]);
  };

  if (route === "sources") {
    return (
      <Shell>
        <Sources sources={sources} refreshed={formatIST(refreshed)} />
      </Shell>
    );
  }

  if (route === "about") {
    return (
      <Shell>
        <About />
      </Shell>
    );
  }

  return (
    <Shell>
      {error ? (
        <div className="rounded-md border border-danger bg-surface p-4 text-sm text-danger">
          Could not load listings: {error}. The last good data file may be
          missing — please try again later.
        </div>
      ) : null}

      {!error && jobs === null ? (
        <p className="text-sm text-muted">Loading listings…</p>
      ) : null}

      {jobs ? (
        <>
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-sm text-text">
              Last refreshed {formatIST(refreshed)} - Showing {filtered.length} of{" "}
              {jobs.length} roles
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
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="mt-4 space-y-3">
              <ChipRow
                label="City"
                options={available.cities}
                selected={cities}
                onToggle={toggle(setCities)}
              />
              <ChipRow
                label="Role"
                options={available.roles}
                selected={roles}
                onToggle={toggle(setRoles)}
              />
              <ChipRow
                label="Type"
                options={available.types}
                selected={types}
                onToggle={toggleType}
                display={typeLabel}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-10 items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={showExperienced}
                  onChange={(e) => setShowExperienced(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Show experienced roles
              </label>

              <label className="inline-flex min-h-10 items-center gap-2 text-sm text-muted">
                <span className="sr-only">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort roles"
                  className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="newest">Newest first</option>
                  <option value="company">Company A-Z</option>
                </select>
              </label>

              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-10 items-center text-sm text-muted underline-offset-2 hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-8 rounded-md border border-border bg-surface p-6 text-center">
              <p className="text-sm text-muted">
                No roles match these filters. Try removing a filter, broadening
                your search, or enabling experienced roles.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.map((job) => (
                <JobCard key={job.id} job={job} sources={sources} />
              ))}
            </div>
          )}

          <footer className="mt-10 border-t border-border pt-4 text-xs leading-relaxed text-muted">
            <p>
              Unofficial aggregator. Listings are copied from community trackers
              and may be outdated — always verify on the company site. We never
              charge for access and we never scrape job boards.
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
    </Shell>
  );
}
