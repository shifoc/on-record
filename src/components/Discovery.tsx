import { useContext, useState } from 'react'
import type { DiscoverySeeds } from '../data/discovery'
import { spotifySearchUrl, spotifySongUrl } from '../data/discovery'
import { formatDate, formatDuration, formatNumber } from '../lib/format'
import { InCards } from '../lib/stage'
import { Cover } from './Cover'
import { Segmented } from './ui'

type Route = 'favorites' | 'recent' | 'detours'

const ROUTES: { value: Route; label: string }[] = [
  { value: 'favorites', label: 'Your favorites' },
  { value: 'recent', label: 'Recent taste' },
  { value: 'detours', label: 'A side road' },
]

interface Props {
  seeds: DiscoverySeeds
  isSample: boolean
}

export function Discovery({ seeds, isSample }: Props) {
  const cards = useContext(InCards)
  const [route, setRoute] = useState<Route>('favorites')
  const [positions, setPositions] = useState<Record<Route, number>>({ favorites: 0, recent: 0, detours: 0 })
  const list = seeds[route]
  const position = positions[route]
  const seed = list[position]
  const move = (delta: number) => setPositions(p => ({ ...p, [route]: Math.max(0, Math.min(list.length - 1, position + delta)) }))
  const recentRange = seeds.recentFrom !== null && seeds.recentTo !== null ? `${formatDate(seeds.recentFrom)} to ${formatDate(seeds.recentTo)}` : ''

  return (
    <div className="discovery">
      <Segmented label="Discovery starting points" options={ROUTES} value={route} onChange={setRoute} />
      <p className="discovery__intro">
        {route === 'favorites' && (cards ? 'Find new music from a favorite.' : 'Follow a favorite into something you have not heard yet.')}
        {route === 'recent' && (cards ? 'Follow your latest 90 recorded days.' : 'Start with the last 90 days of listening in this period.')}
        {route === 'detours' && (cards ? 'Explore beyond your top three.' : 'Go beyond your top three with an artist you returned to.')}
      </p>
      {isSample ? <div className="discovery__empty">
        <h3>A made up record.<br /><em>A real way to explore.</em></h3>
        <p>The demo uses invented artists, so it cannot link you to their music. Import your export to choose real starting points.</p>
      </div> : seed ? <div className="discovery__body">
        <div className="discovery__seed">
          <Cover name={seed.artist} size={cards ? 48 : 112} />
          <div className="discovery__identity">
            <p className="discovery__label">Start from</p>
            <h3 title={seed.artist}>{seed.artist}</h3>
            <p className="discovery__song" title={seed.title}>{seed.title}</p>
          </div>
        </div>
        <p className="discovery__evidence">
          {formatNumber(seed.streams)} plays, {formatDuration(seed.ms)} with this artist{route === 'recent' ? ' in the recent window' : ' in this period'}. {formatNumber(seed.songStreams)} plays of this song.
        </p>
        <div className="discovery__steps">
          {cards ? <p>In Spotify, open the song’s three dot menu and choose <strong>Go to Radio</strong>.</p> : <>
            <p><b>1.</b> Open the song on Spotify.</p>
            <p><b>2.</b> Open its three dot menu and choose <strong>Go to Radio</strong> for more music like it.</p>
          </>}
        </div>
        <div className="discovery__links">
          <a className="button" href={spotifySongUrl(seed.uri, seed.artist, seed.title)} target="_blank" rel="noreferrer">Open song on Spotify ↗</a>
          {!cards && <a className="discovery__search" href={spotifySearchUrl(`${seed.artist} radio`)} target="_blank" rel="noreferrer">Or search radio playlists ↗</a>}
        </div>
        <nav className="discovery__next" aria-label="Discovery seeds">
          <button className="chip-button" type="button" aria-label="Previous starting point" onClick={() => move(-1)} disabled={position === 0}>←</button>
          <span role="status">{position + 1} of {list.length} starting points</span>
          <button className="chip-button" type="button" aria-label="Next starting point" onClick={() => move(1)} disabled={position === list.length - 1}>→</button>
        </nav>
      </div> : <div className="discovery__empty">
        <h3>{route === 'detours' ? 'A little more variety first.' : 'No starting point here yet.'}</h3>
        <p>{route === 'detours' ? 'This route needs an artist outside your top three with at least three counted plays. Try another route or a longer period.' : 'Try another period. Starting points need music plays of at least 30 seconds and cannot be mostly skipped.'}</p>
      </div>}
      <div className="discovery__note">
        <p>{cards ? 'Spotify finds related music and may repeat familiar songs. Only opening a link leaves this app.' : 'Spotify supplies the new music and may include songs you already know. The app chooses starting points from your export; it does not check Spotify’s catalog.'}</p>
        <p>{!cards && 'Nothing is sent until you open a link. '}{route === 'recent' && recentRange ? `Recent window: ${recentRange}.` : 'Music plays of 30+ seconds. Your filters apply.'}</p>
      </div>
    </div>
  )
}
