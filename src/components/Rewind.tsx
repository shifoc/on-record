import { useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Rewind as RewindData } from '../data/rewind'
import { formatDate, formatDuration, formatMonthYear, formatNumber, formatPercent } from '../lib/format'
import { InCards } from '../lib/stage'
import { drawRewind } from '../viz/rewind'
import { renderBlob } from '../viz/posterShared'

const PAGES = ['The headline', 'What changed', 'Discoveries', 'The comeback', 'Month by month']

interface Props {
  data: RewindData
  year: number | null
  years: number[]
  onYear: (year: number) => void
}

export function Rewind({ data, year, years, onYear }: Props) {
  const [page, setPage] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [message, setMessage] = useState('')
  const cards = useContext(InCards)
  const artist = data.artists[0]
  const period = year === null ? 'All time' : String(year)

  async function save() {
    setSaving(true)
    setSaveFailed(false)
    setMessage('')
    try {
      await document.fonts.ready
      const image = await renderBlob(1080, 1920, [1, 0.5], (ctx, w, h) => drawRewind(ctx, w, h, data, period))
      if (!image) throw new Error('Image unavailable')
      const url = URL.createObjectURL(image.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `my-listening-rewind-${year ?? 'all-time'}.png`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setMessage('Your recap is ready.')
    } catch {
      setSaveFailed(true)
      setMessage('Could not make the image on this device. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!data.streams) return <p className="empty">Your Rewind needs music plays of at least 30 seconds. There are none in this period.</p>

  return (
    <div className="rewind">
      <div className="rewind__masthead">
        <span>{period} / Your Rewind</span>
        <span>{page + 1} of {PAGES.length}</span>
      </div>
      <div className={`rewind__panel rewind__panel--${page}`} role="region" aria-label={PAGES[page]}>
        {page === 0 && (
          <>
            <div className="rewind__feature">
              <p className="rewind__eyebrow">Time well played</p>
              <h3 className="rewind__number">{formatNumber(data.musicMs / 60_000)}<span>minutes of music.</span></h3>
              <p className="rewind__voice">And <em>{artist.artist}</em> had the leading role.</p>
              <p className="rewind__proof">{formatDuration(artist.ms)}, {formatPercent(artist.ms / data.musicMs)} of your listening.</p>
            </div>
            <div className="rewind__detail">
              <div className="rewind__stats">
                <Stat value={formatNumber(data.streams)} label="counted plays" />
                <Stat value={formatNumber(data.artists.length)} label="artists" />
                <Stat value={formatNumber(data.songs)} label="different songs" />
                <Stat value={formatNumber(data.activeDays)} label="days with music" />
              </div>
              {!cards && <ol className="rewind__ranking" aria-label="Leading artists">
                {data.artists.slice(0, 3).map((a, i) => (
                  <li key={a.artist}><span className="rewind__rank">0{i + 1}</span><strong>{a.artist}</strong><span>{formatDuration(a.ms)}</span></li>
                ))}
              </ol>}
              <button type="button" className="button button--small" onClick={save} disabled={saving}>{saving ? 'Making your recap…' : saveFailed ? 'Could not save. Try again' : 'Save recap PNG'}</button>
              <p className={cards ? 'sr-only' : 'rewind__message'} role="status">{message}</p>
            </div>
          </>
        )}

        {page === 1 && <ComparisonPage data={data} year={year} years={years} onYear={onYear} cards={cards} />}

        <DiscoveryPage active={page === 2} data={data} cards={cards} />

        <ComebackPage active={page === 3} data={data} cards={cards} />

        <MonthPage active={page === 4} data={data} cards={cards} />
      </div>
      <div className="rewind__footer">
        <p className="rewind__method">Music plays of 30+ seconds. Local playback start dates. {data.first !== null && data.last !== null && !cards && `${formatDate(data.first)} to ${formatDate(data.last)}.`}</p>
        <nav className="rewind__nav" aria-label="Rewind pages">
          <button type="button" className="chip-button" onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Previous recap page">←</button>
          {PAGES.map((name, i) => <button type="button" key={name} aria-label={name} aria-pressed={page === i} className="rewind__page" onClick={() => setPage(i)}>{i + 1}</button>)}
          <button type="button" className="chip-button" onClick={() => setPage(page + 1)} disabled={page === PAGES.length - 1} aria-label="Next recap page">→</button>
        </nav>
        <p className="rewind__page-title" aria-live="polite">{PAGES[page]}</p>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rewind__stat"><strong>{value}</strong><span>{label}</span></div>
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rewind__fact"><p className="rewind__eyebrow">{label}</p><p>{children}</p></div>
}

function ComparisonPage({ data, year, years, onYear, cards }: Props & { cards: boolean }) {
  const comparison = data.comparison
  const availableYears = new Set(years)
  return (
    comparison ? <>
      <div className="rewind__feature">
        <p className="rewind__eyebrow">Compared with {comparison.previousYear}</p>
        <h3 className="rewind__number">{formatPercent(Math.abs(comparison.hoursChange))}<span>{comparison.hoursChange >= 0 ? 'more music.' : 'less music.'}</span></h3>
        <p className="rewind__voice">{comparison.overlap} of your top {comparison.compared} artists <em>stayed in the mix.</em></p>
        <p className="rewind__proof">{formatDuration(comparison.previousMs)} then. {formatDuration(data.musicMs)} now.{!cards && ' Rankings use listening time.'}</p>
      </div>
      <div className="rewind__detail">
        <Fact label="Entered your top ten">{comparison.entered.length ? comparison.entered.slice(0, cards ? 2 : 5).join(', ') : 'No new entries'}</Fact>
        <Fact label="Left your top ten">{comparison.exited.length ? comparison.exited.slice(0, cards ? 2 : 5).join(', ') : 'Everyone held on'}</Fact>
        {!cards && comparison.climber && <Fact label="Biggest climb into this top ten">{comparison.climber.artist}<small>#{comparison.climber.from} to #{comparison.climber.to}</small></Fact>}
        <p className="rewind__proof">{cards ? 'Available totals. Either year may be partial.' : 'Available records only. Either year may be partial; these are totals, not a matched date comparison.'}</p>
      </div>
    </> : <div className="rewind__feature rewind__feature--wide">
      <p className="rewind__eyebrow">A little perspective</p>
      <h3 className="rewind__voice">See how your <em>taste changed.</em></h3>
      <p>{year === null ? 'Choose a year to compare it with the calendar year before it.' : `There are no counted music plays for ${year - 1} in this filtered history. Choose another year to compare.`}</p>
      <div className="rewind__year-options">
        {years.filter(y => availableYears.has(y - 1) && y !== year).slice(-5).map(y => <button className="chip-button" type="button" key={y} onClick={() => onYear(y)}>{y}</button>)}
      </div>
      <p className="rewind__proof">Comparisons need music in two consecutive years. Your export determines what is available.</p>
    </div>
  )
}

function DiscoveryPage({ active, data, cards }: { active: boolean; data: RewindData; cards: boolean }) {
  const [guess, setGuess] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  if (!active) return null
  return (
    <>
      <div className="rewind__feature">
        <p className="rewind__eyebrow">New to your record</p>
        <h3 className="rewind__number">{formatNumber(data.discoveries.length)}<span>{cards ? 'new artists in your record.' : 'artists appeared for the first time.'}</span></h3>
        {(!cards || !revealed) && <p className="rewind__voice">How many <em>earned a return?</em></p>}
        {!revealed ? <div className="rewind__guess">
          <label htmlFor="rewind-guess">Your guess: {formatNumber(guess ?? 0)}</label>
          <input id="rewind-guess" type="range" min={0} max={data.discoveries.length} value={guess ?? 0} onChange={e => setGuess(Number(e.target.value))} />
          <button type="button" className="button button--small" onClick={() => setRevealed(true)}>Reveal the answer</button>
        </div> : <p className="rewind__answer" role="status"><strong>{formatNumber(data.returnedDiscoveries)}</strong> earned a return.{guess !== null && <small>{guess === data.returnedDiscoveries ? 'You called it.' : `Your guess was ${formatNumber(Math.abs(guess - data.returnedDiscoveries))} ${guess > data.returnedDiscoveries ? 'too high' : 'too low'}.`}</small>}</p>}
        <p className="rewind__proof">A return means 3+ plays across 2+ days in this period.</p>
      </div>
      <div className="rewind__detail" hidden={cards && !revealed}>
        <p className="rewind__eyebrow">Discoveries you played most</p>
        {data.discoveries.length ? <ol className="rewind__ranking rewind__ranking--discoveries">
          {data.discoveries.slice(0, cards ? 1 : 4).map(a => <li key={a.artist}><div><strong>{a.artist}</strong><small>First recorded {formatDate(a.first)}</small></div><span>{formatNumber(a.streams)} plays<small>{a.days} days</small></span></li>)}
        </ol> : <p>No artists first appeared in this period. Familiar company.</p>}
        <p className="rewind__proof">{cards ? 'First seen in this export, not necessarily your first ever listen.' : 'First recorded in the loaded history, not necessarily your first ever listen. The earliest export period will include existing favorites.'}</p>
      </div>
    </>
  )
}

function ComebackPage({ active, data, cards }: { active: boolean; data: RewindData; cards: boolean }) {
  const [comebackAt, setComebackAt] = useState(0)
  const comeback = data.comebacks[comebackAt]
  if (!active) return null
  return (
    comeback ? <>
      <div className="rewind__feature">
        <p className="rewind__eyebrow">The long way back</p>
        <h3 className="rewind__number">{formatNumber(comeback.gapDays)}<span>days apart.</span></h3>
        <p className="rewind__voice">Then <em>{comeback.artist}</em> was back on repeat.</p>
        {!cards && <p className="rewind__proof">From {formatDate(comeback.previousAt)} to {formatDate(comeback.returnedAt)}.</p>}
      </div>
      <div className="rewind__detail">
        <div className="rewind__stats">
          <Stat value={formatNumber(comeback.streams)} label="plays in the return window" />
          <Stat value={formatDuration(comeback.ms)} label="back together" />
        </div>
        <p className="rewind__proof">{cards ? '90+ days away, then 3+ plays in 30 days. Only this period counts.' : 'At least 90 calendar days without a counted play, followed by 3+ plays in 30 days. Only return plays within this period count.'}</p>
        {data.comebacks.length > 1 && <label className="rewind__select">Another comeback
          <select value={comebackAt} onChange={e => setComebackAt(Number(e.target.value))}>{data.comebacks.map((a, i) => <option key={a.artist} value={i}>{a.artist} ({a.gapDays} days)</option>)}</select>
        </label>}
      </div>
    </> : <div className="rewind__feature rewind__feature--wide">
      <p className="rewind__eyebrow">The comeback</p>
      <h3 className="rewind__voice">No big reunion. <em>Yet.</em></h3>
      <p>No artist returned after a 90 day absence with at least three plays in the following 30 days within this period.</p>
      <p className="rewind__proof">Try a longer history or another year. A single play after a long gap does not qualify.</p>
    </div>
  )
}

function MonthPage({ active, data, cards }: { active: boolean; data: RewindData; cards: boolean }) {
  const [monthAt, setMonthAt] = useState(() => Math.max(0, data.months.findIndex(m => m.ms > 0)))
  const month = data.months[monthAt]
  const maxMonth = Math.max(1, ...data.months.map(m => m.ms))
  if (!active) return null
  if (!month) return null
  return (
    <>
      <div className="rewind__feature">
        <label className="rewind__select">Your monthly soundtrack
          <select aria-label="Soundtrack month" value={monthAt} onChange={e => setMonthAt(Number(e.target.value))}>{data.months.map((m, i) => <option key={`${m.year}-${m.month}`} value={i}>{formatMonthYear(new Date(m.year, m.month, 1))}</option>)}</select>
        </label>
        {month.song ? <>
          <p className="rewind__eyebrow">The song of the month</p>
          <h3 className="rewind__voice"><em>{month.song.title}</em></h3>
          <p>{month.song.artist}. {formatNumber(month.song.streams)} plays, {formatDuration(month.song.ms)}.</p>
          {!cards && <p className="rewind__proof">Ranked by counted listening time.</p>}
        </> : <><h3 className="rewind__voice">A quiet <em>month.</em></h3><p>No counted music plays in this month of the export.</p></>}
        <div className="rewind__months" role="group" aria-label="Monthly listening time">
          {data.months.map((m, i) => <button key={`${m.year}-${m.month}`} type="button" aria-label={`${formatMonthYear(new Date(m.year, m.month, 1))}: ${formatDuration(m.ms)}`} aria-pressed={i === monthAt} onClick={() => setMonthAt(i)}><span style={{ height: `${Math.max(3, m.ms / maxMonth * 100)}%` }} /></button>)}
        </div>
        {!cards && <p className="rewind__proof">Bar height is listening time. Pick a month to read it.</p>}
      </div>
      <div className="rewind__detail">
        <div className="rewind__stats">
          <Stat value={formatDuration(month.ms)} label="of music" />
          <Stat value={formatNumber(month.activeDays)} label="days with music" />
        </div>
        <Fact label="Leading artist">{month.artist?.artist ?? 'No recorded listening'}</Fact>
        <Fact label="Biggest discovery">{month.discovery?.artist ?? 'No new artist recorded'}</Fact>
        {!cards && month.peak && <Fact label="Biggest listening day">{formatDate(month.peak.date)}<small>{formatDuration(month.peak.ms)}</small></Fact>}
        <p className="rewind__proof">{month.familiarShare === null ? 'No listening to compare.' : `${formatPercent(month.familiarShare)} of this month went to songs already recorded in earlier months.`}</p>
      </div>
    </>
  )
}
