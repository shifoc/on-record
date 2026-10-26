import type { Rewind } from '../data/rewind'
import { formatDate, formatDuration, formatNumber, formatPercent } from '../lib/format'
import { SERIES } from '../lib/palette'
import { clip } from './posterShared'

/** A small story sized recap. Ellipsize names rather than shrinking them beyond phone readability. */
export function drawRewind(ctx: CanvasRenderingContext2D, width: number, height: number, data: Rewind, period: string) {
  ctx.save()
  ctx.scale(width / 1080, height / 1920)
  ctx.fillStyle = '#0b0a0f'
  ctx.fillRect(0, 0, 1080, 1920)
  const display = (size: number) => `650 ${size}px 'Bricolage Grotesque Variable', sans-serif`
  const text = (value: string, x: number, y: number, size: number, color = '#f4f1ea') => {
    ctx.font = display(size)
    ctx.fillStyle = color
    ctx.fillText(clip(ctx, value, 920), x, y)
  }
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  text('My Listening Record', 80, 120, 36)
  text(`${period} / Your Rewind`, 80, 180, 36, '#a8a39b')
  text(formatNumber(data.musicMs / 60_000), 80, 420, 160, SERIES[0])
  text('minutes of music.', 80, 490, 58)
  const leader = data.artists[0]
  if (leader) {
    text('The leading role', 80, 625, 36, '#a8a39b')
    text(leader.artist, 80, 700, 64)
    text(`${formatDuration(leader.ms)}, ${formatPercent(leader.ms / data.musicMs)} of your time`, 80, 760, 36)
  }
  const facts = [
    [formatNumber(data.streams), 'counted plays'],
    [formatNumber(data.songs), 'different songs'],
    [formatNumber(data.artists.length), 'artists'],
    [formatNumber(data.activeDays), 'days with music'],
  ]
  facts.forEach(([value, label], i) => {
    const x = i % 2 === 0 ? 80 : 560
    const y = 930 + Math.floor(i / 2) * 170
    text(value, x, y, 64)
    text(label, x, y + 50, 34, '#a8a39b')
  })
  text('Your leading artists', 80, 1275, 36, '#a8a39b')
  data.artists.slice(0, 3).forEach((a, i) => text(`${i + 1}. ${a.artist}`, 80, 1350 + i * 80, 48))
  text(`${formatNumber(data.discoveries.length)} artists first recorded in this period.`, 80, 1650, 36)
  if (data.first !== null && data.last !== null) text(`${formatDate(data.first)} to ${formatDate(data.last)}`, 80, 1740, 34, '#a8a39b')
  text('Music plays of 30+ seconds. From the loaded history.', 80, 1810, 32, '#a8a39b')
  ctx.restore()
}
