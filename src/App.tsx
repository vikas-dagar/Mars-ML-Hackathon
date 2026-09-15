import { Canvas } from '@react-three/fiber'
import { OrbitControls, Preload } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { MarsScene } from './scene/MarsScene'
import { type Destination } from './data/destinations'
import { plotSurfaceRoute } from './lib/routing'
import type { MissionType, RouteResult } from './types'
import { Brand, CornerMarks, CursorReadout, TopTelemetry } from './ui/Chrome'
import { RoutePanel } from './ui/RoutePanel'
import { RouteStrip } from './ui/RouteStrip'

const MISSION_DEFAULTS: Record<MissionType, { cargo: number; passengers: number }> = {
  supplies: { cargo: 1250, passengers: 0 },
  crew: { cargo: 240, passengers: 4 },
  emergency: { cargo: 80, passengers: 1 },
}

export default function App() {
  const [mission, setMission] = useState<MissionType>('supplies')
  const [destination, setDestination] = useState<Destination | null>(null)
  const [plotting, setPlotting] = useState(false)
  const [routeOn, setRouteOn] = useState(false)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setBooting(false), 1800)
    return () => window.clearTimeout(t)
  }, [])

  const onMission = (m: MissionType) => {
    setMission(m)
    if (routeOn) setRouteOn(false)
  }

  const onPlot = () => {
    if (!destination) return
    const load = MISSION_DEFAULTS[mission]
    setPlotting(true)
    window.setTimeout(() => {
      setRoute(plotSurfaceRoute(destination, mission, load.cargo, load.passengers))
      setRouteOn(true)
      setPlotting(false)
    }, 900)
  }

  const sunNote = useMemo(
    () => (mission === 'emergency' ? 'Priority corridor unlocked' : 'Solar-aware routing'),
    [mission],
  )

  return (
    <div className={`app mission-${mission} ${routeOn ? 'routed' : ''}`}>
      <div className="stage">
        <Suspense fallback={null}>
          <Canvas
            camera={{ position: [1.15, 1.55, -5.35], fov: 38, near: 0.1, far: 80 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false }}
          >
            <Suspense fallback={null}>
            <MarsScene
              destination={destination}
              routeOn={routeOn}
              mission={mission}
              onPickDestination={(d) => {
                setDestination(d)
                setRouteOn(false)
              }}
              onHoverSurface={(lat, lon) => setHover({ lat, lon })}
            />
            <OrbitControls
              makeDefault
              enablePan={false}
              enableDamping
              dampingFactor={0.05}
              autoRotate
              autoRotateSpeed={0.18}
              minDistance={3.2}
              maxDistance={9}
              target={[0.55, 0.05, 0]}
              minPolarAngle={0.45}
              maxPolarAngle={Math.PI - 0.45}
            />
            <Preload all />
            </Suspense>
          </Canvas>
        </Suspense>
      </div>
      {booting && (
        <div className="boot">
          <div className="boot-ring" />
          <p>Acquiring orbital lock</p>
        </div>
      )}

      <div className="vignette" />
      <div className="grain" />
      <div className="scan" />
      <CornerMarks />

      <Brand />
      <TopTelemetry />

      <RoutePanel
        mission={mission}
        onMission={onMission}
        destination={destination}
        onDestination={(d) => {
          setDestination(d)
          setRouteOn(false)
        }}
        onPlot={onPlot}
        plotting={plotting}
        routeOn={routeOn}
      />

      <aside className="side-stack">
        <div className="chip">
          <span>Atmosphere</span>
          <strong>CO₂ 95.3%</strong>
        </div>
        <div className="chip">
          <span>Irradiance</span>
          <strong>586 W/m²</strong>
        </div>
        <div className="chip">
          <span>Storm cell</span>
          <strong>{routeOn ? 'Tracking corridor' : 'None in 420 km'}</strong>
        </div>
        <div className="chip">
          <span>Mode</span>
          <strong>{sunNote}</strong>
        </div>
      </aside>

      {!routeOn && <CursorReadout lat={hover?.lat ?? null} lon={hover?.lon ?? null} />}
      {route && routeOn && <RouteStrip route={route} />}

      <div className="legend">
        <i className="lg-beacon" /> Beacons
        <i className="lg-path" /> Rover tracks
        <i className="lg-solar" /> Solar intensity
        <i className="lg-dust" /> Dust
      </div>
    </div>
  )
}
