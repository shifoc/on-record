import type { Play } from '../types'
import { COUNTED_PLAY_MS, dayNumber, fromDayNumber, isSkip, startDate, trackKey } from './stats'

export interface DiscoverySeed {
  artist: string
  title: string
  uri: string
  ms: number
  streams: number
  skips: number
  songStreams: number
}

export interface DiscoverySeeds {
  favorites: DiscoverySeed[]
  recent: DiscoverySeed[]
  detours: DiscoverySeed[]
  recentFrom: number | null
  recentTo: number | null
}

interface Song {
  title: string
  uri: string
  ms: number
  streams: number
  skips: number
}

function rankSeeds(rows: Play[]): DiscoverySeed[] {
  const artists = new Map<string, { ms: number; streams: number; skips: number; songs: Map<string, Song> }>()
  for (const p of rows) {
    const a = artists.get(p.artist) ?? { ms: 0, streams: 0, skips: 0, songs: new Map<string, Song>() }
    a.ms += p.msPlayed
    a.streams++
    if (isSkip(p)) a.skips++
    const key = trackKey(p)
    const song = a.songs.get(key) ?? { title: p.title, uri: p.uri, ms: 0, streams: 0, skips: 0 }
    song.ms += p.msPlayed
    song.streams++
    if (isSkip(p)) song.skips++
    a.songs.set(key, song)
    artists.set(p.artist, a)
  }
  const out: DiscoverySeed[] = []
  for (const [artist, a] of artists) {
    // A long start is not always a favorite. Avoid turning mostly skipped
    // artists or songs into a claim about what someone wants more of.
    if (a.skips / a.streams > 0.5) continue
    const song = [...a.songs.values()]
      .filter(s => s.skips / s.streams <= 0.5)
      .sort((a, b) => b.ms - a.ms || a.title.localeCompare(b.title) || a.uri.localeCompare(b.uri))[0]
    if (!song) continue
    out.push({ artist, ms: a.ms, streams: a.streams, skips: a.skips, title: song.title, uri: song.uri, songStreams: song.streams })
  }
  return out.sort((a, b) => b.ms - a.ms || a.artist.localeCompare(b.artist))
}

/** Choose explainable radio starting points, not pretend unheard catalog tracks. */
export function discoverySeeds(plays: Play[]): DiscoverySeeds {
  const rows = plays.filter(p => p.kind === 'track' && p.msPlayed >= COUNTED_PLAY_MS)
  if (!rows.length) return { favorites: [], recent: [], detours: [], recentFrom: null, recentTo: null }
  const ranked = rankSeeds(rows)
  const latest = rows.reduce((last, p) => Math.max(last, startDate(p).getTime()), -Infinity)
  const firstDay = dayNumber(new Date(latest)) - 89
  const recent = rankSeeds(rows.filter(p => dayNumber(startDate(p)) >= firstDay))
  const leaders = new Set(ranked.slice(0, 3).map(a => a.artist))
  return {
    favorites: ranked.slice(0, 12),
    recent: recent.slice(0, 12),
    detours: ranked.filter(a => !leaders.has(a.artist) && a.streams >= 3).slice(0, 12),
    recentFrom: fromDayNumber(firstDay).getTime(),
    recentTo: latest,
  }
}

export function spotifySearchUrl(query: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`
}

/** Only known track URI syntax becomes a link; everything else is search text. */
export function spotifySongUrl(uri: string, artist: string, title: string): string {
  const id = /^spotify:track:([a-zA-Z0-9]{22})$/.exec(uri)?.[1]
  return id ? `https://open.spotify.com/track/${id}` : spotifySearchUrl(`${artist} ${title}`)
}
