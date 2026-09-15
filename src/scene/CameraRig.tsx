import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { OrbitControls } from 'three-stdlib'
import { CURRENT_LOCATION, type Destination } from '../data/destinations'
import { latLonToVector3 } from '../lib/geo'
import { RADIUS } from './overlays'

export function CameraRig({
  routeOn,
  destination,
}: {
  routeOn: boolean
  destination: Destination | null
}) {
  const { camera } = useThree()
  const desired = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const controls = state.controls as OrbitControls | undefined
    if (!controls) return
    const k = 1 - Math.exp(-dt * 2.4)

    if (routeOn && destination) {
      const a = latLonToVector3(CURRENT_LOCATION.lat, CURRENT_LOCATION.lon, RADIUS)
      const b = latLonToVector3(destination.lat, destination.lon, RADIUS)
      const mid = a.clone().add(b).normalize()
      const span = a.angleTo(b)
      const dist = THREE.MathUtils.clamp(2.2 + span * 2.35, 2.4, 4.4)
      desired.copy(mid).multiplyScalar(RADIUS + dist)
      look.copy(mid).multiplyScalar(RADIUS * 0.88)
      controls.autoRotate = false
      camera.position.lerp(desired, k)
      controls.target.lerp(look, k)
      controls.minDistance = 2.15
      controls.update()
      return
    }

    controls.autoRotate = true
    controls.minDistance = 3.2
  })

  return null
}
