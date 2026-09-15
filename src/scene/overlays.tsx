import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GEO_LABELS, HISTORIC_TRACKS } from '../data/destinations'
import { greatCirclePoints, latLonToVector3 } from '../lib/geo'
import { Line } from '@react-three/drei'
import { HudLabel } from './HudLabel'

const RADIUS = 1.62

export function CoordinateGrid() {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const pushLine = (a: THREE.Vector3, b: THREE.Vector3) => {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const segs = 96
      for (let i = 0; i < segs; i++) {
        const lon0 = (i / segs) * 360 - 180
        const lon1 = ((i + 1) / segs) * 360 - 180
        pushLine(
          latLonToVector3(lat, lon0, RADIUS * 1.004),
          latLonToVector3(lat, lon1, RADIUS * 1.004),
        )
      }
    }
    for (let lon = -180; lon < 180; lon += 15) {
      const segs = 48
      for (let i = 0; i < segs; i++) {
        const lat0 = -90 + (i / segs) * 180
        const lat1 = -90 + ((i + 1) / segs) * 180
        pushLine(
          latLonToVector3(lat0, lon, RADIUS * 1.004),
          latLonToVector3(lat1, lon, RADIUS * 1.004),
        )
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color="#d8b48a"
        transparent
        opacity={0.16}
        depthWrite={false}
      />
    </lineSegments>
  )
}

export function Contours() {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const bands = [0.22, 0.38, 0.55, 0.7, 0.84]
    bands.forEach((y, bi) => {
      const r = Math.sqrt(1 - (y * 2 - 1) ** 2) * RADIUS * (1.006 + bi * 0.0008)
      const yy = (y * 2 - 1) * RADIUS * 1.006
      const segs = 80
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2
        const a1 = ((i + 1) / segs) * Math.PI * 2
        const wobble = 1 + Math.sin(a0 * (3 + bi) + bi) * 0.012
        positions.push(
          Math.cos(a0) * r * wobble,
          yy + Math.sin(a0 * 5) * 0.01,
          Math.sin(a0) * r * wobble,
          Math.cos(a1) * r * wobble,
          yy + Math.sin(a1 * 5) * 0.01,
          Math.sin(a1) * r * wobble,
        )
      }
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color="#ffb089"
        transparent
        opacity={0.22}
        depthWrite={false}
      />
    </lineSegments>
  )
}

export function GeoLabels() {
  return (
    <group>
      {GEO_LABELS.map((label) => {
        const p = latLonToVector3(label.lat, label.lon, RADIUS * 1.035)
        return (
          <HudLabel key={label.name} position={p} className="geo-label">
            {label.name}
          </HudLabel>
        )
      })}
    </group>
  )
}

export function HistoricTracks() {
  const geometry = useMemo(() => {
    const positions: number[] = []
    HISTORIC_TRACKS.forEach((track) => {
      for (let i = 0; i < track.length - 1; i++) {
        const pts = greatCirclePoints(
          { lat: track[i][0], lon: track[i][1] },
          { lat: track[i + 1][0], lon: track[i + 1][1] },
          RADIUS,
          24,
        )
        for (let j = 0; j < pts.length - 1; j++) {
          positions.push(pts[j].x, pts[j].y, pts[j].z, pts[j + 1].x, pts[j + 1].y, pts[j + 1].z)
        }
      }
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#7ec8ff" transparent opacity={0.28} depthWrite={false} />
    </lineSegments>
  )
}

export function Beacon({
  lat,
  lon,
  active,
  onClick,
}: {
  lat: number
  lon: number
  active?: boolean
  onClick?: () => void
}) {
  const ring = useRef<THREE.Mesh>(null)
  const pos = useMemo(() => latLonToVector3(lat, lon, RADIUS * 1.04), [lat, lon])
  const quat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize())
    return q
  }, [pos])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ring.current) {
      const s = 1 + (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.85
      ring.current.scale.setScalar(s)
      const mat = ring.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.55 * (1 - (s - 1) / 0.85)
    }
  })

  return (
    <group position={pos} quaternion={quat} onClick={(e) => { e.stopPropagation(); onClick?.() }}>
      <mesh>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshBasicMaterial color={active ? '#9ef2ff' : '#ffcc88'} depthTest={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.036, 0.048, 32]} />
        <meshBasicMaterial
          color={active ? '#7ec8ff' : '#ff9a4a'}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export function RouteTube({
  from,
  to,
  accent,
}: {
  from: { lat: number; lon: number }
  to: { lat: number; lon: number }
  accent: string
}) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const { curve, geometry } = useMemo(() => {
    const pts = greatCirclePoints(from, to, RADIUS, 128)
    const curve = new THREE.CatmullRomCurve3(pts)
    const geometry = new THREE.TubeGeometry(curve, 128, 0.014, 10, false)
    return { curve, geometry }
  }, [from, to])

  const halo = useMemo(
    () => new THREE.TubeGeometry(curve, 128, 0.032, 10, false),
    [curve],
  )

  useFrame(({ clock }) => {
    if (mat.current) mat.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <group>
      <Line
        points={curve.getPoints(96)}
        color={accent}
        lineWidth={3}
        transparent
        opacity={1}
        depthTest={false}
        renderOrder={10}
      />
      <mesh geometry={halo}>
        <meshBasicMaterial color={accent} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh geometry={geometry}>
        <shaderMaterial
          ref={mat}
          transparent
          depthWrite={false}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(accent) },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform vec3 uColor;
            varying vec2 vUv;
            void main() {
              float pulse = fract(vUv.x * 28.0 - uTime * 0.85);
              float dash = smoothstep(0.0, 0.12, pulse) * smoothstep(0.55, 0.22, pulse);
              float core = 0.35 + dash * 0.85;
              gl_FragColor = vec4(uColor, core);
            }
          `}
        />
      </mesh>
    </group>
  )
}

export function DustField({ live = false }: { live?: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const storm = useRef<THREE.Points>(null)
  const mat = useRef<THREE.PointsMaterial>(null)
  const stormMat = useRef<THREE.PointsMaterial>(null)
  const liveAmt = useRef(0)

  const geo = useMemo(() => {
    const count = 1400
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = RADIUS * (1.03 + Math.random() * 0.12)
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.55
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])

  const stormGeo = useMemo(() => {
    const count = 900
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const lat = (Math.random() - 0.35) * 0.9
      const lon = Math.random() * Math.PI * 2
      const r = RADIUS * (1.045 + Math.random() * 0.08)
      positions[i * 3] = r * Math.cos(lat) * Math.cos(lon)
      positions[i * 3 + 1] = r * Math.sin(lat)
      positions[i * 3 + 2] = r * Math.cos(lat) * Math.sin(lon)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])

  useFrame(({ clock }, dt) => {
    liveAmt.current = THREE.MathUtils.lerp(liveAmt.current, live ? 1 : 0, 1 - Math.exp(-dt * 1.6))
    const t = clock.elapsedTime
    if (ref.current) ref.current.rotation.y = t * (0.012 + liveAmt.current * 0.11)
    if (storm.current) {
      storm.current.rotation.y = t * (0.04 + liveAmt.current * 0.28)
      storm.current.rotation.z = Math.sin(t * 0.35) * 0.12 * liveAmt.current
    }
    if (mat.current) {
      mat.current.opacity = 0.18 + liveAmt.current * 0.28
      mat.current.size = 0.01 + liveAmt.current * 0.012
    }
    if (stormMat.current) {
      stormMat.current.opacity = liveAmt.current * (0.22 + Math.sin(t * 2.1) * 0.08)
      stormMat.current.size = 0.016 + liveAmt.current * 0.02
    }
  })

  return (
    <group>
      <points ref={ref} geometry={geo}>
        <pointsMaterial
          ref={mat}
          color="#e8a070"
          size={0.01}
          transparent
          opacity={0.22}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <points ref={storm} geometry={stormGeo}>
        <pointsMaterial
          ref={stormMat}
          color="#ffb078"
          size={0.016}
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

export { RADIUS }
