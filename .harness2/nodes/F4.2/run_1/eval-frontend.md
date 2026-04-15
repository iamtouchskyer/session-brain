# F4.2 Review — Frontend (Caching)

## Verdict: ITERATE

---

## Findings

### 🔴 [critical] Thundering herd — no in-flight deduplication
File: `src/lib/storage/GitHubAdapter.ts:46-80`
Issue: `fetchWithCache` has no request coalescing. Two simultaneous callers with a cold cache both execute the `cached = await cache.match(url)` check at the same time, both get `undefined`, both call `fetch(url)`, and both write to Cache Storage. For `loadAllArticles` this fires once on auth, so it's low-probability in production today — but if the pattern is reused for article loading or if the user hits the app from two tabs simultaneously, it doubles network traffic and can produce a race on `cache.put`.
Fix: Add a `Map<string, Promise<unknown>>` inflight registry. Before calling `fetch`, check if the key is already resolving; if so, `await` the existing promise instead of starting a new one. Remove from the map in a `.finally()`.

---

### 🔴 [critical] `cached.clone().json()` error swallowed — causes silent stale-serve failure
File: `src/lib/storage/GitHubAdapter.ts:52`
Issue: `cached.clone().json()` can throw (corrupt cache entry, unexpected content-type, parse error). When it does, execution falls to the `catch` block at line 71. The guard on line 73 only re-throws errors whose message starts with `"Fetch failed:"` — a JSON parse error does NOT match that pattern, so it falls through to the plain `fetch(url)` fallback at line 77. This is actually the correct recovery path, **but** the background revalidation promise at lines 56-60 is **not** launched, and the failed Cache Storage entry is **never deleted** — so the next request will hit the same corrupt entry again and repeat the same silent fallback forever. The corrupt entry becomes sticky.
Fix: In the parse-error catch branch, explicitly call `cache.delete(url)` before falling through to the plain fetch.

---

### 🟡 [major] `x-cached-at` timestamp is `Number(... ?? 0)` — missing header defaults to epoch, forcing permanent staleness
File: `src/lib/storage/GitHubAdapter.ts:53`
Issue: If a Response is somehow stored without the `x-cached-at` header (e.g. written by a future code path, or a manually seeded entry), `Number(null)` → `0`, so `age = Date.now() - 0` = a huge number ≫ TTL. The entry is immediately considered stale and triggers a background refresh on every single request. Not a correctness bug (data is still served), but wastes bandwidth silently.
Fix: `const cachedAt = cached.headers.get('x-cached-at')` — if `null`, treat as stale immediately and skip the `if (age < ttl) return data` path, or default `cachedAt` to `'0'` with an explicit comment explaining the intent.

---

### 🟡 [major] Background revalidation fetch has no auth headers
File: `src/lib/storage/GitHubAdapter.ts:56`
Issue: The stale-while-revalidate path calls `fetch(url)` bare — no `Authorization` header. The comment on line 42 says Cache Storage is only used when `TOKEN === ''`, so for public repos this is correct. **But** `fetchWithCache` is called from `fetchFile` after checking `if (TOKEN)` (line 97) — meaning it only runs in the public-CDN branch. The assumption holds *today*. However, the code does not enforce this; `fetchWithCache` is an exported-adjacent module-level function that could be called with a token URL accidentally. A defensive `if (TOKEN) { /* don't use cache */ }` guard inside `fetchWithCache` would make the invariant explicit and prevent accidental misuse.
Fix: Add an assertion/guard at the top of `fetchWithCache`: `if (TOKEN) throw new Error('fetchWithCache must not be called with an authenticated repo')`, or keep the current call-site guard and add a comment inside `fetchWithCache` documenting the precondition.

---

### 🟡 [major] `memCache` Map is unbounded — memory leak for long-lived sessions
File: `src/lib/storage/GitHubAdapter.ts:19`
Issue: Entries are only evicted on *read* (`getCached`). If keys are written but never re-read (e.g. a slug the user navigated away from), they accumulate indefinitely. For a small blog this is harmless, but it's not bounded by design. TTL expiry without active reads = dead memory.
Fix: Either (a) cap the map at N entries with LRU eviction, or (b) add a periodic sweep (`setInterval`) that calls `memCache.forEach((v, k) => { if (Date.now() > v.expiresAt) memCache.delete(k) })`). Given KISS, option (b) at a 1-min interval is the minimal fix. Document the max expected size to justify the choice.

---

### 🟡 [major] Test coverage: Cache Storage layer is entirely untested
File: `src/lib/__tests__/cache.test.ts:64-88`
Issue: The `loadAllArticles integration` test stubs `caches` to `undefined` (line 75), which bypasses `fetchWithCache` entirely and exercises only the mem-cache + plain-fetch path. There are zero tests for:
- Cache hit (valid entry, age < TTL → return data without fetch)
- Cache hit stale (age ≥ TTL → serve stale, trigger background refresh)
- Cache miss (no entry → fetch, write entry, return data)
- Corrupt entry / parse error → fallback to plain fetch + delete entry
- The `x-cached-at` header round-trip

Fix: Mock the `caches` global with a fake Cache Storage (`{ open, match, put, delete }`). Test each of the four branches. This is the highest-value test gap.

---

### 🔵 [minor] `loadAllArticles` integration test is effectively a no-op
File: `src/lib/__tests__/cache.test.ts:80-85`
Issue: The test description says "uses index only" but the assertion is only `Array.isArray(result)` — it doesn't verify that `fetch` was called exactly once, or that `loadArticle` was not called. The comment on line 66-67 says the real assertion "is tested via mock in data.test.ts" — but that file was not found in this review. If `data.test.ts` doesn't exist, this claim is unverified.
Fix: Either add `expect(mockFetch).toHaveBeenCalledTimes(1)` here, or confirm `data.test.ts` exists and covers the no-per-article-fetch invariant.

---

### 🔵 [minor] Lazy loading is correct — no issue, but worth noting
File: `src/lib/data.ts:22-27`, `src/App.tsx:18`, `src/pages/ArticlesList.tsx:6`
Issue: None. `loadAllArticles` calls `loadIndex()` → `adapter.loadIndex()` → `fetchFile('index.json', TTL_INDEX)`. It never calls `loadArticle`. `App.tsx` types the state as `ArticleMeta[]` (not `SessionArticle[]`). `ArticlesList` props are typed `ArticleMeta[]`. The type chain is clean end-to-end. ✓

---

### 🔵 [minor] `path` field on `ArticleMeta` is a leaking implementation detail
File: `src/lib/storage/types.ts:16`
Issue: `ArticleMeta.path` is the storage path (`"2026/04/15/slug.json"`). It's included in the index and therefore in the client bundle. For a public repo this is benign; for a private repo it reveals internal storage structure. Low severity here, but worth tracking.
Fix: Consider stripping `path` from `ArticleMeta` at the adapter boundary and keeping it only in an internal `ArticleMetaInternal` type. The adapter resolves it; consumers never need it.

---

### 🔵 [info] Bundle size — no concern
`caches` is a native browser API, no polyfill included. The `fetchWithCache` function adds ~40 LOC to the bundle. Negligible.

---

## Summary

Two **critical** issues need fixing before this is production-safe:

1. **Thundering herd** — no in-flight deduplication on cold cache. Requires an inflight-promise map.
2. **Sticky corrupt cache entry** — a `json()` parse failure falls back correctly but never evicts the bad entry, causing permanent cache pollution for that URL.

Two **major** gaps:

3. **Cache Storage completely untested** — the test suite covers only the mem-cache layer. The entire stale-while-revalidate path has zero test coverage.
4. **Unbounded `memCache`** — not catastrophic for a small blog, but not bounded by design.

The lazy-loading implementation (`loadAllArticles` → index only) is correct and the type chain is clean throughout. The architectural decisions (mem cache → Cache Storage → plain fetch fallback, jsDelivr CDN for public repos) are sound.
