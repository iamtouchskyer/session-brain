import { describe, it, expect } from 'vitest'
import { generatePassword, ALPHABET } from '../passwordGen'

describe('generatePassword', () => {
  it('returns a string of the requested length', () => {
    expect(generatePassword(6)).toHaveLength(6)
    expect(generatePassword(1)).toHaveLength(1)
    expect(generatePassword(32)).toHaveLength(32)
  })

  it('defaults to length 6', () => {
    expect(generatePassword()).toHaveLength(6)
  })

  it('only emits chars from the readable alphabet', () => {
    const allowed = new Set(ALPHABET.split(''))
    for (let i = 0; i < 100; i++) {
      const pw = generatePassword(8)
      for (const ch of pw) expect(allowed.has(ch)).toBe(true)
    }
  })

  it('excludes confusable characters 0/O/1/I/L', () => {
    expect(ALPHABET).not.toMatch(/[01ILO]/)
  })

  it('throws on invalid length', () => {
    expect(() => generatePassword(0)).toThrow()
    expect(() => generatePassword(-1)).toThrow()
  })

  it('produces non-deterministic output', () => {
    const samples = new Set<string>()
    for (let i = 0; i < 50; i++) samples.add(generatePassword(8))
    // 50 samples × 31^8 space — collisions are astronomically unlikely
    expect(samples.size).toBe(50)
  })
})
