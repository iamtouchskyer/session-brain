# F4.2 Review — Backend/Data Layer

## Verdict: ITERATE

---

## Findings

### 1. ArticleReader cache — PASS with caveat

🔵 [info] `loadArticle()` correctly uses mem cache for article body on second visit

**Path:** `GitHubAdapter.ts:130-135`

`loadArticle()` calls `fetchFile(meta.path, TTL_ARTICLE)`. Inside `fetchFile`:
- Public repo: checks `memCache` with key `pub:<path>` first (line 114-115) → cache hit on revisit, **no network request**.
- Private repo: checks `memCache` with key `mem:<path>` first (line 99-100) → same result.

TTL_ARTICLE = 30 min, which is generous. **Second visit = cache hit. ✓**

One caveat: mem cache lives in the JS module singleton. If React StrictMode double-invokes the component in dev, the first two concurrent calls will both miss (race) and both write the same key. This is benign (last write wins, same data), but worth knowing.

---

### 2. Index double-load — PASS

🔵 [info] `loadIndex()` inside `loadArticle()` is always a cache hit after first call

**Path:** `GitHubAdapter.ts:131`, `GitHubAdapter.ts:126-128`

`loadIndex()` delegates to `fetchFile('index.json', TTL_INDEX)`. The mem cache key is `pub:index.json` (or `mem:index.json`). After the home page loads the article list, this key is already warm. When `loadArticle()` calls `this.loadIndex()` it returns synchronously from `memCache.get()` (line 21-29). Zero extra network requests. ✓

---

### 3. Type mismatch in Timeline.tsx — FAIL

🔴 [bug] `Timeline.tsx` uses undeclared `SessionArticle` type inside `groupByDay()`

**File:** `Timeline.tsx:21`

```ts
const groups = new Map<string, SessionArticle[]>()
```

`SessionArticle` is **never imported** in `Timeline.tsx`. The file only imports `ArticleMeta` (line 2). TypeScript will fail to compile this, but if the project has `"strict": false` or `noImplicitAny` disabled, tsc might silently infer `any` and let it slip. Either way it is a type error.

**Fix:** Change to `Map<string, ArticleMeta[]>()`. The `articles` parameter is `ArticleMeta[]`, `article` in the loop is `ArticleMeta` — no `SessionArticle` fields are accessed in this function.

---

### 4. ArticleCard fields vs ArticleMeta — PASS

🔵 [info] All fields rendered by ArticleCard exist on ArticleMeta

**File:** `ArticleCard.tsx:26-109`

Fields accessed: `slug`, `title`, `summary`, `date`, `tags`, `project`, `heroImage`, `duration`, `stats`.

All are declared in `ArticleMeta` (`types.ts:8-21`). `duration`, `heroImage`, `stats` are optional — the component guards all of them with `&&` or `?? []`. No runtime type mismatch. ✓

---

### 5. jsDelivr stale data — ACCEPTABLE with one gap

🟡 [warning] Stale-while-revalidate background fetch silently drops errors

**File:** `GitHubAdapter.ts:56-60`

The stale-while-revalidate path fires a background `fetch()` and suppresses all errors with `.catch(() => {})`. If the background refresh fails (network hiccup, CDN outage), the user continues on stale data indefinitely — the stale entry is never evicted from Cache Storage because the failed refresh never calls `cache.put()`. The in-memory TTL will eventually expire (5 min for index), triggering a fresh attempt, so this self-heals. But between mem-TTL expiry and Cache Storage staleness the user could see old data for a full mem-TTL cycle.

**5-minute TTL acceptability:** For a personal blog with infrequent publishes, 5 min is fine. If a new article is published, the author sees it latest within 5 min (mem TTL expiry triggers Cache Storage bypass). Acceptable for this use case.

**Fix (optional):** Evict the Cache Storage entry on background refresh failure so the next request forces a fresh fetch instead of serving the stale entry again:

```ts
fetch(url).then(r => r.json()).then(fresh => {
  cache.put(url, ...)
}).catch(() => {
  cache.delete(url).catch(() => {}) // evict stale on failure
})
```

---

### 6. Data integrity — missing article file

🟡 [warning] `loadArticle()` throws `Error` when slug exists in index but file is 404 — no fallback

**File:** `GitHubAdapter.ts:130-135`

When `meta.path` resolves but the actual JSON file is missing:
- Public path: `fetchFile` → `fetchWithCache` → `fetch(url)` → `res.ok === false` → throws `Error("Fetch failed: ... (404)")` (line 65).
- Private path: same, throws `Error("GitHub fetch failed: ... (404)")` (line 106).

The error propagates up to the caller (presumably an article detail page). If the caller doesn't have an error boundary, this will crash the component tree.

This is **structurally correct** — throwing on missing data is the right behavior. The issue is at the UI layer: the article detail page should catch this and render a "not found" state, not an uncaught error. This review scope doesn't include the article page itself, but flag it for the UI reviewer.

**Within this layer:** No action needed. The throw is correct and the error message is informative.

---

## Summary

| # | Topic | Status |
|---|-------|--------|
| 1 | Article cache hit on revisit | ✅ PASS |
| 2 | Index double-load is cache hit | ✅ PASS |
| 3 | `SessionArticle` undeclared in Timeline | ❌ BUG — fix before merge |
| 4 | ArticleCard fields vs ArticleMeta | ✅ PASS |
| 5 | jsDelivr + Cache Storage staleness | ⚠️ WARN — background eviction missing, acceptable for now |
| 6 | Missing article file 404 handling | ⚠️ WARN — throw is correct, UI layer must have error boundary |

**One blocking bug** (#3): `Timeline.tsx:21` references `SessionArticle` which is not imported. Will cause a TypeScript compile error (or silent `any` if strict mode is off). Must fix.

Everything else in the cache/data layer is logically sound.
