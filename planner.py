"""
SolPath Route Planner: NetworkX A* pathfinding with solar-aware energy cost.

Integrates the trained HistGradientBoostingRegressor model to score route
segments by predicted energy cost, enabling energy-optimized rover planning.
"""

import numpy as np
import networkx as nx
import joblib
from collections import namedtuple
import map_data
from solar import irradiance_w_m2


# Load trained model
MODEL = joblib.load("solpath_model.joblib")

# Route segment representation
Segment = namedtuple("Segment", [
    "from_cell", "to_cell", "distance_m", "slope_deg", "roughness",
    "terrain_class", "solar_irradiance", "shadowed", "predicted_energy_wh"
])


class SolPathPlanner:
    """
    A* route planner for Mars rover traversals.
    
    Uses the trained SolPath energy prediction model to score route segments
    by predicted net energy draw, enabling solar-aware path planning.
    """
    
    def __init__(self, rover_type="light_scout", payload_kg=0.0, seed=42):
        """
        Initialize the planner.
        
        Args:
            rover_type (str): "light_scout" or "heavy_cargo"
            payload_kg (float): Payload mass in kg
            seed (int): Random seed for reproducibility
        """
        self.rover_type = rover_type
        self.payload_kg = payload_kg
        self.seed = seed
        self.rng = np.random.RandomState(seed)
        
        # Load terrain
        self.terrain_grids = map_data.generate_terrain_grid(seed=seed)
        self.slope_deg, self.roughness, self.terrain_class = self.terrain_grids
        
        # Build graph
        self.graph = self._build_graph()
    
    def _build_graph(self):
        """
        Build a NetworkX graph of the map with energy-cost weighted edges.
        Uses lazy evaluation: edge weights computed on-demand during pathfinding.
        
        Returns:
            nx.DiGraph: Directed graph with node positions and lazy edge weights.
        """
        G = nx.DiGraph()
        
        # Add nodes (all cells in the 20x20 grid)
        for row in range(map_data.MAP_SIZE):
            for col in range(map_data.MAP_SIZE):
                G.add_node((row, col), pos=(row, col))
        
        # Add edges (8-connected neighborhood: up, down, left, right, diagonals)
        # Weights are placeholders; computed on-demand during pathfinding
        directions = [
            (-1, 0), (1, 0), (0, -1), (0, 1),      # cardinal
            (-1, -1), (-1, 1), (1, -1), (1, 1)     # diagonals
        ]
        
        for row in range(map_data.MAP_SIZE):
            for col in range(map_data.MAP_SIZE):
                for dr, dc in directions:
                    new_row, new_col = row + dr, col + dc
                    
                    # Check bounds
                    if 0 <= new_row < map_data.MAP_SIZE and 0 <= new_col < map_data.MAP_SIZE:
                        # Add edge with placeholder weight (computed lazily)
                        G.add_edge(
                            (row, col),
                            (new_row, new_col),
                            weight=1.0  # Placeholder; overridden during pathfinding
                        )
        
        return G
    
    def _compute_edge_cost(self, from_row, from_col, to_row, to_col):
        """
        Compute predicted energy cost for a move between adjacent cells.
        
        Args:
            from_row, from_col (int): Starting cell
            to_row, to_col (int): Destination cell
        
        Returns:
            float: Predicted net energy draw (Wh) using the trained model
        """
        # Compute Euclidean distance
        distance_m = np.sqrt((to_row - from_row)**2 + (to_col - from_col)**2) * 100  # ~100m per cell
        
        # Use destination cell's terrain
        slope = self.slope_deg[to_row, to_col]
        roughness = self.roughness[to_row, to_col]
        terrain_class = self.terrain_class[to_row, to_col]
        shadowed = int(map_data.is_shadowed(to_row, to_col))
        
        # Use rover specs
        if self.rover_type == "light_scout":
            rover_mass_kg = 110.0
            panel_area_m2 = 1.2
            speed_m_s = 1.5
        else:  # heavy_cargo
            rover_mass_kg = 650.0
            panel_area_m2 = 2.5
            speed_m_s = 0.8
        
        # Sample random segment conditions
        wheel_slip = self.rng.uniform(0.05, 0.20)
        turn_angle_deg = self.rng.exponential(10)  # On average ~10° turns between cells
        battery_fraction = 0.8  # Assume reasonable battery state
        sol_time = self.rng.uniform(0.3, 0.7)  # Midday-ish (more representative)
        
        solar_irradiance = irradiance_w_m2(sol_time, shadowed)
        
        # Format features for model prediction
        features = np.array([[
            distance_m,
            slope,
            roughness,
            terrain_class,
            self.payload_kg,
            rover_mass_kg,
            wheel_slip,
            turn_angle_deg,
            solar_irradiance,
            shadowed,
            battery_fraction,
            sol_time
        ]])
        
        # Predict energy cost
        predicted_energy_wh = float(MODEL.predict(features)[0])
        
        # Ensure positive cost for Dijkstra/A*
        return max(predicted_energy_wh, 0.1)
    
    def _weight_fn(self, u, v, d=None):
        """
        Dynamically compute edge weight (energy cost) for A* pathfinding.
        
        Args:
            u, v (tuple): Adjacent cell positions
        
        Returns:
            float: Predicted energy cost
        """
        return self._compute_edge_cost(u[0], u[1], v[0], v[1])
    
    def plan_route(self, start_name, goal_name):
        """
        Plan an energy-optimized route between two points of interest.
        
        Args:
            start_name (str): Name of starting point of interest
            goal_name (str): Name of goal point of interest
        
        Returns:
            dict: Route info with path, total energy, distance, and segments
        """
        if start_name not in map_data.POINTS_OF_INTEREST:
            raise ValueError(f"Unknown start: {start_name}")
        if goal_name not in map_data.POINTS_OF_INTEREST:
            raise ValueError(f"Unknown goal: {goal_name}")
        
        start_pos = map_data.POINTS_OF_INTEREST[start_name]
        goal_pos = map_data.POINTS_OF_INTEREST[goal_name]
        
        # Use A* pathfinding with energy cost as the distance metric
        try:
            path = nx.astar_path(
                self.graph,
                start_pos,
                goal_pos,
                heuristic=self._euclidean_heuristic,
                weight=self._weight_fn
            )
        except nx.NetworkXNoPath:
            return {
                "feasible": False,
                "start": start_name,
                "goal": goal_name,
                "message": "No path found"
            }
        
        # Compute route metrics
        total_energy_wh = 0.0
        total_distance_m = 0.0
        segments = []
        
        for i in range(len(path) - 1):
            from_cell = path[i]
            to_cell = path[i + 1]
            
            # Get edge weight (energy cost) - computed on demand
            energy_cost = self._weight_fn(from_cell, to_cell)
            total_energy_wh += energy_cost
            
            # Distance
            distance = np.sqrt((to_cell[0] - from_cell[0])**2 + (to_cell[1] - from_cell[1])**2) * 100
            total_distance_m += distance
            
            # Segment info
            segment_info = {
                "from": from_cell,
                "to": to_cell,
                "distance_m": round(distance, 1),
                "energy_wh": round(energy_cost, 2),
                "shadowed": int(map_data.is_shadowed(to_cell[0], to_cell[1])),
                "terrain": map_data.get_terrain_class_name(self.terrain_class[to_cell[0], to_cell[1]])
            }
            segments.append(segment_info)
        
        return {
            "feasible": True,
            "start": start_name,
            "goal": goal_name,
            "path": path,
            "num_segments": len(path) - 1,
            "total_distance_m": round(total_distance_m, 1),
            "total_energy_wh": round(total_energy_wh, 2),
            "avg_energy_per_segment_wh": round(total_energy_wh / (len(path) - 1), 2),
            "segments": segments
        }
    
    def plan_naive_route(self, start_name, goal_name):
        """
        Plan a distance-optimized route (baseline, ignoring solar/terrain).
        
        Args:
            start_name (str): Name of starting point of interest
            goal_name (str): Name of goal point of interest
        
        Returns:
            dict: Naive route info (for comparison)
        """
        if start_name not in map_data.POINTS_OF_INTEREST:
            raise ValueError(f"Unknown start: {start_name}")
        if goal_name not in map_data.POINTS_OF_INTEREST:
            raise ValueError(f"Unknown goal: {goal_name}")
        
        start_pos = map_data.POINTS_OF_INTEREST[start_name]
        goal_pos = map_data.POINTS_OF_INTEREST[goal_name]
        
        # Use A* with Euclidean distance only (uniform unit weights = shortest path)
        try:
            path = nx.astar_path(
                self.graph,
                start_pos,
                goal_pos,
                heuristic=self._euclidean_heuristic,
                weight=lambda u, v, d=None: 1.0  # Uniform distance
            )
        except nx.NetworkXNoPath:
            return {
                "feasible": False,
                "start": start_name,
                "goal": goal_name,
                "message": "No path found"
            }
        
        # Compute metrics (now including actual energy for the naive path)
        total_energy_wh = 0.0
        total_distance_m = 0.0
        
        for i in range(len(path) - 1):
            from_cell = path[i]
            to_cell = path[i + 1]
            
            distance = np.sqrt((to_cell[0] - from_cell[0])**2 + (to_cell[1] - from_cell[1])**2) * 100
            total_distance_m += distance
            
            # Get actual energy cost for this segment (using the dynamic weight function)
            energy_cost = self._weight_fn(from_cell, to_cell)
            total_energy_wh += energy_cost
        
        return {
            "feasible": True,
            "start": start_name,
            "goal": goal_name,
            "path": path,
            "num_segments": len(path) - 1,
            "total_distance_m": round(total_distance_m, 1),
            "total_energy_wh": round(total_energy_wh, 2),
            "avg_energy_per_segment_wh": round(total_energy_wh / (len(path) - 1), 2),
            "planning_strategy": "distance-only (naive baseline)"
        }
    
    @staticmethod
    def _euclidean_heuristic(a, b):
        """
        Euclidean heuristic for A* (admissible for grid movement).
        
        Args:
            a, b (tuple): Cell positions (row, col)
        
        Returns:
            float: Euclidean distance in cells
        """
        return np.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2) * 100  # Convert to meters


def print_route_comparison(energy_route, naive_route):
    """
    Print side-by-side comparison of energy-optimized vs naive routes.
    
    Args:
        energy_route (dict): Result from plan_route()
        naive_route (dict): Result from plan_naive_route()
    """
    print()
    print("=" * 80)
    print(f"Route: {energy_route['start']} → {energy_route['goal']}")
    print("=" * 80)
    print()
    
    if not energy_route["feasible"] or not naive_route["feasible"]:
        print("Route not feasible")
        return
    
    print(f"{'Metric':<40} {'Energy-Optimized':<20} {'Naive (Distance)':<20}")
    print("-" * 80)
    print(f"{'Distance (m)':<40} {energy_route['total_distance_m']:<20} {naive_route['total_distance_m']:<20}")
    print(f"{'Energy (Wh)':<40} {energy_route['total_energy_wh']:<20} {naive_route['total_energy_wh']:<20}")
    print(f"{'Num Segments':<40} {energy_route['num_segments']:<20} {naive_route['num_segments']:<20}")
    print(f"{'Avg Energy/Segment (Wh)':<40} {energy_route['avg_energy_per_segment_wh']:<20} {naive_route['avg_energy_per_segment_wh']:<20}")
    
    print()
    energy_gain = naive_route['total_energy_wh'] - energy_route['total_energy_wh']
    energy_gain_pct = 100 * energy_gain / naive_route['total_energy_wh'] if naive_route['total_energy_wh'] > 0 else 0
    
    print(f"Energy Saved (Wh): {energy_gain:.2f} ({energy_gain_pct:.1f}%)")
    print()


if __name__ == "__main__":
    """Demo: Plan routes between points of interest."""
    
    print()
    print("╔" + "=" * 78 + "╗")
    print("║" + "SolPath Route Planner: Solar-Aware Mars Rover Pathfinding".center(78) + "║")
    print("╚" + "=" * 78 + "╝")
    print()
    
    # Create planner instances
    print("Initializing planner for light_scout rover (payload=20 kg)...")
    planner_scout = SolPathPlanner(rover_type="light_scout", payload_kg=20.0)
    print("✓ Light scout planner ready")
    print()
    
    print("Initializing planner for heavy_cargo rover (payload=40 kg)...")
    planner_cargo = SolPathPlanner(rover_type="heavy_cargo", payload_kg=40.0)
    print("✓ Heavy cargo planner ready")
    print()
    
    # Example routes
    example_routes = [
        ("light_scout", planner_scout, "habitat_alpha", "solar_field"),
        ("light_scout", planner_scout, "habitat_alpha", "ice_deposit"),
        ("heavy_cargo", planner_cargo, "landing_zone", "regolith_quarry"),
    ]
    
    for rover_type, planner, start, goal in example_routes:
        print(f"\n[{rover_type.upper()}] Planning route: {start} → {goal}")
        print("-" * 80)
        
        # Energy-optimized route
        energy_route = planner.plan_route(start, goal)
        if energy_route["feasible"]:
            print(f"  Energy-optimized: {energy_route['total_energy_wh']:.2f} Wh over {energy_route['num_segments']} segments")
        else:
            print(f"  No feasible route found")
            continue
        
        # Naive route
        naive_route = planner.plan_naive_route(start, goal)
        if naive_route["feasible"]:
            print(f"  Naive (distance):  {naive_route['total_energy_wh']:.2f} Wh over {naive_route['num_segments']} segments")
        
        # Comparison
        print_route_comparison(energy_route, naive_route)
    
    print()
    print("=" * 80)
    print("✓ Route planning demo complete")
    print()
