# Task 9: Add beneficiary_id to Live Bridge (Phase 5, Part 1)

## Files
- Modify: `inuka-pipeline/src/inuka_live_bridge.py`
- Create: `inuka-pipeline/tests/test_inuka_live_bridge.py`

## Interfaces
- Consumes: `data/warehouse/inuka_predictions_export.json`
- Produces: `data/warehouse/live_batch.json` with explicit `beneficiary_id` field

## Context

The live bridge currently puts `beneficiary_id` in the description field but doesn't expose it as a separate field. This blocks the alert→incident→CAPA chain from threading back to specific beneficiaries.

We need to add `beneficiary_id` as a top-level field in the incident records within `live_batch.json`.

## Steps

### Step 1: Add test for beneficiary_id in incidents

Create `inuka-pipeline/tests/test_inuka_live_bridge.py`:

```python
import pytest
import json
from pathlib import Path
import sys
sys.path.insert(0, "src")

def test_incidents_include_beneficiary_id():
    """Incidents in live_batch.json should have beneficiary_id field."""
    from inuka_live_bridge import load_predictions_as_incidents
    
    incidents = load_predictions_as_incidents("test-batch-123")
    
    assert len(incidents) > 0, "Should have at least one incident"
    for inc in incidents[:5]:  # Check first 5
        assert "beneficiary_id" in inc, "Incident missing beneficiary_id field"
        assert inc["beneficiary_id"], "beneficiary_id should not be empty"
        assert inc["beneficiary_id"].startswith("BEN-"), "beneficiary_id should start with BEN-"
```

### Step 2: Run test to verify it fails

Run: `cd inuka-pipeline && python -m pytest tests/test_inuka_live_bridge.py -v`
Expected: FAIL with KeyError or assertion error

### Step 3: Update blank_row_template to include beneficiary_id

In `inuka_live_bridge.py`, update `blank_row_template()`:

```python
def blank_row_template(batch_id: str, source: str) -> dict:
    """Base template with all live_batch.json fields set to None."""
    return {
        "beneficiary_id": None,  # ← ADD THIS LINE (first field)
        "incident_id": None,
        # ... rest unchanged
    }
```

### Step 4: Update load_predictions_as_incidents to set beneficiary_id

In `load_predictions_as_incidents()`, after extracting `ben_id`, add it to `row.update()`:

```python
row.update({
    "beneficiary_id" : ben_id,  # ← ADD THIS LINE
    "incident_id"    : f"INC-{ben_id}-{today_tag}",
    # ... rest unchanged
})
```

### Step 5: Run test to verify it passes

Run: `cd inuka-pipeline && python -m pytest tests/test_inuka_live_bridge.py -v`
Expected: PASS

### Step 6: Run the live bridge and verify output

```bash
cd inuka-pipeline && python -m src.inuka_live_bridge
```

Then verify:
```bash
python3 -c "
import json
with open('data/warehouse/live_batch.json') as f:
    data = json.load(f)
first_inc = data['incidents'][0] if data['incidents'] else {}
print('beneficiary_id:', first_inc.get('beneficiary_id'))
print('incident_id:', first_inc.get('incident_id'))
"
```

Expected: beneficiary_id shows BEN-XXXX format

### Step 7: Commit

```bash
git add src/inuka_live_bridge.py tests/test_inuka_live_bridge.py
git commit -m "feat(pipeline): add beneficiary_id to live bridge incidents"
```
