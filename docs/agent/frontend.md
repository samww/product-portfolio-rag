# Frontend — architecture & component map

## Stack

React 19 · TypeScript · Tailwind CSS v4 · Vite · react-router-dom v7 · Vitest + React Testing Library

Build output: `npm run build` compiles to `src/api/static/` (consumed by FastAPI `StaticFiles` mount in production). Dev server proxies `/query`, `/health`, and `/summarise` to `http://localhost:8000`.

---

## Routing

`App.tsx` exports a `routes` array and mounts a `createBrowserRouter` + `RouterProvider`.

```
Layout          ← shared wrapper: Navbar + <Outlet />
  /             → HomePage
  /summary      → SummaryPage
  /embeddings   → placeholder (slice 3, #26)
```

**Layout** provides the dark `bg-slate-950` shell and the persistent `Navbar`. Pages only need to render their own content div.

**Navbar** — top bar with links to all three routes. Desktop: inline links. Mobile: hamburger toggles a dropdown. Uses `NavLink` with `aria-current="page"` on the active route. Mobile menu closes on any link click.

Tests that need routing context use `createMemoryRouter(routes)` (full app) or `MemoryRouter` (isolated component).

---

## Pages

### HomePage (`/`)

Query interface. State: `query`, `answer`, `appSources`, `productSources`, `context`, `isStreaming`, `esRef`.

- Streams answer tokens from `GET /query/stream?query=…` via `EventSource`
- Final SSE message: `[DONE] {"app_sources":[], "product_sources":[], "context":[], "query":""}` — parsed to populate source state
- Enter submits; Shift+Enter inserts newline
- `QueryChips.onSelect` populates the textarea and clears the previous answer

### SummaryPage (`/summary`)

Risk report page. State: `summary: SummaryReportData | null`, `isSummarising`.

- "Generate Risk Summary" button (in `<main>`, not `<header>`) POSTs to `/summarise` (no body)
- Renders `<SummaryReport report={summary} />` once data arrives

---

## Components

| Component | What it does |
|---|---|
| `Navbar` | Persistent top nav. Hamburger on mobile. `aria-current="page"` on active link. |
| `Layout` | `Navbar` + `<Outlet />` wrapper. Owns the `min-h-screen bg-slate-950` shell. |
| `QueryChips` | Collapsible suggested-query chips grouped by category (Risk, ROI, Governance, Explore). `onSelect(query: string)` callback. |
| `ResponseDisplay` | Renders streamed Markdown answer + source pills. Cited sources = yellow; uncited = blue/violet. Contains `RetrievedContext`. |
| `RetrievedContext` | Collapsible panel showing raw retrieved document chunks. Hidden by default. |
| `SummaryReport` | Risk summary table (desktop) + card list (mobile). Expandable rows show product exposures. Risk pills colour-coded by severity. Sorts findings by `revenue_at_risk_000s` descending. |

---

## Key types

All exported from `src/components/SummaryReport.tsx`:

```ts
interface ProductExposure   { product: string; arr_000s: number }
interface RiskFinding        { application: string; risk_rating: string; issue: string;
                               revenue_at_risk_000s: number; recommended_action: string;
                               priority: string; product_exposures: ProductExposure[] }
interface GovernanceGap      { application: string; issue: string; recommended_action: string }
interface SummaryReportData  { overall_health: string; executive_summary: string;
                               critical_risks: RiskFinding[]; governance_gaps: GovernanceGap[];
                               total_apps_reviewed: number; total_arr_at_risk_000s: number }
```

No shared utils or constants file — types live with their component, queries are hardcoded in `QueryChips`.

---

## Test conventions

**Runner:** `npx vitest run` (single-run; no watch mode in CI).  
**Files:** `src/__tests__/*.test.tsx`.  
**Setup:** `@testing-library/jest-dom` matchers loaded via `src/test-setup.ts`.

### Routing context in tests

- Isolated component (doesn't need real routes): wrap in `<MemoryRouter>`
- Full app routing: `createMemoryRouter(routes)` + `<RouterProvider router={router} />`

### Mocking patterns

```ts
// EventSource (streaming)
function FakeEventSource(this, url) { this.onmessage = null; this.onerror = null; this.close = () => {} }
vi.stubGlobal('EventSource', FakeEventSource)

// fetch
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(data) }))

// window.scrollTo
vi.stubGlobal('scrollTo', vi.fn())

// Cleanup (afterEach)
vi.unstubAllGlobals(); vi.restoreAllMocks()
```

### Assertion style

- Prefer role queries: `getByRole('button', { name: /…/i })`
- Scope with `within(element)` to avoid ambiguous matches across desktop table and mobile card list
- Routing assertions: check `href` attribute on `<a>` tags and `aria-current="page"` for active state
- Risk pill colour: `expect(pill.className).toMatch(/red/)` (Tailwind class name contains the colour word)

---

## Backend communication

| Endpoint | Method | Used by | Notes |
|---|---|---|---|
| `/query/stream` | GET + query param | HomePage | SSE via `EventSource`; tokens arrive as JSON strings; final frame is `[DONE] {json}` |
| `/summarise` | POST (no body) | SummaryPage | Returns `SummaryReportData` JSON |
| `/embeddings/project` | POST | EmbeddingsPage (slice 4, #27) | Not yet wired |

Vite proxy forwards all `/query`, `/health`, `/summarise` requests to `http://localhost:8000` in dev.
