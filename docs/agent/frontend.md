# Frontend — architecture & component map

## Stack

React 19 · TypeScript · Tailwind CSS v4 · Vite · react-router-dom v7 · Vitest + React Testing Library

Build output: `npm run build` compiles to `src/api/static/` (consumed by FastAPI `StaticFiles` mount in production). Dev server proxies `/query`, `/health`, `/summarise`, and `/embeddings/project` to `http://localhost:8000`.

---

## Routing

`App.tsx` exports a `routes` array and mounts a `createBrowserRouter` + `RouterProvider`.

```
Layout          ← shared wrapper: Navbar + <Outlet />
  /             → HomePage
  /summary      → SummaryPage
  /embeddings   → EmbeddingsPage (lazy-loaded via React.lazy + Suspense)
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

### EmbeddingsPage (`/embeddings`)

3D embedding scatter page. State: `rawPoints`, `points`, `queryXyz`, `loading`, `error`, `answer`, `isStreaming`, `citedIds`, `esRef`.

- On mount: fetches `/points.json` into `rawPoints`
- URL `?q=…` is the single source of truth for the query (managed by `EmbeddingsQueryBar`)
- When `?q=…` changes and `rawPoints` are loaded: `POST /embeddings/project` → sets `queryXyz` (the projected xyz of the query)
- **Ask button**: fires `GET /query/stream` SSE stream; on `[DONE]`, merges `app_sources` + `product_sources` into `citedIds`
- `cited` flag on each point: driven by `citedIds` (names cited in the answer), not by the `top_k_ids` from the projection endpoint
- Lines drawn from `queryXyz` to all `cited` points; no separate toggle
- EmbeddingsPage is lazy-loaded (`React.lazy`) so Three.js doesn't affect the home-page bundle

The page is split across two files:
- `pages/EmbeddingsPage.tsx` — scene and page shell; exports `EmbeddingsQueryBar` named export
- `pages/EmbeddingsPage.utils.ts` — pure helper functions and types (see Key types below)

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
| `EmbeddingsQueryBar` | Query input bound to `?q=` search param (300ms debounce), Ask button that triggers SSE stream, streamed answer display, and `QueryChips` reuse. Exported from `EmbeddingsPage.tsx`. |

---

## Key types

From `src/components/SummaryReport.tsx`:

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

From `src/pages/EmbeddingsPage.utils.ts`:

```ts
interface EmbeddingPoint {
  id: string; doc_type: string; division: string; name: string; summary: string;
  risk_rating: string; cost_000s: number; arr_000s: number;
  projected_xyz: [number, number, number]
}
interface EmbeddingPointWithTopK extends EmbeddingPoint {
  cited: boolean  // true if name appeared in the SSE answer's app_sources / product_sources
}
```

Helper functions in `EmbeddingsPage.utils.ts`: `mergeTopKIntoPoints(points, citedIds)`, `buildIsolationFilter(selectedId, points)`, `divisionToColor(division)`, `docTypeToShape(doc_type)`, `pointToSize(doc_type, value)`.

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
| `/query/stream` | GET + query param | HomePage, EmbeddingsPage | SSE via `EventSource`; tokens arrive as JSON strings; final frame is `[DONE] {json}` |
| `/summarise` | POST (no body) | SummaryPage | Returns `SummaryReportData` JSON |
| `/embeddings/project` | POST | EmbeddingsPage | Body `{query, top_k}`. Returns `{projected_xyz, top_k_ids}`. Used to place the query point in the scatter. |
| `/points.json` | GET (static) | EmbeddingsPage | Served directly from `public/` in dev and `api/static/` in prod; no proxy needed |

Vite proxy forwards `/query`, `/health`, `/summarise`, and `/embeddings/project` to `http://localhost:8000` in dev. `/embeddings` itself is not proxied — the SPA route is served by the dev server, and `/points.json` is served from `public/` without a proxy.
