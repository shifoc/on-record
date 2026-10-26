import { describe, expect, it } from 'vitest'
import { discoverySeeds, spotifySearchUrl, spotifySongUrl } from '../../src/data/discovery'
import { at, play } from '../helpers'

describe('new music starting points', () => {
  it('does not invent recommendations when there is no qualifying music', () => {
    expect(discoverySeeds([])).toEqual({ favorites: [], recent: [], detours: [], recentFrom: null, recentTo: null })
    expect(discoverySeeds([play(at(2024, 1, 1), { kind: 'episode' }), play(at(2024, 1, 1), { msPlayed: 29_999 })]).favorites).toEqual([])
  })

  it('uses only supplied filtered plays and favors artists with more listening time', () => {
    const rows = [play(at(2024, 1, 1), { artist: 'One' }), play(at(2024, 1, 2), { artist: 'Two', msPlayed: 360_000 })]
    expect(discoverySeeds(rows).favorites.map(s => s.artist)).toEqual(['Two', 'One'])
    expect(discoverySeeds(rows.slice(0, 1)).favorites.map(s => s.artist)).toEqual(['One'])
  })

  it('does not use mostly skipped artists or songs as evidence of taste', () => {
    const rows = [play(at(2024, 1, 1), { artist: 'Skipped', skipped: true, msPlayed: 900_000 }), play(at(2024, 1, 2), { artist: 'Loved' })]
    expect(discoverySeeds(rows).favorites.map(s => s.artist)).toEqual(['Loved'])
    expect(discoverySeeds([play(at(2024, 1, 1), { reasonEnd: 'fwdbtn' })]).favorites).toEqual([])
  })

  it('anchors recent taste to the last observed play and uses 90 local calendar days', () => {
    const r = discoverySeeds([
      play(at(2024, 1, 1), { artist: 'Old', msPlayed: 900_000 }),
      play(at(2024, 3, 1), { artist: 'Just outside' }),
      play(at(2024, 3, 2), { artist: 'Boundary' }),
      play(at(2024, 5, 30), { artist: 'Recent' }),
    ])
    expect(r.recent.map(s => s.artist)).toEqual(['Boundary', 'Recent'])
    expect(r.recentFrom).toBe(at(2024, 3, 2, 0).getTime())
    expect(r.recentTo).toBe(at(2024, 5, 30).getTime())
  })

  it('offers a side road only from repeated artists beyond the top three', () => {
    const rows = ['A', 'B', 'C', 'D', 'E'].flatMap((artist, i) => Array.from({ length: 7 - i }, (_, j) => play(at(2024, 1, j + 1), { artist })))
    expect(discoverySeeds(rows).detours.map(s => s.artist)).toEqual(['D', 'E'])
    expect(discoverySeeds(rows).detours[0]).toMatchObject({ streams: 4, skips: 0, title: 'Song' })
  })

  it('ranks songs deterministically and never mutates inputs', () => {
    const rows = [play(at(2024, 1, 1), { title: 'Z' }), play(at(2024, 1, 2), { title: 'A' })]
    const before = [...rows]
    const r = discoverySeeds(rows)
    expect(r.favorites[0].title).toBe('A')
    expect(discoverySeeds([...rows].reverse())).toEqual(r)
    expect(rows).toEqual(before)
  })

  it('creates only safe Spotify links and encodes arbitrary names as search text', () => {
    const id = '6rqhFgbbKwnb9MLmUQDhG6'
    expect(spotifySongUrl(`spotify:track:${id}`, 'Artist', 'Song')).toBe(`https://open.spotify.com/track/${id}`)
    const fallback = spotifySongUrl('javascript:alert(1)', 'A & B / X', 'Song? #1')
    expect(fallback).toBe(spotifySearchUrl('A & B / X Song? #1'))
    expect(new URL(fallback).origin).toBe('https://open.spotify.com')
    expect(decodeURIComponent(new URL(fallback).pathname.slice('/search/'.length))).toBe('A & B / X Song? #1')
    expect(spotifySongUrl('spotify:episode:' + id, 'Artist', 'Song')).toContain('/search/')
  })
})
