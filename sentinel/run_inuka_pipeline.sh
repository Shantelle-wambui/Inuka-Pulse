#!/usr/bin/env bash
# =============================================================================
# Inuka Pulse — Full Pipeline Runner
# =============================================================================
# Orchestrates the complete generate → features → predict → diagnostics chain.
#
# Usage:
#   chmod +x run_inuka_pipeline.sh
#   ./run_inuka_pipeline.sh              # full run
#   ./run_inuka_pipeline.sh --skip-gen   # skip data generation (data exists)
#   ./run_inuka_pipeline.sh --score-only # re-score existing model
#
# Output artifacts (all in sentinel/data/warehouse/):
#   fact_beneficiary_features.parquet
#   inuka_fact_predictions.parquet
#   inuka_predictions_export.json
#   inuka_backtest_report.json
#   inuka_feature_importance.json
#   inuka_survival_curve_data.json
#   inuka_control_chart_data.json
#   inuka_correlation_data.json
#   inuka_drift_events.json
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_step()  { echo -e "\n${CYAN}${BOLD}▶ $*${NC}"; }
log_ok()    { echo -e "${GREEN}✓ $*${NC}"; }
log_warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
log_error() { echo -e "${RED}✗ $*${NC}"; }

# ── Argument parsing ──────────────────────────────────────────────────────────
SKIP_GEN=false
SCORE_ONLY=false

for arg in "$@"; do
  case $arg in
    --skip-gen)   SKIP_GEN=true   ;;
    --score-only) SCORE_ONLY=true ;;
    --help|-h)
      echo "Usage: $0 [--skip-gen] [--score-only]"
      exit 0
      ;;
  esac
done

# ── Virtual environment ───────────────────────────────────────────────────────
log_step "Activating Python environment"
if [ -f ".venv/bin/activate" ]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
  log_ok "Using .venv"
elif command -v python3 &>/dev/null; then
  log_warn "No .venv found — using system Python3"
else
  log_error "Python3 not found. Install it and retry."
  exit 1
fi

# ── Dependency check ──────────────────────────────────────────────────────────
log_step "Checking dependencies"
python3 -c "import faker, pandas, numpy, sklearn, joblib, lifelines, scipy" 2>/dev/null \
  || { log_warn "Installing missing packages…"
       pip install faker pandas numpy scikit-learn joblib lifelines scipy pyarrow --quiet; }
log_ok "Dependencies OK"

# ── Stage 1: Generate synthetic data ─────────────────────────────────────────
if [ "$SKIP_GEN" = false ] && [ "$SCORE_ONLY" = false ]; then
  log_step "Stage 1 — Generating Inuka synthetic data"
  START_TS=$(date +%s)
  python3 -m src.generate_inuka_data
  ELAPSED=$(( $(date +%s) - START_TS ))
  log_ok "Data generation complete (${ELAPSED}s)"
else
  log_warn "Skipping data generation (--skip-gen or --score-only)"
fi

# ── Stage 2: Feature engineering ─────────────────────────────────────────────
if [ "$SCORE_ONLY" = false ]; then
  log_step "Stage 2 — Building beneficiary features"
  START_TS=$(date +%s)
  python3 -m src.inuka_features
  ELAPSED=$(( $(date +%s) - START_TS ))
  log_ok "Feature engineering complete (${ELAPSED}s)"
  log_ok "Output: data/warehouse/fact_beneficiary_features.parquet"
fi

# ── Stage 3: Predictive model ─────────────────────────────────────────────────
log_step "Stage 3 — Dropout prediction model"
START_TS=$(date +%s)
if [ "$SCORE_ONLY" = true ]; then
  python3 -m src.inuka_predict --score
else
  python3 -m src.inuka_predict --train
fi
ELAPSED=$(( $(date +%s) - START_TS ))
log_ok "Prediction model complete (${ELAPSED}s)"

# ── Stage 4: Statistical diagnostics ─────────────────────────────────────────
if [ "$SCORE_ONLY" = false ]; then
  log_step "Stage 4 — Statistical diagnostics"
  START_TS=$(date +%s)
  python3 -m src.inuka_diagnostics
  ELAPSED=$(( $(date +%s) - START_TS ))
  log_ok "Diagnostics complete (${ELAPSED}s)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Inuka Pulse Pipeline Complete         ${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Warehouse artifacts:"
for f in \
  data/warehouse/fact_beneficiary_features.parquet \
  data/warehouse/inuka_fact_predictions.parquet \
  data/warehouse/inuka_predictions_export.json \
  data/warehouse/inuka_backtest_report.json \
  data/warehouse/inuka_feature_importance.json \
  data/warehouse/inuka_survival_curve_data.json \
  data/warehouse/inuka_control_chart_data.json \
  data/warehouse/inuka_correlation_data.json \
  data/warehouse/inuka_drift_events.json; do
  if [ -f "$f" ]; then
    SIZE=$(du -sh "$f" 2>/dev/null | cut -f1)
    echo -e "  ${GREEN}✓${NC} $f (${SIZE})"
  else
    echo -e "  ${YELLOW}—${NC} $f (not produced)"
  fi
done

echo ""
echo -e "${CYAN}Key numbers to extract for the pitch:${NC}"
python3 - << 'EOF'
import json, pathlib

w = pathlib.Path("data/warehouse")

def read(path):
    try:
        return json.loads(path.read_text())
    except Exception:
        return None

backtest = read(w / "inuka_backtest_report.json")
if backtest:
    print(f"  Model precision:  {backtest.get('precision', 'N/A')}")
    print(f"  Model recall:     {backtest.get('recall', 'N/A')}")
    print(f"  Model F1:         {backtest.get('f1', 'N/A')}")

survival = read(w / "inuka_survival_curve_data.json")
if survival:
    h = survival.get("headline", {})
    print(f"  KM fleet median:  {h.get('fleet_median_days', 'N/A')} days")
    print(f"  KM high-risk:     {h.get('high_risk_median_days', 'N/A')} days")
    print(f"  KM gap ratio:     {h.get('gap_ratio', 'N/A')}×")

control = read(w / "inuka_control_chart_data.json")
if control:
    h = control.get("headline", {})
    print(f"  EWMA lead time:   {h.get('lead_time_weeks', 'N/A')} weeks")

corr = read(w / "inuka_correlation_data.json")
if corr:
    h = corr.get("headline", {})
    print(f"  Pearson r:        {h.get('r', 'N/A')} (disbursement delay vs dropout)")

imp = read(w / "inuka_feature_importance.json")
if imp:
    top = imp[0] if imp else {}
    print(f"  Top risk driver:  {top.get('feature', 'N/A')} "
          f"({top.get('importance', 0)*100:.1f}% of importance)")
EOF

echo ""
log_ok "Run complete. Start the Spring Boot backend and Next.js frontend to see the dashboard."
