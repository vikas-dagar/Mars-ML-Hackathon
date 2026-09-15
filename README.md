# Maps for Mars — Energy-Aware Route Intelligence

> On Mars, distance is a lie. Two paths of equal length can differ by **50%+ in energy cost** depending on terrain, solar angle, shadow, and payload. Maps for Mars is the energy brain that sees what a distance-only planner cannot.

**Track:** Vehicles & Mobility
**Team:** Maps for Mars
**Hackathon:** Mars ML — PhysicsX · GirlsWhoML · Cursor
**Pitch:** [mapformars.vercel.app](https://mapformars.vercel.app)
**Simulation** https://hannahohnz.github.io/maps-for-mars/
---

## The Problem

A 500 m stretch of identical-looking ground can cost wildly different energy depending on factors a distance planner ignores entirely:

| Factor | What actually changes |
|--------|----------------------|
| Time of sol | Morning sun elevation ≠ afternoon elevation — charging rate shifts |
| Shadowing | Canyon walls and crater floors receive ~8% diffuse skylight only |
| Solar panels | A sunlit segment can *generate* energy while driving |
| Mass | Cargo on a slope is not a linear extra cost |
| Terrain class | Sand and rock spike rolling resistance and wheel slip |

A distance-only planner can be **30–50% worse** on energy. On Mars, that is not a UX detail — it is a mission-failure mode.

---

## The Solution

**Maps for Mars** uses a physics-informed ML model that predicts **net watt-hours** (motor draw minus solar gain) for each route segment. It feeds a live A\* planner that finds the true energy-minimum path — not the shortest one.

The model combines four layers of Mars physics:

1. **Terrain** — gravity (3.721 m/s²), rolling resistance by surface class, slope penalty, turning cost
2. **Solar geometry** — sun elevation across the sol; Mars solar constant ~590 W/m² (pvlib-based)
3. **Dust & shadow** — ~70% clear-sky attenuation; ~8% diffuse-only in permanent shadow zones
4. **Rover class** — light scout (~80–140 kg, 1.2 m² panels) vs heavy cargo (~400–900 kg, 2.5 m² panels)

Unlike an EV routing app that only hunts chargers, the model knows **where the sun is** and **when it is** on that sol.

---

## Demo — The Globe

Interactive **React Three Fiber** Mars globe. You start at NAV-01 (Isidis sector) and route to catalog sites:

| Destination | Type |
|-------------|------|
| Ares Habitat | Colony hub |
| Borealis Solar Farm | Power infrastructure |
| Water Extraction 04 | Ice mining outpost |
| Supply Depot Alpha | Logistics cache |
| Landing Zone 07 | Arrival/departure pad |

Three mission modes change mass, speed, and risk profile:

- **Supplies** — heavy cargo rover
- **Crew** — pressurized transport vehicle
- **Emergency** — fast-response corridor

Each route reports distance, energy, solar window, dust exposure, hazard level, and ETA — the same readout a flight director would ask for.

---

## Model Architecture

| | Primary | Baseline |
|---|---------|----------|
| Algorithm | `HistGradientBoostingRegressor` | `LinearRegression` |
| Why | Captures slope × speed × solar × shadow interactions without hand-built feature crosses | Proves the nonlinear model's capacity is real, not overfitting |
| Config | `max_iter=200`, `lr=0.1`, `max_depth=6`; native categoricals (`terrain_class`, `shadowed`) | One-hot terrain (4 classes) + shadowed flag |

---

## Dataset

**Synthetic, physics-informed.** Not flight telemetry. Real rover logs are proprietary; HiRISE/MOLA calibration needs more time than a hackathon allows. Synthetic data lets us validate the model against **known physics**, then tell judges exactly how to swap in NASA DEMs next.

| Split | Segments |
|-------|----------|
| Total | 7,000 |
| Train | 4,900 (70%) |
| Validation | 1,050 (15%) |
| Test | 1,050 (15%) |

Terrain is a seeded 20×20 grid (`seed=42`): 5 points of interest, 2 permanent shadow zones (crater interior, canyon wall). Segments sample rover type, grid cells, distance, payload, battery state, and sol time. Physics computes net energy with small Gaussian noise (~0.5 Wh).

---

## Results

Held-out sets only. Test is the generalization number.

| Model | Metric | Validation | Test |
|-------|--------|------------|------|
| **HistGradientBoosting** | MAE (Wh) | 2.46 | **2.09** |
| | R² | 0.979 | **0.984** |
| **LinearRegression** | MAE (Wh) | 10.72 | 10.08 |
| | R² | 0.693 | 0.708 |

The boosted model is within **±2.1 Wh** per segment. The linear baseline is ~5× worse — it cannot represent the nonlinear solar/terrain coupling.

### Planner vs Distance-Only — Route Comparisons

**Light scout → Habitat Alpha to Ice Deposit**
Energy-aware: **53.90 Wh** (10 segments). Naive: **82.83 Wh** through crater shadow — diffuse-only irradiance (~31 W/m² vs ~234 W/m² in sunlight), minimal charging, steeper rims. **+54% energy penalty** on the naive route.

**Heavy cargo → Landing Zone to Regolith Quarry**
Same distance (1,131.4 m, 8 segments). Energy-aware: **155.19 Wh** vs naive: **176.62 Wh**. **21.43 Wh saved (12.1%)**. Heavy vehicles benefit most from route optimization due to larger solar arrays.

**Light scout → Habitat Alpha to Solar Field**
Energy-aware: **109.27 Wh** vs naive: **101.85 Wh** (both 11 segments). Here the direct path wins — strong solar gain along the straight line. The planner is not a "always detour into the sun" gimmick. It picks the true net-energy minimum, even when that means going straight.

**Takeaway:** identical distance ≠ identical energy. Distance-only planning cannot see that.

---

## Run It

### ML pipeline
```bash
pip install -r requirements.txt
python3 model.py
```
Builds the seeded map, generates 7,000 segments, trains both models, writes `model.joblib` and `metrics.json`, prints metrics. Runtime ~30–45 s on a laptop. All RNG seeded (`seed=42`).

### Route demo
```bash
python3 planner.py
```

### Interactive globe
```bash
npm install
npm run dev
```

---

## Repo Layout

### Live Map (React)

| Path | Role |
|------|------|
| `src/App.tsx` | Mission state and plot flow |
| `src/scene/` | Mars globe, beacons, route tracks |
| `src/ui/` | Search, mission selector, cargo config, route strip |
| `src/lib/routing.ts` | Solar-aware energy, hazard, and ETA scoring |
| `src/data/destinations.ts` | Catalog sites and historic route data |
| `public/textures/` | Mars color and bump maps |

### Routing Engine (Python)

| File | Role |
|------|------|
| `solar.py` | Irradiance model (pvlib + Mars constants + dust + shadow) |
| `map_data.py` | 20×20 terrain grid with shadow zones and POIs |
| `model.py` | Data generation, training, and evaluation |
| `planner.py` | NetworkX A\* vs naive distance routing |
| `model.joblib` | Trained booster (artifact) |
| `metrics.json` | Validation and test scores (artifact) |

---

## Road to Real Mars

1. **Terrain** — NASA [PDS](https://pds.nasa.gov/) HiRISE + MOLA DEMs for true slope, roughness, and shadow geometry
2. **Telemetry** — Partner rover logs (energy draw, distance, terrain class, irradiance)
3. **Calibrate** — Retrain with seasonal dust (τ 0.6–0.7), panel degradation, soil-specific rolling resistance
4. **Validate** — Planned vs actual efficiency over a 30-sol window; target **>15% energy saved** vs distance-only

---

## Physics Constants

| Constant | Mars | Earth |
|----------|------|-------|
| Surface gravity | 3.721 m/s² | 9.81 m/s² |
| Solar constant | ~590 W/m² | ~1,361 W/m² |
| Dust attenuation | 0.6–0.7 | — |
| Diffuse in shadow | ~8% of clear-sky | — |

---

## References

- Iqbal, M. (1983). *An Introduction to Solar Radiation.* Academic Press.
- Sandia National Labs. (2021). pvlib python. *Journal of Open Source Software.*
- Smith et al. (2018). Curiosity's mission on Mars: wheel damage and soil-rover interaction. *Icarus.*

---

## Credits

Globe texture from NASA imagery via [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0).
