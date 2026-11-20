import { useEffect, useMemo, useRef, useState } from "react";
import JobCard from "./JobCard.jsx";
import Sources from "./Sources.jsx";
import { ThemeToggle, useTheme } from "./Theme.jsx";

const CITY_ORDER = [
  "Bengaluru","Hyderabad","Pune","Delhi NCR","Mumbai","Chennai","Kolkata",
  "Ahmedabad","Jaipur","Kochi","Chandigarh","Coimbatore","Indore","Lucknow",
  "Bhubaneswar","Surat","Nagpur","Vadodara","Thiruvananthapuram",
  "Remote (India)","Other India","Multiple / Pan-India",
];
const ROLE_ORDER = [
  "Software Engineering","AI / ML","Data Science & Analytics","Frontend",
  "Backend","DevOps / Cloud","Hardware / Embedded","Product / Design","Other",
];
const TYPE_ORDER = ["Internship","Fresher / New Grad","Experienced","Unspecified"];

const LS = {
  saved: "savedJobs",
  hidden: "hiddenJobs",
  applied: "appliedJobs",
  lastVisit: "lastVisit",
};

function readSet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function writeSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {}
}
function readStr(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStr(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function formatIST(iso) {
  if (!iso) return "unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
  }).format(date) + " IST";
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

function initials(company) {
  const parts = String(company || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Chip({ children, onRemove, ariaLabel }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1 rounded border border-accent bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={ariaLabel || `Remove ${children}`}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}

function Popover({ label, options, selected, onToggle, counts, display }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const selCount = selected.length;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text hover:border-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {label}
        {selCount > 0 ? <span className="text-accent">({selCount})</span> : null}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="text-muted">
          <path d="M1 3L5 7L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 max-h-72 min-w-52 overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onToggle(opt)}
                className={
                  "flex w-full min-h-10 items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
                  (active ? "bg-accent/10 text-accent" : "text-text hover:bg-subtle")
                }
              >
                <span className="flex items-center gap-2">
                  <span
                    className={
                      "inline-flex h-4 w-4 items-center justify-center rounded border " +
                      (active ? "border-accent bg-accent text-white" : "border-border")
                    }
                    aria-hidden="true"
                  >
                    {active ? (
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  {display ? display(opt) : opt}
                </span>
                <span className="text-xs text-muted">{counts[opt] ?? 0}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Toast({ toast, onUndo }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-surface px-4 py-2 text-sm shadow-lg"
    >
      <span className="text-text">{toast.message}</span>
      {toast.undo ? (
        <button
          type="button"
          onClick={onUndo}
          className="ml-3 font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}

function BarChart({ title, data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-muted">{d.label}</span>
          <svg width="100%" height="8" viewBox="0 0 100 8" preserveAspectRatio="none" className="flex-1" aria-hidden="true">
            <rect x="0" y="1" width={(d.count / max) * 100} height="6" rx="2" className="fill-accent" />
          </svg>
          <span className="w-6 shrink-0 text-right text-muted">{d.count}</span>
        </div>
      ))}
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
        We never charge for access and we never scrape job boards or company
        career pages.
      </p>
      <p className="text-sm">
        <a href="#/" className="text-link hover:underline">Back to listings</a>
      </p>
    </section>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4">
          <a href="#/" className="text-sm font-semibold tracking-tight text-text">
            India Fresher Tech Radar
          </a>
          <nav className="flex items-center gap-1">
            <a href="#/sources" className="inline-flex min-h-10 items-center px-2 text-sm text-muted hover:text-text">
              Sources
            </a>
            <a href="#/about" className="inline-flex min-h-10 items-center px-2 text-sm text-muted hover:text-text">
              About
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
    </div>
  );
}

function SkeletonCard() {
  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-subtle" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-subtle" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-subtle" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-16 animate-pulse rounded bg-subtle" />
        <div className="h-5 w-20 animate-pulse rounded bg-subtle" />
        <div className="h-5 w-16 animate-pulse rounded bg-subtle" />
      </div>
      <div className="h-3 w-32 animate-pulse rounded bg-subtle" />
      <div className="h-9 w-20 animate-pulse rounded-md bg-subtle" />
    </article>
  );
}

export default function App() {
  const route = useHashRoute();
  const { theme } = useTheme();

  const [jobs, setJobs] = useState(null);
  const [sources, setSources] = useState([]);
  const [refreshed, setRefreshed] = useState(null);
  const [error, setError] = useState(null);

  // filters
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState([]);
  const [roles, setRoles] = useState([]);
  const [types, setTypes] = useState([]);
  const [sort, setSort] = useState("newest");
  const [showExperienced, setShowExperienced] = useState(false);
  const [newOnly, setNewOnly] = useState(false);

  // tabs & lists
  const [tab, setTab] = useState("all");
  const [saved, setSaved] = useState(() => readSet(LS.saved));
  const [hidden, setHidden] = useState(() => readSet(LS.hidden));
  const [applied, setApplied] = useState(() => readSet(LS.applied));

  // new markers
  const [lastVisit] = useState(() => readStr(LS.lastVisit));
  useEffect(() => {
    writeStr(LS.lastVisit, String(Date.now()));
  }, []);

  // toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (message, undo) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undo: Boolean(undo) });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };
  const hideToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  };

  // mobile sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  // insights
  const [insightsOpen, setInsightsOpen] = useState(false);

  const searchRef = useRef(null);

  // load data
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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // URL restore (once)
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    if (jobs === null) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) setQuery(params.get("q") || "");
    if (params.has("city")) setCities(params.get("city").split(",").filter(Boolean));
    if (params.has("role")) setRoles(params.get("role").split(",").filter(Boolean));
    if (params.has("type")) setTypes(params.get("type").split(",").filter(Boolean));
    if (params.has("sort")) setSort(params.get("sort") || "newest");
    if (params.has("exp")) setShowExperienced(params.get("exp") === "1");
    if (params.has("tab")) setTab(params.get("tab") || "all");
    if (params.has("new")) setNewOnly(params.get("new") === "1");
  }, [jobs]);

  // URL write
  useEffect(() => {
    if (!initialized.current) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (cities.length) params.set("city", cities.join(","));
    if (roles.length) params.set("role", roles.join(","));
    if (types.length) params.set("type", types.join(","));
    if (sort !== "newest") params.set("sort", sort);
    if (showExperienced) params.set("exp", "1");
    if (tab !== "all") params.set("tab", tab);
    if (newOnly) params.set("new", "1");
    const qs = params.toString();
    const url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [query, cities, roles, types, sort, showExperienced, tab, newOnly]);

  // popstate restore
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.has("q") ? params.get("q") || "" : "");
      setCities(params.has("city") ? params.get("city").split(",").filter(Boolean) : []);
      setRoles(params.has("role") ? params.get("role").split(",").filter(Boolean) : []);
      setTypes(params.has("type") ? params.get("type").split(",").filter(Boolean) : []);
      setSort(params.has("sort") ? params.get("sort") || "newest" : "newest");
      setShowExperienced(params.has("exp") && params.get("exp") === "1");
      setTab(params.has("tab") ? params.get("tab") || "all" : "all");
      setNewOnly(params.has("new") && params.get("new") === "1");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // keyboard shortcut /
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggle = (setter) => (value) =>
    setter((current) =>
      current.includes(value) ? current.filter((i) => i !== value) : [...current, value],
    );

  const toggleType = (value) => {
    if (value === "Experienced") setShowExperienced(true);
    setTypes((current) =>
      current.includes(value) ? current.filter((i) => i !== value) : [...current, value],
    );
  };

  const lastVisitTime = lastVisit ? new Date(lastVisit).getTime() : NaN;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const newThreshold = Number.isFinite(lastVisitTime)
    ? Math.min(lastVisitTime, dayAgo)
    : dayAgo;

  const isNew = (job) => {
    const seen = new Date(job.first_seen).getTime();
    if (!Number.isFinite(seen)) return false;
    return seen > newThreshold;
  };

  // persistence helpers
  const toggleSaved = (id) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(LS.saved, next);
      return next;
    });
  };
  const toggleApplied = (id) => {
    setApplied((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(LS.applied, next);
      return next;
    });
  };
  const hideJob = (id) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeSet(LS.hidden, next);
      return next;
    });
    showToast("Hidden", true);
    // store last hidden for undo
    lastHiddenRef.current = id;
  };
  const lastHiddenRef = useRef(null);
  const undoHide = () => {
    const id = lastHiddenRef.current;
    if (id == null) return;
    setHidden((prev) => {
      const next = new Set(prev);
      next.delete(id);
      writeSet(LS.hidden, next);
      return next;
    });
    hideToast();
  };

  // export CSV
  const exportSaved = () => {
    const savedJobs = jobs ? jobs.filter((j) => saved.has(j.id)) : [];
    const headers = ["company","title","city","role_category","experience_type","apply_url","first_seen"];
    const rows = savedJobs.map((j) =>
      headers.map((h) => {
        const v = j[h] ?? "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      }).join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "saved-jobs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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

  // facet counts: count of jobs matching all filters except the one for this dimension
  const facetCounts = useMemo(() => {
    if (!jobs) return { city: {}, role: {}, type: {} };
    const base = jobs.filter((job) => {
      if (hidden.has(job.id)) return false;
      if (tab === "saved" && !saved.has(job.id)) return false;
      if (tab === "applied" && !applied.has(job.id)) return false;
      if (tab === "all" && applied.has(job.id)) return false;
      if (!showExperienced && job.experience_type === "Experienced") return false;
      if (newOnly && !isNew(job)) return false;
      const q = query.trim().toLowerCase();
      if (q && !job.company.toLowerCase().includes(q) && !job.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const cityCounts = {};
    const roleCounts = {};
    const typeCounts = {};
    for (const job of base) {
      // city counts exclude city filter
      if (roles.length === 0 || roles.includes(job.role_category)) {
        if (types.length === 0 || types.includes(job.experience_type)) {
          cityCounts[job.city] = (cityCounts[job.city] || 0) + 1;
        }
      }
      if (cities.length === 0 || cities.includes(job.city)) {
        if (types.length === 0 || types.includes(job.experience_type)) {
          roleCounts[job.role_category] = (roleCounts[job.role_category] || 0) + 1;
        }
      }
      if (cities.length === 0 || cities.includes(job.city)) {
        if (roles.length === 0 || roles.includes(job.role_category)) {
          typeCounts[job.experience_type] = (typeCounts[job.experience_type] || 0) + 1;
        }
      }
    }
    return { city: cityCounts, role: roleCounts, type: typeCounts };
  }, [jobs, hidden, tab, saved, applied, showExperienced, newOnly, query, cities, roles, types, lastVisit]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = query.trim().toLowerCase();
    let list = jobs.filter((job) => {
      if (hidden.has(job.id)) return false;
      if (tab === "saved" && !saved.has(job.id)) return false;
      if (tab === "applied" && !applied.has(job.id)) return false;
      if (tab === "all" && applied.has(job.id)) return false;
      if (tab === "saved" && applied.has(job.id)) return false;
      if (!showExperienced && job.experience_type === "Experienced") return false;
      if (newOnly && !isNew(job)) return false;
      if (q && !job.company.toLowerCase().includes(q) && !job.title.toLowerCase().includes(q)) return false;
      if (cities.length && !cities.includes(job.city)) return false;
      if (roles.length && !roles.includes(job.role_category)) return false;
      if (types.length && !types.includes(job.experience_type)) return false;
      return true;
    });
    if (sort === "company") {
      list = [...list].sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title));
    } else {
      list = [...list].sort((a, b) => new Date(b.first_seen || 0).getTime() - new Date(a.first_seen || 0).getTime());
    }
    return list;
  }, [jobs, hidden, tab, saved, applied, showExperienced, newOnly, query, cities, roles, types, sort, lastVisit]);

  const hasFilters = Boolean(query.trim() || cities.length || roles.length || types.length || newOnly);

  const clearFilters = () => {
    setQuery("");
    setCities([]);
    setRoles([]);
    setTypes([]);
    setNewOnly(false);
  };

  const newCount = useMemo(() => {
    if (!jobs) return 0;
    return jobs.filter((j) => !hidden.has(j.id) && isNew(j)).length;
  }, [jobs, hidden, lastVisit]);

  // insights data
  const insights = useMemo(() => {
    if (!jobs) return { cities: [], roles: [], newWeek: 0 };
    const cityMap = {};
    const roleMap = {};
    let newWeek = 0;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const job of jobs) {
      if (hidden.has(job.id)) continue;
      cityMap[job.city] = (cityMap[job.city] || 0) + 1;
      roleMap[job.role_category] = (roleMap[job.role_category] || 0) + 1;
      const seen = new Date(job.first_seen).getTime();
      if (Number.isFinite(seen) && seen > weekAgo) newWeek += 1;
    }
    const cityData = Object.entries(cityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count }));
    const roleData = Object.entries(roleMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count }));
    return { cities: cityData, roles: roleData, newWeek };
  }, [jobs, hidden, lastVisit]);

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
          Could not load listings: {error}.
        </div>
      ) : null}

      {/* Header line with live count + refresh */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text">
          <span className="font-semibold">{filtered.length}</span>
          <span className="text-muted"> of {jobs ? jobs.length : "…"} roles</span>
          {jobs ? <span className="text-muted"> · Last refreshed {formatIST(refreshed)}</span> : null}
        </p>
        {newCount > 0 ? (
          <button
            type="button"
            onClick={() => setNewOnly(true)}
            className="inline-flex min-h-9 items-center rounded-md border border-accent bg-accent/10 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {newCount} new since your last visit
          </button>
        ) : null}
      </div>

      {/* Compact filter bar */}
      <div className="rounded-md border border-border bg-surface p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company or role… (press /)"
              aria-label="Search by company or title"
              className="w-full rounded-md border border-border bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* desktop popovers */}
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <Popover
              label="City"
              options={available.cities}
              selected={cities}
              onToggle={toggle(setCities)}
              counts={facetCounts.city}
            />
            <Popover
              label="Role"
              options={available.roles}
              selected={roles}
              onToggle={toggle(setRoles)}
              counts={facetCounts.role}
              display={(x) => x}
            />
            <Popover
              label="Type"
              options={available.types}
              selected={types}
              onToggle={toggleType}
              counts={facetCounts.type}
              display={typeLabel}
            />
            <label className="inline-flex min-h-10 items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={showExperienced}
                onChange={(e) => setShowExperienced(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Experienced
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort roles"
              className="rounded-md border border-border bg-bg px-2 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="newest">Newest</option>
              <option value="company">Company A-Z</option>
            </select>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-10 items-center text-sm text-muted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear all
              </button>
            ) : null}
          </div>

          {/* mobile filters button */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-sm text-text md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Open filters"
          >
            Filters
            {hasFilters ? <span className="ml-1 text-accent">•</span> : null}
          </button>
        </div>

        {/* active filter chips */}
        {(cities.length || roles.length || types.length || newOnly || query) ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {query ? (
              <Chip onRemove={() => setQuery("")} ariaLabel="Remove search">
                “{query}”
              </Chip>
            ) : null}
            {cities.map((c) => (
              <Chip key={`c-${c}`} onRemove={() => setCities((p) => p.filter((x) => x !== c))} ariaLabel={`Remove city ${c}`}>
                {c}
              </Chip>
            ))}
            {roles.map((r) => (
              <Chip key={`r-${r}`} onRemove={() => setRoles((p) => p.filter((x) => x !== r))} ariaLabel={`Remove role ${r}`}>
                {r}
              </Chip>
            ))}
            {types.map((t) => (
              <Chip key={`t-${t}`} onRemove={() => setTypes((p) => p.filter((x) => x !== t))} ariaLabel={`Remove type ${t}`}>
                {typeLabel(t)}
              </Chip>
            ))}
            {newOnly ? (
              <Chip onRemove={() => setNewOnly(false)} ariaLabel="Remove new filter">
                New
              </Chip>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* mobile sheet */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-auto rounded-t-lg border-t border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">Filters</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">City</p>
                <div className="flex flex-wrap gap-2">
                  {available.cities.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggle(setCities)(c)}
                      aria-pressed={cities.includes(c)}
                      className={
                        "inline-flex min-h-10 items-center rounded border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
                        (cities.includes(c) ? "border-accent bg-accent text-white" : "border-border bg-bg text-text")
                      }
                    >
                      {c} <span className="ml-1 text-xs opacity-70">{facetCounts.city[c] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Role</p>
                <div className="flex flex-wrap gap-2">
                  {available.roles.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggle(setRoles)(r)}
                      aria-pressed={roles.includes(r)}
                      className={
                        "inline-flex min-h-10 items-center rounded border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
                        (roles.includes(r) ? "border-accent bg-accent text-white" : "border-border bg-bg text-text")
                      }
                    >
                      {r} <span className="ml-1 text-xs opacity-70">{facetCounts.role[r] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Type</p>
                <div className="flex flex-wrap gap-2">
                  {available.types.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleType(t)}
                      aria-pressed={types.includes(t)}
                      className={
                        "inline-flex min-h-10 items-center rounded border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
                        (types.includes(t) ? "border-accent bg-accent text-white" : "border-border bg-bg text-text")
                      }
                    >
                      {typeLabel(t)} <span className="ml-1 text-xs opacity-70">{facetCounts.type[t] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="inline-flex min-h-10 items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={showExperienced} onChange={(e) => setShowExperienced(e.target.checked)} className="h-4 w-4 rounded border-border" />
                Show experienced
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort roles"
                  className="rounded-md border border-border bg-bg px-2 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="newest">Newest first</option>
                  <option value="company">Company A-Z</option>
                </select>
                {hasFilters ? (
                  <button type="button" onClick={clearFilters} className="inline-flex min-h-10 items-center text-sm text-muted underline-offset-2 hover:underline">
                    Clear all
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="mt-3 flex items-center gap-1 border-b border-border">
        {[
          { id: "all", label: "All" },
          { id: "saved", label: `Saved (${saved.size})` },
          { id: "applied", label: `Applied (${applied.size})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={
              "inline-flex min-h-10 items-center border-b-2 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
              (tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-text")
            }
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={exportSaved}
            disabled={saved.size === 0}
            className="inline-flex min-h-10 items-center text-xs text-muted underline-offset-2 hover:underline disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Export saved CSV
          </button>
        </div>
      </div>

      {/* Insights strip */}
      <div className="mt-3 rounded-md border border-border bg-surface">
        <button
          type="button"
          onClick={() => setInsightsOpen((v) => !v)}
          aria-expanded={insightsOpen}
          className="flex w-full items-center justify-between px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="font-medium">Insights</span>
          <span className="text-xs text-muted">
            {insights.newWeek} new this week · {insightsOpen ? "hide" : "show"}
          </span>
        </button>
        {insightsOpen ? (
          <div className="grid grid-cols-1 gap-4 border-t border-border p-3 md:grid-cols-2">
            <BarChart title="Jobs by city" data={insights.cities} />
            <BarChart title="Jobs by role" data={insights.roles} />
          </div>
        ) : null}
      </div>

      {/* Job list */}
      {!jobs && !error ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : null}

      {jobs && filtered.length === 0 ? (
        <div className="mt-6 rounded-md border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted">
            No roles match. Try removing a filter, broadening your search, or
            switching tabs.
          </p>
        </div>
      ) : null}

      {jobs && filtered.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              sources={sources}
              isNew={isNew(job)}
              saved={saved.has(job.id)}
              applied={applied.has(job.id)}
              onSave={() => toggleSaved(job.id)}
              onHide={() => hideJob(job.id)}
              onToggleApplied={() => toggleApplied(job.id)}
            />
          ))}
        </div>
      ) : null}

      <footer className="mt-8 border-t border-border pt-3 text-xs leading-relaxed text-muted">
        <p>
          Unofficial aggregator. Listings may be outdated — verify on the company
          site. We never charge for access.
        </p>
        <p className="mt-1">
          <a className="underline underline-offset-2" href="#/sources">Sources &amp; credits</a>
        </p>
      </footer>

      <Toast toast={toast} onUndo={undoHide} />
    </Shell>
  );
}
