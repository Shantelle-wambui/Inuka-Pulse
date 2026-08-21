#!/usr/bin/env bash
# ============================================================
# Inuka Pulse — Live ETL Loop
# ============================================================
# Runs the Inuka live bridge every 60 seconds so the Spring
# Boot backend always reads fresh Inuka beneficiary data.
#
# The bridge converts Inuka pipeline predictions + field visits
# into live_batch.json format that the Java backend reads.
#
# Usage:
#   chmod +x run_live.sh
#   ./run_live.sh               # runs forever, Ctrl+C to stop
#   INTERVAL=30 ./run_live.sh   # every 30 seconds
#
# Logs are written to logs/etl.log (rotated at 10 MB)
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

INTERVAL="${INTERVAL:-60}"          # seconds between runs
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/etl.log"
MAX_LOG_BYTES=10485760              # 10 MB

mkdir -p "$LOG_DIR"

# Activate virtual env if present
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f "../.venv/bin/activate" ]; then
    source ../.venv/bin/activate
fi

log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
}

rotate_log() {
    if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt "$MAX_LOG_BYTES" ]; then
        mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d%H%M%S).bak"
        log "Log rotated."
    fi
}

log "=== Inuka Pulse Live ETL started (interval=${INTERVAL}s) ==="
log "    Working dir: $SCRIPT_DIR"
log "    Python:      $(python3 --version 2>&1)"

RUN=0
while true; do
    RUN=$((RUN + 1))
    rotate_log
    log "--- Run #${RUN} ---"

    # Run the Inuka live bridge — converts predictions + field visits → live_batch.json
    if python3 src/inuka_live_bridge.py 2>&1 | tee -a "$LOG_FILE"; then
        log "Run #${RUN} completed OK"
    else
        log "Run #${RUN} FAILED (exit $?) — continuing next cycle"
    fi

    log "Sleeping ${INTERVAL}s..."
    sleep "$INTERVAL"
done
