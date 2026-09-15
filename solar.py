"""
Solar irradiance model for Mars rover energy predictions.

Uses pvlib's solar-position geometry to compute the elevation-angle-vs-time shape,
then rescales to Mars solar constant (~590 W/m^2) with dust attenuation.
Shadowed cells receive only diffuse skylight (~8% of clear-sky value).
"""

import numpy as np
import pvlib


def irradiance_w_m2(sol_time, shadowed):
    """
    Compute solar irradiance at Mars surface.
    
    Args:
        sol_time (float): Time within a sol, range [0, 1].
                         0 = dawn, 0.5 = noon, 1 = dusk.
        shadowed (int):   0 for sunlit, 1 for permanently shadowed.
    
    Returns:
        float: Solar irradiance in W/m^2.
    """
    # Mars solar constant (vs Earth's ~1361 W/m^2)
    MARS_SOLAR_CONSTANT = 590.0
    
    # Dust attenuation factor (reduces clear-sky irradiance)
    DUST_ATTENUATION = 0.65
    
    # Diffuse skylight fraction for shadowed cells
    DIFFUSE_FRACTION = 0.08
    
    # Reference location for solar-position geometry (fixed to get repeatable shape)
    # Using a mid-latitude site; the actual latitude/longitude don't matter much
    # for the shape—only to get realistic elevation-angle-vs-time curve
    latitude = 45.0
    longitude = -120.0
    tz = "UTC"
    
    # Use a fixed reference date (doesn't matter for shape, just must be consistent)
    # We'll pick a date near Mars's equinox for reasonable geometry
    # Using a simple date: 2024-03-21 (Earth's spring equinox, for reference)
    date = "2024-03-21"
    
    # Convert sol_time [0, 1] to a time-of-day
    # 0 = dawn (~6:00), 0.5 = noon (~12:00), 1 = dusk (~18:00)
    hour_of_day = 6.0 + 12.0 * sol_time
    
    # Create a pandas Timestamp
    import pandas as pd
    ts = pd.Timestamp(f"{date} {int(hour_of_day):02d}:{int((hour_of_day % 1) * 60):02d}:00")
    
    # Get solar position
    location = pvlib.location.Location(latitude, longitude, tz=tz)
    solar_pos = location.get_solarposition(pd.DatetimeIndex([ts]))
    
    # Extract elevation angle
    elev_deg = float(solar_pos["elevation"].iloc[0])
    
    if shadowed == 1:
        # Shadowed cell: only diffuse skylight, independent of elevation angle
        irrad = MARS_SOLAR_CONSTANT * DUST_ATTENUATION * DIFFUSE_FRACTION
    else:
        # Sunlit cell: elevation-angle-dependent clear-sky irradiance
        if elev_deg <= 0:
            # Sun below horizon (night)
            irrad = 0.0
        else:
            # Clear-sky direct irradiance (cosine law approximation)
            # Air mass approximation: AM = 1 / sin(elev_deg)
            # Using a simplified form: I = I0 * dust * sin(elev_deg) for low angles
            # At higher angles, use cosine law
            elev_rad = np.radians(elev_deg)
            clear_sky_factor = np.sin(elev_rad)  # cosine law for direct beam
            irrad = MARS_SOLAR_CONSTANT * DUST_ATTENUATION * clear_sky_factor
    
    return irrad


if __name__ == "__main__":
    """Sanity-check irradiance across sol_time for sunlit and shadowed."""
    
    print("Solar Irradiance Model Sanity Check")
    print("=" * 60)
    print()
    
    # Test a range of sol_time values
    test_times = [0.0, 0.25, 0.5, 0.75, 1.0]
    
    print("Sunlit Cells:")
    print("-" * 40)
    for t in test_times:
        irrad = irradiance_w_m2(t, shadowed=0)
        sol_hour = 6 + 12 * t
        print(f"  sol_time={t:.2f} (hour~{sol_hour:5.1f}): {irrad:7.1f} W/m^2")
    
    print()
    print("Shadowed Cells:")
    print("-" * 40)
    for t in test_times:
        irrad = irradiance_w_m2(t, shadowed=1)
        sol_hour = 6 + 12 * t
        print(f"  sol_time={t:.2f} (hour~{sol_hour:5.1f}): {irrad:7.1f} W/m^2")
    
    print()
    print("✓ Model initialized successfully")
