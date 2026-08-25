"""Tests for inuka_features module."""

import pytest
import pandas as pd
from pathlib import Path
import sys

sys.path.insert(0, "src")


def test_features_include_band_now():
    """Features should include band_now from engagement history."""
    from inuka_features import build_features
    
    # Use a small window to keep test fast
    features = build_features(days_back=14)
    assert "band_now" in features.columns
    valid_bands = {"Active", "At-Risk", "Disengaged", "Dropout"}
    assert features["band_now"].dropna().isin(valid_bands).all()
