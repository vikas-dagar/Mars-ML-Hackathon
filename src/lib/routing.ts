import { CURRENT_LOCATION } from '../data/destinations'
import { angularDistanceKm, elevationAlong } from '../lib/geo'
import type { MissionType, RouteResult } from '../types'

export function plotSurfaceRoute(
  to: { lat: number; lon: number },
  mission: MissionType,
  cargoKg: number,
  passengers: number,
): RouteResult {
  const distanceKm = angularDistanceKm(CURRENT_LOCATION, to)
  const samples = Array.from({ length: 48 }, (_, i) =>
    elevationAlong(i / 47, CURRENT_LOCATION.lat, to.lat),
  )
  const roughness = samples.reduce((a, v) => a + Math.abs(v), 0) / samples.length
  const mass = cargoKg + passengers * 92
  const speed =
    mission === 'emergency' ? 48 : mission === 'crew' ? 32 : 22
  const speedKmh = speed * (1 - roughness * 0.18)
  const etaHours = distanceKm / Math.max(speedKmh, 8)
  const energyKwh =
    (distanceKm * (0.42 + mass / 2800) * (mission === 'emergency' ? 1.55 : 1)) /
    (1.05 - roughness * 0.12)
  const solarPct = Math.round(
    58 + Math.cos(((CURRENT_LOCATION.lon + to.lon) / 2) * 0.03) * 22 - (mission === 'emergency' ? 8 : 0),
  )
  const dust = Math.min(0.92, 0.12 + roughness * 0.35 + Math.abs(to.lat) * 0.004)
  const hazard = Math.min(
    0.95,
    0.16 + roughness * 0.4 + (mission === 'emergency' ? 0.18 : 0) + cargoKg / 8000,
  )

  return {
    distanceKm,
    energyKwh,
    solarPct: Math.max(18, Math.min(96, solarPct)),
    dust,
    hazard,
    etaHours,
    speedKmh,
    samples,
  }
}
