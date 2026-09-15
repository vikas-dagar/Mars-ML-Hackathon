import type { RouteResult } from '../types'

function Stat({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className={`stat ${warn ? 'warn' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function RouteStrip({ route }: { route: RouteResult }) {
  const etaSol = route.etaHours / 24.659
  const etaH = Math.floor(route.etaHours)
  const etaM = Math.round((route.etaHours - etaH) * 60)

  return (
    <footer className="route-strip">
      <div className="strip-title">
        <span className="live-dot" />
        Optimal surface path
      </div>
      <Stat label="Range" value={`${Math.round(route.distanceKm).toLocaleString()} km`} />
      <Stat label="Energy" value={`${Math.round(route.energyKwh).toLocaleString()} kWh`} />
      <Stat label="Solar window" value={`${route.solarPct}%`} />
      <Stat label="Dust risk" value={route.dust.toFixed(2)} warn={route.dust > 0.45} />
      <Stat label="Hazards" value={route.hazard.toFixed(2)} warn={route.hazard > 0.5} />
      <Stat
        label="ETA"
        value={etaSol >= 1 ? `${etaSol.toFixed(2)} sol` : `${etaH}h ${etaM}m`}
      />
      <div className="profile" aria-hidden>
        <svg viewBox="0 0 200 36" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            points={route.samples
              .map((y, i) => {
                const x = (i / (route.samples.length - 1)) * 200
                const yy = 18 - y * 14
                return `${x},${yy}`
              })
              .join(' ')}
          />
        </svg>
        <span>Elevation</span>
      </div>
    </footer>
  )
}
