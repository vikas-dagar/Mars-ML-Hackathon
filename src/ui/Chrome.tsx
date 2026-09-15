import { useEffect, useState } from 'react'
import { formatLatLon } from '../lib/geo'

export function Brand() {
  return (
    <header className="brand">
      <div className="brand-mark" aria-hidden />
      <div>
        <h1>Maps for Mars</h1>
        <p>Surface Navigation Intelligence</p>
      </div>
    </header>
  )
}

export function TopTelemetry() {
  const [clock, setClock] = useState('13:27:04')

  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      const h = 13
      const m = 27 + Math.floor((4 + elapsed) / 60)
      const s = (4 + elapsed) % 60
      setClock(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      )
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="top-telemetry">
      <span>SOL 184</span>
      <span className="sep" />
      <span>{clock} LMST</span>
      <span className="sep" />
      <span>Dust 0.12</span>
      <span className="sep" />
      <span>τ 0.41</span>
      <span className="sep" />
      <span>P 610 Pa</span>
    </div>
  )
}

export function CursorReadout({
  lat,
  lon,
}: {
  lat: number | null
  lon: number | null
}) {
  if (lat == null || lon == null) {
    return <div className="cursor-readout muted">Acquire surface lock</div>
  }
  const elev = (Math.sin(lat * 0.3) * 1.4 + Math.cos(lon * 0.12) * 0.6).toFixed(2)
  return (
    <div className="cursor-readout">
      <span>{formatLatLon(lat, lon)}</span>
      <span className="sep" />
      <span>Elev {Number(elev) >= 0 ? '+' : ''}{elev} km</span>
      <span className="sep" />
      <span>HiRISE · 25 cm/px</span>
    </div>
  )
}

export function CornerMarks() {
  return (
    <>
      <div className="corner tl" />
      <div className="corner tr" />
      <div className="corner bl" />
      <div className="corner br" />
    </>
  )
}
