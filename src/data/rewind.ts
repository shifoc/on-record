import type { Play } from '../types'
import { COUNTED_PLAY_MS, dayNumber, fromDayNumber, startDate, trackKey } from './stats'

export interface RewindArtist {
  artist: string
  ms: number
  streams: number
  days: number
  first: number
}

export interface Comeback {
  artist: string
  gapDays: number
  previousAt: number
  returnedAt: number
  streams: number
  ms: number
}

export interface RewindMonth {
  year: number
  month: number
  ms: number
  streams: number
  activeDays: number
  artist: RewindArtist | null
  song: { title: string; artist: string; ms: number; streams: number } | null
  discovery: RewindArtist | null
  peak: { date: number; ms: number } | null
  familiarShare: number | null
}

export interface YearComparison {
  previousYear: number
  previousMs: number
  previousStreams: number
  hoursChange: number
  overlap: number
  compared: number
  entered: string[]
  exited: string[]
  climber: { artist: string; from: number; to: number } | null
}

export interface Rewind {
  musicMs: number
  streams: number
  songs: number
  activeDays: number
  first: number | null
  last: number | null
  artists: RewindArtist[]
  discoveries: RewindArtist[]
  returnedDiscoveries: number
  familiarShare: number | null
  comebacks: Comeback[]
  months: RewindMonth[]
  comparison: YearComparison | null
}

const monthIndex = (p: Play) => {
  const d = startDate(p)
  return d.getFullYear() * 12 + d.getMonth()
}
const byTime = (a: { ms: number; artist: string }, b: { ms: number; artist: string }) => b.ms - a.ms || a.artist.localeCompare(b.artist)
const music = (rows: Play[]) => rows.filter(p => p.kind === 'track' && p.msPlayed >= COUNTED_PLAY_MS)

function rankArtists(rows: Play[]): RewindArtist[] {
  const map = new Map<string, { ms: number; streams: number; days: Set<number>; first: number }>()
  for (const p of rows) {
    const date = startDate(p)
    const a = map.get(p.artist) ?? { ms: 0, streams: 0, days: new Set<number>(), first: date.getTime() }
    a.ms += p.msPlayed
    a.streams++
    a.days.add(dayNumber(date))
    a.first = Math.min(a.first, date.getTime())
    map.set(p.artist, a)
  }
  return [...map].map(([artist, a]) => ({ ...a, artist, days: a.days.size })).sort(byTime)
}

/**
 * Context has the same artist filters as the selected plays. Only counted music
 * enters this recap, so a brief accidental start never becomes a discovery.
 * Familiar means the song appears in an earlier calendar month in this export.
 */
export function buildRewind(plays: Play[], all: Play[], year: number | null): Rewind {
  const rows = music(plays).sort((a, b) => a.endTime - a.msPlayed - (b.endTime - b.msPlayed) || trackKey(a).localeCompare(trackKey(b)))
  const history = music(all).sort((a, b) => a.endTime - a.msPlayed - (b.endTime - b.msPlayed) || trackKey(a).localeCompare(trackKey(b)))
  const firstArtist = new Map<string, number>()
  const firstSong = new Map<string, number>()
  const artistHistory = new Map<string, Play[]>()
  for (const p of history) {
    if (!firstArtist.has(p.artist)) firstArtist.set(p.artist, startDate(p).getTime())
    const key = trackKey(p)
    if (!firstSong.has(key)) firstSong.set(key, monthIndex(p))
    const list = artistHistory.get(p.artist) ?? []
    list.push(p)
    artistHistory.set(p.artist, list)
  }
  const artists = rankArtists(rows)
  const discoveries = artists.filter(a => a.first === firstArtist.get(a.artist))
  const discoveryNames = new Set(discoveries.map(a => a.artist))
  const selected = new Set(rows)
  const total = rows.reduce((ms, p) => ms + p.msPlayed, 0)
  const familiarMs = (list: Play[]) => list.reduce((ms, p) => ms + ((firstSong.get(trackKey(p)) ?? Infinity) < monthIndex(p) ? p.msPlayed : 0), 0)

  // A single return is easy to overstate. Require three plays in the following
  // 30 calendar days, and never borrow evidence outside the selected period.
  const comebackByArtist = new Map<string, Comeback>()
  for (const [artist, list] of artistHistory) {
    for (let i = 1; i < list.length; i++) {
      if (!selected.has(list[i])) continue
      const previousAt = startDate(list[i - 1]).getTime()
      const returnedAt = startDate(list[i]).getTime()
      const day = dayNumber(new Date(returnedAt))
      const gapDays = day - dayNumber(new Date(previousAt))
      if (gapDays < 90) continue
      let streams = 0
      let ms = 0
      for (let j = i; j < list.length && dayNumber(startDate(list[j])) < day + 30; j++) {
        if (!selected.has(list[j])) continue
        streams++
        ms += list[j].msPlayed
      }
      const previous = comebackByArtist.get(artist)
      if (streams >= 3 && (!previous || gapDays > previous.gapDays || (gapDays === previous.gapDays && ms > previous.ms))) {
        comebackByArtist.set(artist, { artist, previousAt, returnedAt, gapDays, streams, ms })
      }
    }
  }
  const comebacks = [...comebackByArtist.values()].sort((a, b) => b.gapDays - a.gapDays || byTime(a, b))

  const monthRows = new Map<number, Play[]>()
  for (const p of rows) {
    const key = monthIndex(p)
    const list = monthRows.get(key) ?? []
    list.push(p)
    monthRows.set(key, list)
  }
  const months: RewindMonth[] = []
  const firstMonth = year === null ? (rows.length ? monthIndex(rows[0]) : 0) : year * 12
  const lastMonth = year === null ? (rows.length ? monthIndex(rows[rows.length - 1]) : -1) : year * 12 + 11
  for (let key = firstMonth; key <= lastMonth; key++) {
    const list = monthRows.get(key) ?? []
    const ranked = rankArtists(list)
    const songs = new Map<string, { title: string; artist: string; ms: number; streams: number }>()
    const days = new Map<number, number>()
    let ms = 0
    for (const p of list) {
      const songKey = trackKey(p)
      const song = songs.get(songKey) ?? { title: p.title, artist: p.artist, ms: 0, streams: 0 }
      song.ms += p.msPlayed
      song.streams++
      songs.set(songKey, song)
      const day = dayNumber(startDate(p))
      days.set(day, (days.get(day) ?? 0) + p.msPlayed)
      ms += p.msPlayed
    }
    const peak = [...days].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
    months.push({
      year: Math.floor(key / 12), month: key % 12, ms, streams: list.length, activeDays: days.size,
      artist: ranked[0] ?? null,
      song: [...songs.values()].sort((a, b) => byTime(a, b) || a.title.localeCompare(b.title))[0] ?? null,
      discovery: ranked.find(a => discoveryNames.has(a.artist) && Math.floor(key / 12) === new Date(firstArtist.get(a.artist)!).getFullYear() && key % 12 === new Date(firstArtist.get(a.artist)!).getMonth()) ?? null,
      peak: peak ? { date: fromDayNumber(peak[0]).getTime(), ms: peak[1] } : null,
      familiarShare: ms ? familiarMs(list) / ms : null,
    })
  }

  let comparison: YearComparison | null = null
  const previousRows = year === null ? [] : history.filter(p => startDate(p).getFullYear() === year - 1)
  if (year !== null && previousRows.length && rows.length) {
    const previousArtists = rankArtists(previousRows)
    const previousMs = previousRows.reduce((ms, p) => ms + p.msPlayed, 0)
    const currentTop = artists.slice(0, 10).map(a => a.artist)
    const previousTop = previousArtists.slice(0, 10).map(a => a.artist)
    const currentNames = new Set(currentTop)
    const previousNames = new Set(previousTop)
    const previousRanks = new Map(previousArtists.map((a, i) => [a.artist, i + 1]))
    let climber: YearComparison['climber'] = null
    for (let i = 0; i < Math.min(10, artists.length); i++) {
      const from = previousRanks.get(artists[i].artist) ?? 0
      const to = i + 1
      if (from > to && (!climber || from - to > climber.from - climber.to)) climber = { artist: artists[i].artist, from, to }
    }
    comparison = {
      previousYear: year - 1, previousMs, previousStreams: previousRows.length,
      hoursChange: total / previousMs - 1,
      overlap: currentTop.filter(a => previousNames.has(a)).length,
      compared: currentTop.length,
      entered: currentTop.filter(a => !previousNames.has(a)),
      exited: previousTop.filter(a => !currentNames.has(a)), climber,
    }
  }
  return {
    musicMs: total, streams: rows.length, songs: new Set(rows.map(trackKey)).size,
    activeDays: new Set(rows.map(p => dayNumber(startDate(p)))).size,
    first: rows.length ? startDate(rows[0]).getTime() : null,
    last: rows.length ? startDate(rows[rows.length - 1]).getTime() : null,
    artists, discoveries, returnedDiscoveries: discoveries.filter(a => a.streams >= 3 && a.days >= 2).length,
    familiarShare: total ? familiarMs(rows) / total : null,
    comebacks, months, comparison,
  }
}
