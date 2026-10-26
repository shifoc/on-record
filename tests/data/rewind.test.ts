import { describe, expect, it } from 'vitest'
import { buildRewind } from '../../src/data/rewind'
import { at, play, sorted } from '../helpers'

const make = (rows: ReturnType<typeof play>[], year: number | null = null) => {
  const all = sorted(rows)
  return buildRewind(year === null ? all : all.filter(p => new Date(p.endTime - p.msPlayed).getFullYear() === year), all, year)
}

describe('listening rewind', () => {
  it('has honest empty states for no music or only short starts', () => {
    for (const rows of [[], [play(at(2024, 1, 1), { kind: 'episode' })], [play(at(2024, 1, 1), { msPlayed: 29_999 })]]) {
      const r = make(rows)
      expect(r.streams).toBe(0)
      expect(r.musicMs).toBe(0)
      expect(r.discoveries).toEqual([])
      expect(r.comebacks).toEqual([])
      expect(r.comparison).toBeNull()
      expect(r.familiarShare).toBeNull()
    }
  })

  it('counts music at the threshold and uses the local start year across midnight', () => {
    const r = make([play(at(2023, 12, 31, 23, 59)), play(at(2024, 1, 1), { msPlayed: 30_000 }), play(at(2024, 1, 2), { msPlayed: 1 })], 2024)
    expect(r.streams).toBe(1)
    expect(r.musicMs).toBe(30_000)
    expect(r.comparison?.previousStreams).toBe(1)
    expect(r.discoveries).toEqual([])
    expect(r.months).toHaveLength(12)
    expect(r.months[0].streams).toBe(1)
    expect(r.months[1].streams).toBe(0)
    expect(r.months[1].song).toBeNull()
  })

  it('distinguishes discoveries that returned on another day from one offs', () => {
    const r = make([
      play(at(2023, 1, 1), { artist: 'Known' }),
      play(at(2024, 1, 1), { artist: 'Known' }),
      play(at(2024, 1, 2), { artist: 'New' }),
      play(at(2024, 1, 2, 13), { artist: 'New' }),
      play(at(2024, 1, 3), { artist: 'New' }),
      play(at(2024, 1, 4), { artist: 'Once' }),
      play(at(2024, 1, 5), { artist: 'Too short', msPlayed: 100 }),
    ], 2024)
    expect(r.discoveries.map(a => a.artist)).toEqual(['New', 'Once'])
    expect(r.returnedDiscoveries).toBe(1)
    expect(r.discoveries[0].days).toBe(2)
    expect(r.familiarShare).toBeCloseTo(1 / 5)
    expect(r.months[0].discovery?.artist).toBe('New')
  })

  it('requires a 90 calendar day absence and a sustained return within the selected period', () => {
    const r = make([
      play(at(2023, 10, 1), { artist: 'Back' }),
      play(at(2024, 1, 1), { artist: 'Back' }),
      play(at(2024, 1, 2), { artist: 'Back' }),
      play(at(2024, 1, 30), { artist: 'Back' }),
      play(at(2024, 2, 1), { artist: 'Back' }),
      play(at(2023, 1, 1), { artist: 'One return' }),
      play(at(2024, 1, 1), { artist: 'One return' }),
    ], 2024)
    expect(r.comebacks).toHaveLength(1)
    expect(r.comebacks[0]).toMatchObject({ artist: 'Back', gapDays: 92, streams: 3, ms: 540_000 })
    expect(r.comebacks[0].returnedAt).toBe(at(2024, 1, 1).getTime())
  })

  it('uses calendar days across DST and excludes evidence beyond the selected year', () => {
    const r = make([
      play(at(2024, 8, 31), { artist: 'Back' }),
      play(at(2024, 11, 29), { artist: 'Back' }),
      play(at(2024, 11, 30), { artist: 'Back' }),
      play(at(2024, 12, 1), { artist: 'Back' }),
      play(at(2023, 1, 1), { artist: 'Next year' }),
      play(at(2024, 12, 31), { artist: 'Next year' }),
      play(at(2025, 1, 1), { artist: 'Next year' }),
      play(at(2025, 1, 2), { artist: 'Next year' }),
    ], 2024)
    expect(r.comebacks.map(a => [a.artist, a.gapDays])).toEqual([['Back', 90]])
  })

  it('compares the previous calendar year, including exits and entrants', () => {
    const r = make([
      play(at(2023, 1, 1), { artist: 'Old' }),
      play(at(2023, 1, 2), { artist: 'Stays' }),
      play(at(2024, 1, 1), { artist: 'Stays', msPlayed: 360_000 }),
      play(at(2024, 1, 2), { artist: 'New' }),
    ], 2024)
    expect(r.comparison).toMatchObject({ previousYear: 2023, previousStreams: 2, hoursChange: 0.5, overlap: 1, entered: ['New'], exited: ['Old'] })
    expect(r.comparison?.climber).toMatchObject({ artist: 'Stays', from: 2, to: 1 })
    expect(make([play(at(2022, 1, 1)), play(at(2024, 1, 1))], 2024).comparison).toBeNull()
  })

  it('keeps silent months between observations and ranks ties independently of input order', () => {
    const rows = [play(at(2024, 1, 1), { artist: 'Zed', title: 'Z' }), play(at(2024, 3, 1), { artist: 'Alpha', title: 'A' })]
    const r = make(rows)
    expect(r.months.map(m => m.streams)).toEqual([1, 0, 1])
    expect(r.artists[0].artist).toBe('Alpha')
    expect(buildRewind([...rows].reverse(), [...rows].reverse(), null)).toEqual(r)
  })

  it('measures familiar songs against earlier calendar months and honors the supplied filter', () => {
    const rows = [play(at(2024, 1, 1)), play(at(2024, 2, 1)), play(at(2024, 2, 2), { title: 'Other' })]
    const r = make(rows)
    expect(r.familiarShare).toBeCloseTo(1 / 3)
    expect(r.months[1].familiarShare).toBeCloseTo(0.5)
    expect(r.activeDays).toBe(3)
    expect(r.songs).toBe(2)
    expect(r.months[1].peak?.ms).toBe(180_000)
    const hidden = rows.filter(p => p.title !== 'Other')
    expect(buildRewind(hidden, hidden, null).songs).toBe(1)
  })

  it('does not call three plays on one day a returning discovery', () => {
    const r = make([play(at(2024, 1, 1)), play(at(2024, 1, 1, 13)), play(at(2024, 1, 1, 14))])
    expect(r.discoveries).toHaveLength(1)
    expect(r.returnedDiscoveries).toBe(0)
  })

  it('keeps the longest qualifying comeback per artist and rejects an 89 day gap', () => {
    const r = make([
      play(at(2024, 1, 1)),
      play(at(2024, 3, 30)), play(at(2024, 3, 31)), play(at(2024, 4, 1)),
      play(at(2024, 7, 1)), play(at(2024, 7, 2)), play(at(2024, 7, 3)),
      play(at(2024, 12, 1)), play(at(2024, 12, 2)), play(at(2024, 12, 3)),
    ])
    expect(r.comebacks).toHaveLength(1)
    expect(r.comebacks[0]).toMatchObject({ gapDays: 151, returnedAt: at(2024, 12, 1).getTime(), streams: 3 })
    expect(make([play(at(2024, 1, 1)), play(at(2024, 3, 30)), play(at(2024, 3, 31)), play(at(2024, 4, 1))]).comebacks).toEqual([])
  })
})
