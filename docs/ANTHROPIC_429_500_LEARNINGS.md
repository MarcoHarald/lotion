# Learnings: 429 and 500 errors when calling Anthropic from the webapp

This doc summarises what we learned from the **anthropic-test** implementation and how it can help fix 429/500 errors when the webapp invokes `generate-consequences`.

## What worked in the simple test

- **Single request**: `anthropic-test` makes one Anthropic call per invocation. No parallel burst.
- **Same secret**: `ANTHROPIC_API_KEY` from **Supabase Edge Function Secrets** (Dashboard → Edge Functions → Secrets). If the test works, the key is valid and the Edge Function can reach Anthropic.
- **Same URL/headers**: `https://api.anthropic.com/v1/messages` with `x-api-key` and `anthropic-version: 2023-06-01`. No difference in how the main function calls Anthropic.

## Why the webapp flow hits 429/500

1. **Six parallel Anthropic calls**  
   `generate-consequences` runs all 6 domain agents with `Promise.all(domainOrder.map(... callDomainAgent))`. That sends 6 requests at once. Anthropic rate limits by requests per minute; a burst of 6 often triggers **429**.

2. **Only one retry on 429**  
   `anthropicPost()` in `generate-consequences/index.ts` retries **once** after waiting (Retry-After or 65s). If the retry also returns 429, or if several of the 6 parallel calls get 429, the code throws and the Edge Function returns **500** with a generic error. The client cannot tell 429 from 500.

3. **Long wait can cause timeouts**  
   A 65s wait inside the function can push total runtime over the Edge Function timeout (e.g. 60s default). That can surface as 500 or a timeout error in the webapp.

4. **500 from Anthropic**  
   Anthropic can return 5xx (overload, etc.). The function forwards that as 502 with `detail`, but the webapp only sees a generic "Function error" or the message string. No structured way to show "rate limited" vs "provider error".

## Recommended fixes (for another agent)

### 1. Throttle domain agents (reduce 429)

- **Option A**: Run domain agents in **batches of 2–3** (e.g. `energy`+`food`+`finance`, then `political`+`military`+`supply_chain`) instead of all 6 in parallel. Small delay (e.g. 2–5s) between batches.
- **Option B**: Run agents **sequentially** (slower but much less likely to hit rate limits).

### 2. Stronger 429 handling in `anthropicPost`

- Retry **2–3 times** with **exponential backoff** (e.g. 10s, 30s, 60s) instead of a single 65s retry.
- If the last retry still returns 429, **return a response with status 429** and a body like `{ "error": "Rate limited", "code": "RATE_LIMITED" }` instead of throwing (which becomes 500). The webapp can then show "Too many requests; try again in a minute."

### 3. Differentiate errors in the Edge Function response

- When Anthropic returns **429**: respond with HTTP **429** and `{ "error": "...", "code": "RATE_LIMITED" }`.
- When Anthropic returns **5xx**: respond with **502** and `{ "error": "...", "code": "PROVIDER_ERROR" }`.
- Keep **500** for real server/application errors (e.g. missing key, DB error). Use a consistent `code` so the frontend can branch.

### 4. Webapp: show user-friendly messages

- If response status is **429** or `payload.code === "RATE_LIMITED"`: show "Rate limited. Please try again in a minute."
- If **502** or `payload.code === "PROVIDER_ERROR"`: show "Analysis service temporarily unavailable. Please try again."
- Optionally: **retry once** on 429 after 60s (e.g. "Retry" button or auto-retry).

### 5. Verify secrets

- If the **anthropic-test** function works (same project, same Edge Function Secrets) but **generate-consequences** fails with 500, the key is shared; the failure is likely rate limiting or timeouts, not a missing key.
- If **anthropic-test** also fails, check **Edge Function Secrets** for `ANTHROPIC_API_KEY` (Dashboard → Edge Functions → Secrets).

### 6. Optional: increase Edge Function timeout

- If the function often runs >60s (Perplexity + 6 agents + synthesiser + possible 429 wait), increase the function timeout in the Supabase project so the request does not get cut off and surface as 500.

---

## Implemented fixes (in this repo)

- **429 handling**: `anthropicPost` retries up to 2 times with shorter backoff (20s/40s). On final 429, the function throws an error with `code: "RATE_LIMITED"` and the top-level catch returns **HTTP 429** with `{ error, code: "RATE_LIMITED" }`.
- **Batching**: Domain agents run in two batches of 3 with a 2s pause between batches to reduce burst 429s.
- **Webapp**: App.tsx and RightPanel show "Rate limited. Please try again in a minute." when the response has `code === "RATE_LIMITED"` or the error message contains "rate limit".

---

## Quick reference: flow that works (anthropic-test)

- **Deploy**: same project as the webapp; `ANTHROPIC_API_KEY` in Edge Function Secrets.
- **Call**: `GET` or `POST` to `https://<project>.supabase.co/functions/v1/anthropic-test` with `Authorization: Bearer <anon_key>`.
- **Response**: `{ "question": "...", "analysis": "..." }` on success; on failure, body contains `error` (and optionally `detail`). Use this to confirm the key and Anthropic connectivity before debugging the full pipeline.
