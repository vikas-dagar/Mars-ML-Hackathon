import { useMemo, useState } from 'react'
import { CURRENT_LOCATION, DESTINATIONS, type Destination } from '../data/destinations'
import { formatLatLon } from '../lib/geo'
import type { MissionType } from '../types'

const MISSIONS: {
  id: MissionType
  title: string
  blurb: string
  icon: 'cargo' | 'crew' | 'evac'
}[] = [
  { id: 'supplies', title: 'Supplies', blurb: 'Cargo rover', icon: 'cargo' },
  { id: 'crew', title: 'Crew', blurb: 'Pressurized vehicle', icon: 'crew' },
  { id: 'emergency', title: 'Emergency', blurb: 'Fast-response rover', icon: 'evac' },
]

function Icon({ kind }: { kind: 'cargo' | 'crew' | 'evac' }) {
  if (kind === 'cargo') {
    return (
      <svg viewBox="0 0 64 40" className="mission-icon" aria-hidden>
        <rect x="6" y="16" width="36" height="14" rx="2" />
        <rect x="14" y="10" width="20" height="8" rx="1.5" />
        <circle cx="16" cy="32" r="5" />
        <circle cx="36" cy="32" r="5" />
        <rect x="44" y="18" width="12" height="8" rx="1" />
      </svg>
    )
  }
  if (kind === 'crew') {
    return (
      <svg viewBox="0 0 64 40" className="mission-icon" aria-hidden>
        <rect x="8" y="18" width="40" height="12" rx="6" />
        <path d="M18 18 V12 h20 a8 8 0 0 1 8 8" />
        <circle cx="20" cy="32" r="5" />
        <circle cx="42" cy="32" r="5" />
        <circle cx="28" cy="15" r="3.2" />
        <circle cx="36" cy="15" r="3.2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 64 40" className="mission-icon" aria-hidden>
      <path d="M12 26 L32 14 L50 26" />
      <rect x="16" y="22" width="28" height="8" rx="2" />
      <circle cx="22" cy="32" r="4.2" />
      <circle cx="40" cy="32" r="4.2" />
      <circle cx="48" cy="12" r="3.2" />
    </svg>
  )
}

type Props = {
  mission: MissionType
  onMission: (m: MissionType) => void
  destination: Destination | null
  onDestination: (d: Destination | null, query: string) => void
  onPlot: () => void
  plotting: boolean
  routeOn: boolean
}

export function RoutePanel({
  mission,
  onMission,
  destination,
  onDestination,
  onPlot,
  plotting,
  routeOn,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return DESTINATIONS
    return DESTINATIONS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        formatLatLon(d.lat, d.lon).toLowerCase().includes(q),
    )
  }, [query])

  const cta =
    mission === 'emergency' ? 'Calculate evacuation' : routeOn ? 'Recalculate route' : 'Calculate route'

  return (
    <aside className={`glass-panel ${routeOn ? 'minimized' : ''}`}>
      {!routeOn && <h2>Where are you going?</h2>}

      <div className="waypoint from">
        <span className="way-label">From</span>
        <strong>{CURRENT_LOCATION.name}</strong>
        <em>{formatLatLon(CURRENT_LOCATION.lat, CURRENT_LOCATION.lon)}</em>
      </div>

      <div className="route-connector" aria-hidden>
        <span className="connector-line" />
        <span className="connector-pulse" />
      </div>

      <div className={`waypoint to ${open ? 'open' : ''}`}>
        <span className="way-label">To</span>
        <input
          value={destination && !open ? destination.name : query}
          placeholder="Enter coordinates or destination"
          onFocus={() => {
            setOpen(true)
            setQuery(destination?.name ?? '')
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            onDestination(null, e.target.value)
            setOpen(true)
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          spellCheck={false}
        />
        {destination && !open && (
          <em>
            {destination.code} · {formatLatLon(destination.lat, destination.lon)}
          </em>
        )}
        {open && (
          <ul className="dest-list">
            {matches.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onDestination(d, d.name)
                    setQuery(d.name)
                    setOpen(false)
                  }}
                >
                  <span>{d.name}</span>
                  <small>{d.code}</small>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="empty">No catalog match</li>}
          </ul>
        )}
      </div>

      {!routeOn && (
        <>
          <div className="dest-chips">
            {DESTINATIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={destination?.id === d.id ? 'on' : ''}
                onClick={() => {
                  onDestination(d, d.name)
                  setQuery(d.name)
                  setOpen(false)
                }}
              >
                {d.name}
              </button>
            ))}
          </div>

          <p className="section-label">Mission</p>
          <div className="missions">
            {MISSIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mission ${mission === m.id ? 'active' : ''} ${m.id}`}
                onClick={() => onMission(m.id)}
              >
                <Icon kind={m.icon} />
                <strong>{m.title}</strong>
                <span>{m.blurb}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`cta ${mission}`}
            onClick={onPlot}
            disabled={!destination || plotting}
          >
            {plotting ? 'Solving terrain graph…' : `${cta} →`}
          </button>
        </>
      )}
    </aside>
  )
}
