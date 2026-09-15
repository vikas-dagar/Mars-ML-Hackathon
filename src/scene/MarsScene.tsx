import { useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { CURRENT_LOCATION, DESTINATIONS, type Destination } from '../data/destinations'
import { latLonToVector3, vector3ToLatLon } from '../lib/geo'
import { CameraRig } from './CameraRig'
import { HudLabel } from './HudLabel'
import {
  Beacon,
  Contours,
  CoordinateGrid,
  DustField,
  GeoLabels,
  HistoricTracks,
  RADIUS,
  RouteTube,
} from './overlays'
import type { MissionType } from '../types'

const atmoVert = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const atmoFrag = `
  uniform vec3 uColor;
  uniform float uPower;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), uPower);
    gl_FragColor = vec4(uColor, fresnel * 0.85);
  }
`

const solarVert = `
  varying vec3 vN;
  void main() {
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const solarFrag = `
  uniform vec3 uSun;
  uniform float uTime;
  uniform float uLive;
  varying vec3 vN;
  void main() {
    float d = dot(normalize(vN), normalize(uSun));
    float day = smoothstep(-0.08, 0.45, d)
      * (0.85 + uLive * 0.25 * (0.5 + 0.5 * sin(uTime * 1.6)));
    vec3 night = vec3(0.05, 0.12, 0.28);
    vec3 noon = mix(vec3(1.0, 0.72, 0.28), vec3(1.0, 0.92, 0.45), uLive);
    vec3 col = mix(night, noon, day);
    float band = abs(fract((d * 0.5 + 0.5) * (7.0 + uLive * 5.0) - uTime * (0.08 + uLive * 0.55)) - 0.5);
    float lines = smoothstep(0.18, 0.05, band);
    float alpha = 0.1 + uLive * 0.14 + lines * (0.14 + uLive * 0.28) * day;
    gl_FragColor = vec4(col, alpha);
  }
`

function Atmosphere() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ff7a3a') },
      uPower: { value: 3.4 },
    }),
    [],
  )
  const inner = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ffb080') },
      uPower: { value: 4.8 },
    }),
    [],
  )

  return (
    <group>
      <mesh scale={1.08}>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={atmoVert}
          fragmentShader={atmoFrag}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh scale={1.012}>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <shaderMaterial
          uniforms={inner}
          vertexShader={atmoVert}
          fragmentShader={atmoFrag}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function SolarOverlay({ live = false }: { live?: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const liveAmt = useRef(0)
  const uniforms = useMemo(
    () => ({
      uSun: { value: new THREE.Vector3(0.7, 0.25, 0.55) },
      uTime: { value: 0 },
      uLive: { value: 0 },
    }),
    [],
  )

  useFrame(({ clock }, dt) => {
    if (!mat.current) return
    liveAmt.current = THREE.MathUtils.lerp(liveAmt.current, live ? 1 : 0, 1 - Math.exp(-dt * 1.5))
    const t = clock.elapsedTime * (0.04 + liveAmt.current * 0.22)
    mat.current.uniforms.uSun.value.set(Math.cos(t) * 0.8, 0.28, Math.sin(t) * 0.8)
    mat.current.uniforms.uTime.value = clock.elapsedTime
    mat.current.uniforms.uLive.value = liveAmt.current
  })

  return (
    <mesh scale={1.006}>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={solarVert}
        fragmentShader={solarFrag}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

function MarsBody({
  onHover,
}: {
  onHover: (lat: number, lon: number) => void
}) {
  const colorMap = useLoader(THREE.TextureLoader, '/textures/mars.jpg')
  colorMap.colorSpace = THREE.SRGBColorSpace
  colorMap.anisotropy = 8

  return (
    <mesh
      onPointerMove={(e) => {
        e.stopPropagation()
        const ll = vector3ToLatLon(e.point)
        onHover(ll.lat, ll.lon)
      }}
    >
      <sphereGeometry args={[RADIUS, 128, 128]} />
      <meshStandardMaterial
        map={colorMap}
        bumpMap={colorMap}
        bumpScale={0.12}
        roughness={0.92}
        metalness={0.04}
        color="#e8c2a4"
      />
    </mesh>
  )
}


export function MarsScene({
  destination,
  routeOn,
  mission,
  onPickDestination,
  onHoverSurface,
}: {
  destination: Destination | null
  routeOn: boolean
  mission: MissionType
  onPickDestination: (d: Destination) => void
  onHoverSurface: (lat: number, lon: number) => void
}) {
  const accent = mission === 'emergency' ? '#ff6b4a' : '#7ec8ff'

  return (
    <>
      <color attach="background" args={['#070403']} />
      <fog attach="fog" args={['#0a0604', 8, 22]} />
      <ambientLight intensity={0.07} color="#3a2218" />
      <hemisphereLight args={['#ffd2a8', '#120804', 0.45]} />
      <directionalLight position={[4.2, 2.4, 2.8]} intensity={2.35} color="#fff1dc" />
      <directionalLight position={[-3.5, -1.2, -2]} intensity={0.28} color="#4a6a88" />
      <Stars radius={80} depth={40} count={5000} factor={2.6} saturation={0} fade speed={0.25} />
      <MarsBody onHover={onHoverSurface} />
      <SolarOverlay live={routeOn} />
      <Atmosphere />
      <CoordinateGrid />
      <Contours />
      <HistoricTracks />
      <DustField live={routeOn} />
      <GeoLabels />
      <Beacon lat={CURRENT_LOCATION.lat} lon={CURRENT_LOCATION.lon} active />
      <HudLabel
        position={latLonToVector3(CURRENT_LOCATION.lat, CURRENT_LOCATION.lon, RADIUS * 1.08)}
        className="geo-label"
      >
        Nav-01
      </HudLabel>
      {DESTINATIONS.map((d) => (
        <Beacon
          key={d.id}
          lat={d.lat}
          lon={d.lon}
          active={destination?.id === d.id}
          onClick={() => onPickDestination(d)}
        />
      ))}
      {routeOn && destination && (
        <RouteTube
          from={{ lat: CURRENT_LOCATION.lat, lon: CURRENT_LOCATION.lon }}
          to={{ lat: destination.lat, lon: destination.lon }}
          accent={accent}
        />
      )}
      {routeOn && destination && (
        <mesh position={latLonToVector3(destination.lat, destination.lon, RADIUS * 1.03)}>
          <sphereGeometry args={[0.02, 16, 16]} />
          <meshBasicMaterial color={accent} />
        </mesh>
      )}
      <CameraRig routeOn={routeOn} destination={destination} />
    </>
  )
}
