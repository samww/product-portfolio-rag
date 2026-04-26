# Frontend — architecture & component map

Build output: `npm run build` compiles to `src/api/static/` (consumed by FastAPI `StaticFiles` mount in production). Dev server proxies `/query`, `/health`, `/summarise`, and `/embeddings/project` to `http://localhost:8000`.

## Routing

`App.tsx` exports a `routes` array and mounts a `createBrowserRouter` + `RouterProvider`.

```
Layout          ← shared wrapper: Navbar + <Outlet />
  /             → HomePage
  /summary      → SummaryPage
  /embeddings   → EmbeddingsPage (lazy-loaded via React.lazy + Suspense)
```

**Layout** provides the dark `bg-slate-950` shell and the persistent `Navbar`. Pages only need to render their own content div.

**Navbar** — top bar with links to all three routes. Uses `NavLink` with `aria-current="page"` on the active route. Hamburger on mobile.

Tests that need routing context use `createMemoryRouter(routes)` (full app) or `MemoryRouter` (isolated component).


## Pages

### HomePage (`/`)

Query interface. Local state: `query` (textarea value). SSE streaming state managed by `useQuerySession()` from `src/lib/querySession/`.

- `useQuerySession()` returns `{ answer, cited, context, isStreaming, rawPayload, ask, cancel, reset }`
- `ask(query)` submits; `reset()` clears the previous answer; Enter submits, Shift+Enter inserts newline
- `QueryChips.onSelect` populates the textarea and calls `reset()` to clear the previous answer
- `uncited` sources derived from `rawPayload` (all returned sources minus `cited`) and passed to `ResponseDisplay`

### SummaryPage (`/summary`)

Risk report page. State: `summary: SummaryReportData | null`, `isSummarising`.

- "Generate Risk Summary" button (in `<main>`, not `<header>`) POSTs to `/summarise` (no body)
- Renders `<SummaryReport report={summary} />` once data arrives

### EmbeddingsPage (`/embeddings`)

3D embedding scatter page. State: `rawPoints`, `points`, `queryXyz`, `loading`, `error`, `retrievedIds`, `pinned`. SSE streaming state managed by `useQuerySession()` from `src/lib/querySession/`.

- On mount: fetches `/points.json` into `rawPoints`
- URL `?q=…` is the single source of truth for the query (managed by `EmbeddingsQueryBar`)
- When `?q=…` changes and `rawPoints` are loaded: `POST /embeddings/project` → sets `queryXyz` and `retrievedIds`
- **Ask button**: calls `ask(query)` from the hook; `cited` from the hook drives `mergeTopKIntoPoints`
- `cited` flag on each point: driven by `cited.map(c => c.name)` from the session, not by the projection `top_k_ids`
- Lines drawn from `queryXyz` to cited points (violet) and retrieved-but-not-cited points (grey); `linesVisible` is `rawPayload !== null`
- EmbeddingsPage is lazy-loaded (`React.lazy`) so Three.js doesn't affect the home-page bundle

Split across: `EmbeddingsPage.tsx` (data-fetch, session wiring, legend), `EmbeddingsScene.tsx` (Three.js sub-components), `EmbeddingsPage.utils.ts` (pure helpers/types).


## Components

| Component | What it does |
|---|---|
| `Navbar` | Persistent top nav. Hamburger on mobile. `aria-current="page"` on active link. |
| `Layout` | `Navbar` + `<Outlet />` wrapper. Owns the `min-h-screen bg-slate-950` shell. |
| `QueryChips` | Collapsible suggested-query chips grouped by category (Risk, ROI, Governance, Explore). `onSelect(query: string)` callback. |
| `ResponseDisplay` | Renders streamed Markdown answer + source pills. Props: `{ answer, cited: CitedSource[], uncited: CitedSource[], context, isStreaming }`. Cited = yellow; uncited apps = violet, uncited products = blue. Contains `RetrievedContext`. |
| `RetrievedContext` | Collapsible panel showing raw retrieved document chunks. Hidden by default. |
| `SummaryReport` | Risk summary table (desktop) + card list (mobile). Expandable rows show product exposures. Risk pills colour-coded by severity. Sorts findings by `revenue_at_risk_000s` descending. |
| `EmbeddingsQueryBar` | Query input bound to `?q=` search param (300ms debounce), Ask button, streamed answer display, and `QueryChips` reuse. Lives in `src/components/EmbeddingsQueryBar.tsx`. |


## Lib

### `querySession/` — `src/lib/querySession/`

Ports-and-adapters SSE state machine. Consumed by both HomePage and EmbeddingsPage.

| File | Role |
|---|---|
| `ports.ts` | `SseTransport`, `SseEvent`, `DonePayload`, `CitedSource` types |
| `session.ts` | `QuerySession` class — no React, no DOM, no `EventSource` |
| `filter.ts` | `filterCitations(answer, candidates)` — pure substring filter |
| `adapters.ts` | `eventSourceTransport` (production) · `InMemoryTransport` (test driver) |
| `useQuerySession.ts` | React hook; calls `session.cancel()` on unmount |
| `index.ts` | Barrel |
| `session.test.ts` | Pure node-env unit tests — no jsdom, no `vi.stubGlobal` |

`eventSourceTransport` is the **only** file in the module that mentions `EventSource`, `[DONE]`, or `JSON.parse(data)`.

`InMemoryTransport` provides `emitToken(value)`, `emitDone(payload)`, `emitError(cause?)` driver methods, plus observable `lastUrl` and `closed` fields for assertions.

`QuerySession` public API:
```ts
constructor(transport: SseTransport, onChange: (s: QuerySessionState) => void)
ask(query: string): void   // URL-encodes query, auto-cancels prior stream, resets state
cancel(): void             // idempotent; no-op if not streaming
reset(): void              // clears all state, closes transport
snapshot(): QuerySessionState
```

`useQuerySession(transport?)` returns `QuerySessionState & { ask, cancel, reset }`.


## Test conventions

**Runner:** `npx vitest run` (single-run; no watch mode in CI).  
**Files:** `src/__tests__/*.test.tsx`.  
**Setup:** `@testing-library/jest-dom` matchers loaded via `src/test-setup.ts`.

### Routing context in tests

- Isolated component (doesn't need real routes): wrap in `<MemoryRouter>`
- Full app routing: `createMemoryRouter(routes)` + `<RouterProvider router={router} />`

### Mocking patterns

- `fetch` and `scrollTo`: stub with `vi.stubGlobal`; clean up in `afterEach` with `vi.unstubAllGlobals(); vi.restoreAllMocks()`
- Pages using `useQuerySession`: inject `InMemoryTransport` via the optional `transport` prop.
- Pure session tests (`session.test.ts`): `// @vitest-environment node` at top, drive with `InMemoryTransport` synchronously.

### Assertion style

- Prefer role queries: `getByRole('button', { name: /…/i })`
- Scope with `within(element)` to avoid ambiguous matches across desktop table and mobile card list
- Routing assertions: check `href` attribute on `<a>` tags and `aria-current="page"` for active state
- Risk pill colour: `expect(pill.className).toMatch(/red/)` (Tailwind class name contains the colour word)


