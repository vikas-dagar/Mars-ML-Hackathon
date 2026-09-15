import * as THREE from 'three'

export const MARS_RADIUS_KM = 3389.5

export function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

export function vector3ToLatLon(v: THREE.Vector3) {
  const n = v.clone().normalize()
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)))
  const lon = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x)) - 180
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180
  return { lat, lon: wrapped }
}

export function greatCirclePoints(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  radius: number,
  segments = 96,
) {
  const a = latLonToVector3(from.lat, from.lon, 1)
  const b = latLonToVector3(to.lat, to.lon, 1)
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const p = new THREE.Vector3().copy(a).lerp(b, t).normalize()
    const lift = 1.055 + Math.sin(t * Math.PI) * 0.02
    points.push(p.multiplyScalar(radius * lift))
  }
  return points
}

export function angularDistanceKm(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
) {
  const a = latLonToVector3(from.lat, from.lon, 1)
  const b = latLonToVector3(to.lat, to.lon, 1)
  return a.angleTo(b) * MARS_RADIUS_KM
}

export function formatLatLon(lat: number, lon: number) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`
}

export function elevationAlong(t: number, fromLat: number, toLat: number) {
  const base = THREE.MathUtils.lerp(fromLat, toLat, t)
  return (
    Math.sin(t * Math.PI * 3.2 + base * 0.04) * 0.62 +
    Math.sin(t * Math.PI * 7.1) * 0.18 -
    Math.pow(Math.sin(t * Math.PI), 2) * 0.22
  )
}
