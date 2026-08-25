# ── Stage 1: build deps ───────────────────────────────────────────────────────
# Separate stage so pip install is cached unless requirements.txt changes
FROM python:3.11-slim AS deps

WORKDIR /app

# Install build tools needed by some scientific packages (scipy, pyarrow)
RUN apt-get update -q \
    && apt-get install -y --no-install-recommends gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy installed packages from the build stage
COPY --from=deps /install /usr/local

# Copy the full pipeline source
COPY . .

# Ensure the warehouse output directory exists inside the image.
# In docker-compose this path is bind-mounted to the 'pipeline-data' volume
# so the backend can read live_batch.json from the same volume.
RUN mkdir -p data/warehouse data/quarantine models

# Default command: run the full ETL + ML + live bridge sequence.
# docker-compose overrides this via the 'command' key if needed.
CMD ["sh", "-c", \
     "python -m src.inuka_features && \
      python -m src.inuka_predict --score && \
      python -m src.inuka_live_bridge"]
