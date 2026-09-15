"""
SolPath core ML model: solar-aware energy prediction for Mars rover routes.

Generates synthetic physics-informed route segments, trains gradient boosting
and linear baseline models, and evaluates on held-out validation and test sets.
"""

import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

# Import Mars settlement map and solar model
import map_data
from solar import irradiance_w_m2


# Mars gravity
G_MARS = 3.721  # m/s^2

# Rover archetypes
ROVER_ARCHETYPES = {
    "light_scout": {
        "mass_kg_min": 80,
        "mass_kg_max": 140,
        "panel_area_m2": 1.2,
        "panel_efficiency": 0.20,
        "speed_m_s": 1.5,
    },
    "heavy_cargo": {
        "mass_kg_min": 400,
        "mass_kg_max": 900,
        "panel_area_m2": 2.5,
        "panel_efficiency": 0.20,
        "speed_m_s": 0.8,
    },
}

# Terrain-class rolling resistance coefficients (dimensionless)
ROLLING_RESISTANCE_COEFF = {
    0: 0.05,    # flat_regolith
    1: 0.12,    # loose_sand
    2: 0.08,    # rocky
    3: 0.15,    # steep_slope
}


def sample_segment_context(rng, terrain_grids):
    """
    Sample a random route segment context from the terrain map.
    
    Args:
        rng (np.random.RandomState): Random number generator.
        terrain_grids (tuple): (slope_deg, roughness, terrain_class) arrays from map_data.
    
    Returns:
        dict: Segment context with 'slope_deg', 'roughness', 'terrain_class', 'shadowed'.
    """
    slope_deg, roughness, terrain_class = terrain_grids
    
    # Pick a random cell from the map
    row = rng.randint(0, map_data.MAP_SIZE)
    col = rng.randint(0, map_data.MAP_SIZE)
    
    return {
        "slope_deg": float(slope_deg[row, col]),
        "roughness": float(roughness[row, col]),
        "terrain_class": int(terrain_class[row, col]),
        "shadowed": int(map_data.is_shadowed(row, col)),
    }


def compute_net_energy(segment, rover_archetype, terrain_grids):
    """
    Compute net energy draw for a route segment using physics model.
    
    Args:
        segment (dict): Segment features (distance_m, slope_deg, roughness,
                       terrain_class, payload_kg, wheel_slip, turn_angle_deg,
                       battery_fraction, sol_time, shadowed).
        rover_archetype (dict): Rover specs from ROVER_ARCHETYPES.
        terrain_grids (tuple): Terrain arrays (not used in this version, but kept for clarity).
    
    Returns:
        float: Net energy (Wh), clipped to minimum of 0.1 Wh.
    """
    distance_m = segment["distance_m"]
    slope_deg = segment["slope_deg"]
    roughness = segment["roughness"]
    terrain_class = segment["terrain_class"]
    mass_kg = segment["rover_mass_kg"]
    payload_kg = segment["payload_kg"]
    wheel_slip = segment["wheel_slip"]
    turn_angle_deg = segment["turn_angle_deg"]
    battery_fraction = segment["battery_fraction"]
    sol_time = segment["sol_time"]
    shadowed = segment["shadowed"]
    solar_irradiance = segment["solar_irradiance"]
    
    total_mass = mass_kg + payload_kg
    
    # 1. Gravity (climbing) term: W = m * g * h = m * g * distance * sin(slope)
    slope_rad = np.radians(slope_deg)
    gravity_energy = total_mass * G_MARS * distance_m * np.sin(slope_rad)
    gravity_energy_wh = gravity_energy / 3600.0  # Convert J to Wh
    
    # 2. Rolling resistance: F_roll = mu * m * g * cos(slope)
    #    Work = F * d, so E = mu * m * g * cos(slope) * distance
    mu = ROLLING_RESISTANCE_COEFF.get(terrain_class, 0.08)
    rolling_resistance_energy = mu * total_mass * G_MARS * np.cos(slope_rad) * distance_m
    rolling_resistance_wh = rolling_resistance_energy / 3600.0
    
    # 3. Wheel slip loss: E_slip = wheel_slip * (gravity_energy + rolling_resistance_energy)
    slip_energy = wheel_slip * (gravity_energy + rolling_resistance_energy)
    slip_wh = slip_energy / 3600.0
    
    # 4. Turning loss: E_turn = turn_angle_deg * (some proportionality constant)
    #    Use a simple model: 0.5 Wh per degree of turn
    turn_loss_wh = 0.5 * turn_angle_deg
    
    # Total energy draw
    total_draw_wh = gravity_energy_wh + rolling_resistance_wh + slip_wh + turn_loss_wh
    
    # 5. Solar charging gain: E_solar = irradiance * panel_area * efficiency * segment_duration
    #    segment_duration = distance / speed (in seconds)
    speed_m_s = rover_archetype["speed_m_s"]
    segment_duration_s = distance_m / max(speed_m_s, 0.1)  # avoid division by zero
    
    panel_area = rover_archetype["panel_area_m2"]
    panel_eff = rover_archetype["panel_efficiency"]
    
    solar_gain_w = solar_irradiance * panel_area * panel_eff
    solar_gain_wh = solar_gain_w * segment_duration_s / 3600.0
    
    # Net energy: draw minus solar gain
    net_energy_wh = total_draw_wh - solar_gain_wh
    
    # Add small Gaussian noise
    noise_wh = np.random.normal(0, 0.5)
    net_energy_wh += noise_wh
    
    # Clip to small positive minimum (energy draw can't go meaningfully negative)
    net_energy_wh = max(net_energy_wh, 0.1)
    
    return net_energy_wh


def generate_synthetic_dataset(n_samples=7000, seed=42):
    """
    Generate synthetic rover route segment dataset.
    
    Args:
        n_samples (int): Number of segments to generate.
        seed (int): Random seed.
    
    Returns:
        pd.DataFrame: Dataset with features and target net_energy_wh.
    """
    rng = np.random.RandomState(seed)
    
    # Load terrain grids
    terrain_grids = map_data.generate_terrain_grid(seed=seed)
    
    data = []
    
    for i in range(n_samples):
        # Pick rover archetype
        rover_type = rng.choice(["light_scout", "heavy_cargo"])
        rover_spec = ROVER_ARCHETYPES[rover_type]
        
        # Sample segment context from map
        context = sample_segment_context(rng, terrain_grids)
        
        # Segment features
        distance_m = rng.uniform(10, 500)
        slope_deg = context["slope_deg"]
        roughness = context["roughness"]
        terrain_class = context["terrain_class"]
        
        payload_kg = rng.uniform(0, 50)
        rover_mass_kg = rng.uniform(
            rover_spec["mass_kg_min"],
            rover_spec["mass_kg_max"]
        )
        
        wheel_slip = rng.uniform(0.0, 0.3)
        turn_angle_deg = rng.exponential(20)  # Most segments are fairly straight
        
        battery_fraction = rng.uniform(0.2, 1.0)
        sol_time = rng.uniform(0, 1)
        shadowed = context["shadowed"]
        
        solar_irradiance = irradiance_w_m2(sol_time, shadowed)
        
        # Build segment dict
        segment = {
            "distance_m": distance_m,
            "slope_deg": slope_deg,
            "roughness": roughness,
            "terrain_class": terrain_class,
            "payload_kg": payload_kg,
            "rover_mass_kg": rover_mass_kg,
            "wheel_slip": wheel_slip,
            "turn_angle_deg": turn_angle_deg,
            "solar_irradiance": solar_irradiance,
            "shadowed": shadowed,
            "battery_fraction": battery_fraction,
            "sol_time": sol_time,
            "rover_type": rover_type,
        }
        
        # Compute target
        net_energy_wh = compute_net_energy(segment, rover_spec, terrain_grids)
        segment["net_energy_wh"] = net_energy_wh
        
        data.append(segment)
    
    df = pd.DataFrame(data)
    return df


def train_and_evaluate(df):
    """
    Train gradient boosting and linear baseline models.
    
    Args:
        df (pd.DataFrame): Full dataset with all features and net_energy_wh target.
    
    Returns:
        dict: Metrics dictionary with model performance on val and test sets.
    """
    
    # Feature list and target
    feature_cols = [
        "distance_m", "slope_deg", "roughness", "terrain_class",
        "payload_kg", "rover_mass_kg", "wheel_slip", "turn_angle_deg",
        "solar_irradiance", "shadowed", "battery_fraction", "sol_time"
    ]
    target_col = "net_energy_wh"
    
    X = df[feature_cols].copy()
    y = df[target_col].copy()
    
    # 70/15/15 split
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=(0.15 / 0.85), random_state=42
    )
    
    n_train = len(X_train)
    n_val = len(X_val)
    n_test = len(X_test)
    
    # ========== Model 1: HistGradientBoostingRegressor ==========
    print("Training HistGradientBoostingRegressor...")
    
    hgb = HistGradientBoostingRegressor(
        max_iter=200,
        learning_rate=0.1,
        max_depth=6,
        categorical_features=[3, 9],  # terrain_class and shadowed (binary)
        random_state=42,
        verbose=0
    )
    hgb.fit(X_train, y_train)
    
    # Predictions on validation and test
    y_val_pred_hgb = hgb.predict(X_val)
    y_test_pred_hgb = hgb.predict(X_test)
    
    val_mae_hgb = mean_absolute_error(y_val, y_val_pred_hgb)
    val_r2_hgb = r2_score(y_val, y_val_pred_hgb)
    test_mae_hgb = mean_absolute_error(y_test, y_test_pred_hgb)
    test_r2_hgb = r2_score(y_test, y_test_pred_hgb)
    
    print(f"  Validation: MAE={val_mae_hgb:.4f} Wh, R²={val_r2_hgb:.4f}")
    print(f"  Test:       MAE={test_mae_hgb:.4f} Wh, R²={test_r2_hgb:.4f}")
    
    # ========== Model 2: Linear Regression (baseline) ==========
    print("Training LinearRegression (baseline)...")
    
    # One-hot encode categorical features for linear model
    encoder = OneHotEncoder(
        sparse_output=False,
        handle_unknown="ignore",
        categories="auto"
    )
    
    # Fit encoder on training data
    X_train_encoded = encoder.fit_transform(X_train[["terrain_class", "shadowed"]])
    X_val_encoded = encoder.transform(X_val[["terrain_class", "shadowed"]])
    X_test_encoded = encoder.transform(X_test[["terrain_class", "shadowed"]])
    
    # Combine with continuous features
    continuous_cols = [c for c in feature_cols if c not in ["terrain_class", "shadowed"]]
    X_train_full = np.hstack([
        X_train[continuous_cols].values,
        X_train_encoded
    ])
    X_val_full = np.hstack([
        X_val[continuous_cols].values,
        X_val_encoded
    ])
    X_test_full = np.hstack([
        X_test[continuous_cols].values,
        X_test_encoded
    ])
    
    lr = LinearRegression()
    lr.fit(X_train_full, y_train)
    
    y_val_pred_lr = lr.predict(X_val_full)
    y_test_pred_lr = lr.predict(X_test_full)
    
    val_mae_lr = mean_absolute_error(y_val, y_val_pred_lr)
    val_r2_lr = r2_score(y_val, y_val_pred_lr)
    test_mae_lr = mean_absolute_error(y_test, y_test_pred_lr)
    test_r2_lr = r2_score(y_test, y_test_pred_lr)
    
    print(f"  Validation: MAE={val_mae_lr:.4f} Wh, R²={val_r2_lr:.4f}")
    print(f"  Test:       MAE={test_mae_lr:.4f} Wh, R²={test_r2_lr:.4f}")
    
    # ========== Save best model (HistGradientBoostingRegressor) ==========
    joblib.dump(hgb, "solpath_model.joblib")
    print("\n✓ Model saved to solpath_model.joblib")
    
    # ========== Compile metrics ==========
    metrics = {
        "n_train": n_train,
        "n_val": n_val,
        "n_test": n_test,
        "models": {
            "HistGradientBoostingRegressor": {
                "validation": {
                    "MAE_Wh": round(val_mae_hgb, 4),
                    "R2": round(val_r2_hgb, 4)
                },
                "test": {
                    "MAE_Wh": round(test_mae_hgb, 4),
                    "R2": round(test_r2_hgb, 4)
                }
            },
            "LinearRegression": {
                "validation": {
                    "MAE_Wh": round(val_mae_lr, 4),
                    "R2": round(val_r2_lr, 4)
                },
                "test": {
                    "MAE_Wh": round(test_mae_lr, 4),
                    "R2": round(test_r2_lr, 4)
                }
            }
        }
    }
    
    return metrics


def main():
    """Generate dataset, train models, evaluate, and save metrics."""
    
    print("=" * 70)
    print("SolPath: Solar-Aware Mars Rover Energy Prediction")
    print("=" * 70)
    print()
    
    # Generate synthetic dataset
    print("Generating synthetic dataset (7000 segments)...")
    df = generate_synthetic_dataset(n_samples=7000, seed=42)
    print(f"✓ Dataset generated: {len(df)} rows")
    print(f"  Features: {', '.join(df.columns[:-1])}")
    print(f"  Target: {df.columns[-1]}")
    print()
    
    # Train and evaluate models
    print("Training and evaluating models...")
    print("-" * 70)
    metrics = train_and_evaluate(df)
    print("-" * 70)
    print()
    
    # Save metrics
    with open("metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print("✓ Metrics saved to metrics.json")
    print()
    
    # Print formatted metrics
    print("=" * 70)
    print("FINAL RESULTS")
    print("=" * 70)
    print(json.dumps(metrics, indent=2))
    print()


if __name__ == "__main__":
    main()
