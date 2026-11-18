# india-fresher-tech-radar

A live radar for **fresher and internship tech roles in India**. It reads public
GitHub data files published by other maintainers, normalises and de-duplicates
them, tags each role, and serves a searchable static page that refreshes itself
every morning at **07:30 IST**.

> Unofficial and community-built. Listings can be stale — always verify on the
> company's own page.

## What this is not

- It does **not** scrape job sites or company career pages. Ever.
- It only reads files already published in public GitHub repositories, fetched
  from `raw.githubusercontent.com` or the GitHub API.
- It does not host applications or collect candidate data.

## How a refresh works

```
fetch (GitHub data files) -> India filter -> de-duplicate -> tag -> lifecycle -> write
```

1. **Fetch.** Each enabled source in `pipeline/sources.yml` has a small adapter
   in `pipeline/adapters/` that reads exactly the file paths listed there. If a
   path disappears, the adapter raises and the run reports it; paths are never
   guessed.
2. **India filter.** A row survives only if its location matches the India
   vocabulary in `sources.yml` (cities plus "India"/"Remote India" variants).
   Rows that are only outside India are dropped.
3. **De-duplicate.** Apply URLs are normalised by stripping only `utm_*`,
   `ref`, `source` and `gh_src` — `gh_jid` is kept because it identifies a
   distinct posting. A job's id is `SHA-256(normalised URL)`, falling back to
   company + normalised title + city, and every source that listed it is
   recorded.
4. **Tag.** Rules run first (city dictionary, role keyword map). Only rows the
   rules cannot resolve go to the LLM, in batches of 18, with a fixed enum for
   role, city and experience type. Answers are validated; one retry, then a
   fallback of `Other` / `Multiple / Pan-India`. Tags are cached by job id plus a
   hash of title and location, so **a second run with no new jobs makes zero LLM
   calls**.
5. **Lifecycle.** Each job carries `first_seen` and `last_seen`. A job no source
   lists any more is closed, and closed jobs are dropped after 14 days unseen.
6. **Write.** The site reads `web/public/jobs.json` (array) and
   `web/public/sources.json` (source list + `last_refreshed`).

### Safety guarantees

- A failing source never wipes its listings: its jobs keep their previous state,
  and an issue is opened.
- If live listings drop by more than 50% (and there were at least 20), the run
  **aborts without writing** and opens an issue. `jobs.json` is never written
  empty, and aborted runs leave the previous file in place.
- Job text is treated as untrusted: the model sees only title, company and
  location — never a URL or description — has no tools, and can only answer with
  enum values.

## Sources and licensing

Every source declares `enabled`, `license` and `attribution` in
[`pipeline/sources.yml`](pipeline/sources.yml); the site's Sources page is
generated from that file, so credit cannot drift from what is actually used.

| Source | Licence | India rows |
|---|---|---|
| IITian Vibes | CC BY 4.0 (data) | 1 |
| SimplifyJobs | no licence file | 3 |
| Surya's 2027 Internship Tracker | MIT (code), third-party data | 5 |
| India Internships Tracker (Nimrah) | MIT | 0 |
| speedyapply College Jobs | no licence file | 202 |
| Sarthzk Internship Tracker | all rights reserved, **used with permission** | 69 |
| vansh Summer 2027 / New Grad 2027 | MIT | 0 |

Two sources are enabled on the project owner's authority rather than an open
licence, and are flagged as such in `sources.yml`:

- **speedyapply** publishes no licence file.
- **Sarthzk** is all rights reserved; the owner confirmed written permission from
  the maintainer on **2026-11-18**. Remove the entry from `sources.yml` if that
  permission is ever withdrawn.

`VikashPR/Global-Internship-List` is deliberately **not** read: it is not a job
feed.

## Local development

```bash
pip install -r pipeline/requirements.txt
python -m pytest pipeline/tests -q   # offline, uses saved samples
python pipeline/coverage.py          # read-only coverage report per source
python pipeline/build.py             # full refresh (needs an LLM key)
```

```bash
cd web
npm install
npm run dev
npm run build
```

`build.py` needs `LLM_MODEL` and `LLM_API_KEY` in the environment. Without a key
it still runs: rows the rules cannot resolve fall back to `Other` /
`Multiple / Pan-India` and are left uncached so a later run with a key can fix
them.

For the "Report a problem" links, build the frontend with
`VITE_GITHUB_REPO=<owner>/<repo>`.

## Configuration

| Where | What |
|---|---|
| `pipeline/sources.yml` | sources, licences, attribution, India vocabulary |
| `LLM_MODEL` (env/secret) | model name, never hardcoded |
| `LLM_API_KEY` (env/secret) | API key, never committed |
| `VITE_GITHUB_REPO` | repo used by report links |

The workflow at `.github/workflows/daily-refresh.yml` runs at 02:00 UTC daily
(07:30 IST) and on manual dispatch. It runs the tests, refreshes the data, opens
an issue on source failure or a suspicious drop, and commits
`web/public/*.json` plus `pipeline/data/state.json` and
`pipeline/data/tags_cache.json` only when they changed. State and cache are
committed because lifecycle history and the "zero LLM calls on a quiet run"
guarantee do not survive without them.

## Project layout

```
.github/workflows/daily-refresh.yml
pipeline/
  sources.yml            source registry
  adapters/              one module per source -> common record
  build.py               fetch -> filter -> dedupe -> tag -> lifecycle -> write
  tagger.py              rules first, LLM for leftovers
  coverage.py            read-only coverage gate
  config.py              loads sources.yml
  data/                  state.json + tags_cache.json (committed)
  tests/                 offline tests + saved samples with provenance manifest
web/
  src/App.jsx            search, chips, banner, cards
  src/Sources.jsx        sources, licences, credits, disclaimer
  public/jobs.json       array of live jobs
  public/sources.json    sources + last_refreshed
```
