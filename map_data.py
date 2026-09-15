"""
Mars settlement map data for SolPath route planning.

Defines a 20x20 grid representing a Mars settlement area with points of interest,
terrain features, and permanently shadowed zones (crater interiors, canyon walls).
"""

import numpy as np


# Map dimensions
MAP_SIZE = 20

# Points of interest (row, col) coordinates
POINTS_OF_INTEREST = {
    "habitat_alpha": (5, 5),
    "ice_deposit": (15, 2),
    "regolith_quarry": (10, 18),
    "solar_field": (3, 16),
    "landing_zone": (18, 10),
}

# Permanently shadowed zones: list of (row_min, row_max, col_min, col_max)
# These represent crater interiors, canyon walls, etc.
SHADOW_ZONES = [
    (2, 6, 8, 12),      # Crater interior (center-north area)
    (14, 18, 0, 4),     # Canyon wall (south-west corner)
]


def generate_terrain_grid(seed=42):
    """
    Generate terrain features for the 20x20 map.
    
    Args:
        seed (int): Random seed for reproducibility.
    
    Returns:
        tuple: (slope_deg, roughness, terrain_class)
               Each is a 20x20 numpy array.
               terrain_class: categorical with values 0=flat_regolith, 1=loose_sand,
                             2=rocky, 3=steep_slope.
    """
    rng = np.random.RandomState(seed)
    
    slope_deg = np.zeros((MAP_SIZE, MAP_SIZE))
    roughness = np.zeros((MAP_SIZE, MAP_SIZE))
    terrain_class = np.zeros((MAP_SIZE, MAP_SIZE), dtype=int)
    
    for row in range(MAP_SIZE):
        for col in range(MAP_SIZE):
            in_shadow = is_shadowed(row, col)
            
            if in_shadow:
                # Shadowed zones are steeper (canyon walls, crater rims)
                slope_deg[row, col] = rng.uniform(15, 35)
                roughness[row, col] = rng.uniform(0.3, 0.6)
                terrain_class[row, col] = 3  # steep_slope
            else:
                # Open terrain: mix of flat, sandy, and rocky
                base_slope = rng.uniform(0, 8)
                slope_deg[row, col] = base_slope
                
                # Terrain class distribution
                tc = rng.choice([0, 1, 2], p=[0.4, 0.35, 0.25])
                terrain_class[row, col] = tc
                
                # Roughness varies by terrain class
                if tc == 0:  # flat_regolith
                    roughness[row, col] = rng.uniform(0.05, 0.15)
                elif tc == 1:  # loose_sand
                    roughness[row, col] = rng.uniform(0.15, 0.35)
                else:  # rocky
                    roughness[row, col] = rng.uniform(0.25, 0.50)
    
    return slope_deg, roughness, terrain_class


def is_shadowed(row, col):
    """
    Check if a grid cell is in a permanently shadowed zone.
    
    Args:
        row (int): Row index [0, MAP_SIZE).
        col (int): Column index [0, MAP_SIZE).
    
    Returns:
        bool: True if cell is shadowed, False otherwise.
    """
    for row_min, row_max, col_min, col_max in SHADOW_ZONES:
        if row_min <= row < row_max and col_min <= col < col_max:
            return True
    return False


def get_terrain_class_name(tc):
    """
    Convert terrain class integer to name.
    
    Args:
        tc (int): Terrain class (0, 1, 2, or 3).
    
    Returns:
        str: Terrain class name.
    """
    names = ["flat_regolith", "loose_sand", "rocky", "steep_slope"]
    return names[tc]


if __name__ == "__main__":
    """Sanity check the map data."""
    
    print("Mars Settlement Map Data")
    print("=" * 60)
    print()
    
    print(f"Map size: {MAP_SIZE}x{MAP_SIZE}")
    print()
    
    print("Points of Interest:")
    for name, (row, col) in POINTS_OF_INTEREST.items():
        shadowed = is_shadowed(row, col)
        shadow_str = " (SHADOWED)" if shadowed else ""
        print(f"  {name:20s}: ({row:2d}, {col:2d}){shadow_str}")
    
    print()
    print("Permanently Shadowed Zones:")
    for i, (r_min, r_max, c_min, c_max) in enumerate(SHADOW_ZONES):
        print(f"  Zone {i+1}: rows [{r_min}, {r_max}), cols [{c_min}, {c_max})")
    
    print()
    print("Terrain Grid Sample (seed=42):")
    slope, roughness, terrain_class = generate_terrain_grid(seed=42)
    
    print(f"  Slope: min={slope.min():.1f}°, max={slope.max():.1f}°")
    print(f"  Roughness: min={roughness.min():.2f}, max={roughness.max():.2f}")
    print(f"  Terrain class distribution:")
    for tc in range(4):
        count = np.sum(terrain_class == tc)
        pct = 100 * count / (MAP_SIZE * MAP_SIZE)
        print(f"    {get_terrain_class_name(tc):15s}: {count:3d} cells ({pct:5.1f}%)")
    
    print()
    print("✓ Map data initialized successfully")
