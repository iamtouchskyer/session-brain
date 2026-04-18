import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { safeFetch } from '../safeFetch'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function htmlResponse(status: number, body = '<html>500</html>'): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html' },
  })
}

describe('safeFetch', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  beforeEach(() => { fetchSpy.mockReset() })
  afterEach(() => { fetchSpy.mockReset() })

  it('returns ok with parsed JSON on 2xx + json content-type', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { hello: 'world' }))
    const r = await safeFetch<{ hello: string }>('/x')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.hello).toBe('world')
  })

  it('returns ok=false with body.error on 4xx + json', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(400, { error: 'bad input' }))
    const r = await safeFetch('/x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('bad input')
  })

  it('returns human 5xx message on HTML 500 (the bug we kill)', async () => {
    fetchSpy.mockResolvedValueOnce(htmlResponse(500))
    const r = await safeFetch('/x')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/temporarily unavailable/i)
      expect(r.error).not.toMatch(/Unexpected token/)
      expect(r.error).not.toMatch(/<html>/)
    }
  })

  it('returns human parse message on non-JSON 2xx', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('plain text', { status: 200, headers: { 'content-type': 'text/plain' } }))
    const r = await safeFetch('/x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/unexpected response/i)
  })

  it('returns network error message when fetch throws', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const r = await safeFetch('/x')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(0)
      expect(r.error).toMatch(/network/i)
    }
  })

  it('handles lying content-type (json header but invalid body)', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('not json', { status: 500, headers: { 'content-type': 'application/json' } }))
    const r = await safeFetch('/x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/temporarily unavailable/i)
  })
})
