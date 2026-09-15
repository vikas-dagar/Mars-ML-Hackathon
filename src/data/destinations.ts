export type Destination = {
  id: string
  name: string
  code: string
  lat: number
  lon: number
  elevKm: number
  kind: 'habitat' | 'energy' | 'resource' | 'logistics' | 'landing'
}

export const CURRENT_LOCATION = {
  name: 'Current location',
  code: 'NAV-01',
  lat: 18.44,
  lon: 77.45,
  elevKm: 0.82,
}

export const DESTINATIONS: Destination[] = [
  {
    id: 'ares',
    name: 'Ares Habitat',
    code: 'HAB-ARES',
    lat: 22.18,
    lon: 75.12,
    elevKm: 1.04,
    kind: 'habitat',
  },
  {
    id: 'borealis',
    name: 'Borealis Solar Farm',
    code: 'PWR-BOR',
    lat: 58.62,
    lon: 82.4,
    elevKm: -0.21,
    kind: 'energy',
  },
  {
    id: 'water04',
    name: 'Water Extraction 04',
    code: 'H2O-04',
    lat: 12.86,
    lon: 85.31,
    elevKm: -1.48,
    kind: 'resource',
  },
  {
    id: 'alpha',
    name: 'Supply Depot Alpha',
    code: 'LOG-α',
    lat: 25.61,
    lon: 68.14,
    elevKm: 0.44,
    kind: 'logistics',
  },
  {
    id: 'lz07',
    name: 'Landing Zone 07',
    code: 'LZ-07',
    lat: 15.22,
    lon: 72.9,
    elevKm: -0.18,
    kind: 'landing',
  },
]

export const GEO_LABELS = [
  { name: 'Olympus Mons', lat: 18.65, lon: -133.8 },
  { name: 'Valles Marineris', lat: -13.9, lon: -59.2 },
  { name: 'Hellas Planitia', lat: -42.4, lon: 70.5 },
  { name: 'Syrtis Major', lat: 8.4, lon: 69.5 },
  { name: 'Isidis Planitia', lat: 12.9, lon: 87.0 },
  { name: 'Tharsis', lat: 0.0, lon: -100.0 },
  { name: 'Gale Crater', lat: -5.4, lon: 137.8 },
  { name: 'North Polar Cap', lat: 80.0, lon: 0.0 },
]

export const HISTORIC_TRACKS: [number, number][][] = [
  [
    [18.44, 77.45],
    [16.2, 74.1],
    [15.22, 72.9],
  ],
  [
    [22.18, 75.12],
    [24.1, 71.4],
    [25.61, 68.14],
  ],
  [
    [18.44, 77.45],
    [15.8, 81.2],
    [12.86, 85.31],
  ],
]
