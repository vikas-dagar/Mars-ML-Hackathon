export type MissionType = 'supplies' | 'crew' | 'emergency'

export type RouteResult = {
  distanceKm: number
  energyKwh: number
  solarPct: number
  dust: number
  hazard: number
  etaHours: number
  speedKmh: number
  samples: number[]
}
