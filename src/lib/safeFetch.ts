/**
 * safeFetch — fetch wrapper that NEVER lets a JSON parser exception leak to UI.
 *
 * Failure cases handled:
 *   - Network error / fetch throws → { ok: false, error: 'Network error...' }
 *   - 5xx HTML body (Vercel function crash, gateway error) → { ok: false, error: 'Sharing service...' }
 *   - 4xx with valid JSON body → { ok: false, error: <body.error or fallback> }
 *   - 4xx/5xx with non-JSON body → { ok: false, error: <generic friendly> }
 *   - 2xx with valid JSON → { ok: true, data }
 *   - 2xx with non-JSON body → { ok: false, error: 'Unexpected response format' }
 *
 * Caller never sees "Unexpected token" / "is not valid JSON" — those are parser
 * errors that signal infra failure, not anything the user should read.
 */

const HUMAN_5XX = 'Sharing service temporarily unavailable. Please try again.'
const HUMAN_NETWORK = 'Network error. Check your connection and try again.'
const HUMAN_PARSE = 'Unexpected response from server. Please try again.'

export type SafeResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string }

function isJson(res: Response): boolean {
  const ct = res.headers.get('content-type') ?? ''
  return ct.toLowerCase().includes('application/json')
}

export async function safeFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<SafeResult<T>> {
  let res: Response
  try {
    res = await fetch(input, init)
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error && e.message ? `${HUMAN_NETWORK}` : HUMAN_NETWORK }
  }

  // Try JSON path first when server claims JSON
  if (isJson(res)) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      // server lied about content-type, or empty body
      return { ok: false, status: res.status, error: res.ok ? HUMAN_PARSE : HUMAN_5XX }
    }
    if (res.ok) {
      return { ok: true, status: res.status, data: body as T }
    }
    const errMsg = (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string')
      ? (body as { error: string }).error
      : HUMAN_5XX
    return { ok: false, status: res.status, error: errMsg }
  }

  // Non-JSON response. If server returned 5xx HTML (the bug we're killing),
  // never expose body — show human message.
  if (!res.ok) {
    return { ok: false, status: res.status, error: res.status >= 500 ? HUMAN_5XX : HUMAN_PARSE }
  }
  return { ok: false, status: res.status, error: HUMAN_PARSE }
}
