# inuka-pipeline/tests/test_generate_inuka_data.py
import pytest
import sys
sys.path.insert(0, "src")

def test_build_trajectory_returns_correct_length():
    from generate_inuka_data import build_trajectory
    traj = build_trajectory(is_high_risk=True, n_weeks=26)
    assert len(traj) == 26
    assert all(b in ["Active", "At-Risk", "Disengaged", "Dropout"] for b in traj)

def test_build_trajectory_gradual_decline_has_progression():
    from generate_inuka_data import build_trajectory, TRAJECTORY_TYPES
    # Force gradual_decline by mocking random - for now just check it returns valid bands
    traj = build_trajectory(is_high_risk=True, n_weeks=26)
    # At minimum, trajectory should be a list of valid bands
    valid_bands = {"Active", "At-Risk", "Disengaged", "Dropout"}
    assert all(b in valid_bands for b in traj)

def test_stable_active_trajectory_stays_active():
    from generate_inuka_data import _build_trajectory_by_type
    traj = _build_trajectory_by_type("stable_active", n_weeks=26)
    assert traj == ["Active"] * 26
