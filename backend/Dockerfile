FROM python:3.11-slim
WORKDIR /app

# Install build deps then Python deps
COPY backend/requirements.txt /app/requirements.txt
RUN apt-get update && apt-get install -y --no-install-recommends gcc build-essential libpq-dev && \
    pip install --no-cache-dir -r /app/requirements.txt && \
    apt-get remove -y gcc build-essential libpq-dev && apt-get autoremove -y && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy application
COPY backend/ /app/

ENV PORT=8080
EXPOSE 8080

# Use Uvicorn to serve the FastAPI app
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
