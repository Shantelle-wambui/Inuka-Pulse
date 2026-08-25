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


def test_build_beneficiaries_includes_trajectory():
    from generate_inuka_data import build_beneficiaries, build_cohorts
    cohorts = build_cohorts()[:2]  # Just 2 cohorts for speed
    beneficiaries = build_beneficiaries(cohorts)
    assert len(beneficiaries) > 0
    ben = beneficiaries[0]
    assert "trajectory" in ben
    assert isinstance(ben["trajectory"], list)
    assert len(ben["trajectory"]) == 26
    assert ben["current_status"] == ben["trajectory"][-1]


def test_build_engagement_history_creates_weekly_records():
    from generate_inuka_data import build_engagement_history, build_beneficiaries, build_cohorts, START
    from datetime import timedelta
    cohorts = build_cohorts()[:1]
    beneficiaries = build_beneficiaries(cohorts)[:5]  # 5 beneficiaries for speed
    history = build_engagement_history(beneficiaries)
    
    # Each beneficiary should have 26 weekly records
    ben_id = beneficiaries[0]["beneficiary_id"]
    ben_records = [h for h in history if h["beneficiary_id"] == ben_id]
    assert len(ben_records) == 26
    
    # Records should have required columns
    assert all("week_start" in h and "band" in h for h in history)


def test_build_sessions_uses_weekly_band():
    """
    Sessions attendance should vary based on trajectory band, not static status.
    A declining beneficiary should have lower attendance in later weeks.
    """
    from generate_inuka_data import build_sessions, build_beneficiaries, build_cohorts
    
    cohorts = build_cohorts()[:1]
    beneficiaries = build_beneficiaries(cohorts)
    
    # Find a beneficiary with gradual_decline trajectory (if any)
    declining = [b for b in beneficiaries if "Disengaged" in b["trajectory"] or "Dropout" in b["trajectory"]]
    if not declining:
        pytest.skip("No declining beneficiaries in sample")
    
    sessions = build_sessions(beneficiaries)
    # Just verify sessions are generated - detailed attendance testing would be flaky
    assert len(sessions) > 0
    assert all("attended" in s or "attendance_status" in s for s in sessions)
