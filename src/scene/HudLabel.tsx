import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import * as THREE from 'three'

const scratch = new THREE.Vector3()

export function HudLabel({
  position,
  children,
  className,
}: {
  position: THREE.Vector3
  children: ReactNode
  className?: string
}) {
  const { camera, size } = useThree()
  const el = useRef<HTMLDivElement>(null)

  useFrame(() => {
    if (!el.current) return
    scratch.copy(position).project(camera)
    const x = (scratch.x * 0.5 + 0.5) * size.width
    const y = (-scratch.y * 0.5 + 0.5) * size.height
    const facing = position.dot(camera.position) > 0.18
    const panel = document.querySelector('.glass-panel')
    const side = document.querySelector('.side-stack')
    const brand = document.querySelector('.brand')
    const strip = document.querySelector('.route-strip')
    const panelRight = panel?.getBoundingClientRect().right ?? 0
    const sideLeft = side?.getBoundingClientRect().left ?? size.width
    const brandBottom = brand?.getBoundingClientRect().bottom ?? 0
    const stripTop = strip?.getBoundingClientRect().top ?? size.height
    const underHud =
      x < panelRight + 14 ||
      x > sideLeft - 12 ||
      y < brandBottom + 12 ||
      y > Math.min(stripTop - 12, size.height - 88)
    const show = facing && !underHud && scratch.z < 1
    el.current.style.opacity = show ? '1' : '0'
    el.current.style.visibility = show ? 'visible' : 'hidden'
  })

  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <div ref={el} className={className} style={{ transition: 'opacity 0.18s ease' }}>
        {children}
      </div>
    </Html>
  )
}
