# Deployment Guide

How to deploy the AI Code Assistant and Local Reporting Server on a fresh machine.

---

## Prerequisites

  Runtime:    Bun 1.1+  (preferred)  OR  Node.js 22.6+
  API key:    From your chosen LLM provider
  Network:    Access to your provider's API endpoint

---

## Option A — Single Machine (Local / Dev)

  git clone <your-repo> ai-code-assistant && cd ai-code-assistant

  # Linux/macOS
  ./install.sh

  # Windows (PowerShell)
  .\install.ps1

  # Or manually: install Bun then run:
  bun install

  # Start reporting server (optional, separate terminal)
  cd local-reporting-server && bun server.ts

  # Configure
  export OPENAI_API_KEY=sk-...
  export LOCAL_REPORTING_URL=http://localhost:4040   # optional

  # Run
  bun start

---

## Option B — Server Deployment

### Reporting server (on the server)

  curl -fsSL https://bun.sh/install | bash
  cd local-reporting-server

  # With PM2
  npm install -g pm2
  PORT=4040 DATA_DIR=/var/data/assistant pm2 start "bun server.ts" --name assistant-reporting
  pm2 save && pm2 startup

  # Or with systemd (see systemd section below)

IMPORTANT: The reporting server has no authentication.
Run it behind a firewall or VPN. Do not expose it publicly.

### App (on each developer machine)

  export OPENAI_API_KEY=sk-...
  export LOCAL_REPORTING_URL=http://YOUR-SERVER:4040
  bun start

---

## Option C — Docker

### docker-compose.yml

  version: "3.9"
  services:
    reporter:
      build:
        context: .
        dockerfile: Dockerfile.reporter
      ports: ["4040:4040"]
      volumes: ["reporter-data:/app/data"]
      environment:
        PORT: "4040"

    assistant:
      build: .
      depends_on: [reporter]
      environment:
        OPENAI_API_KEY: "${OPENAI_API_KEY}"
        LOCAL_REPORTING_URL: "http://reporter:4040"
        OPENAI_MODEL: "${OPENAI_MODEL:-gpt-4.1}"
        OPENAI_SMALL_FAST_MODEL: "${OPENAI_SMALL_FAST_MODEL:-gpt-4.1-mini}"

  volumes:
    reporter-data:

### Dockerfile.reporter

  FROM oven/bun:1.1-alpine
  WORKDIR /app
  COPY local-reporting-server/ ./
  RUN mkdir -p data
  EXPOSE 4040
  CMD ["bun", "server.ts"]

### Dockerfile (app)

  FROM oven/bun:1.1-debian
  WORKDIR /app
  COPY . .
  RUN bun install --production
  CMD ["bun", "run", "src/main.tsx"]

---

## Option D — Systemd (Linux server)

  # /etc/systemd/system/assistant-reporter.service
  [Unit]
  Description=AI Assistant Local Reporting Server
  After=network.target

  [Service]
  Type=simple
  User=youruser
  WorkingDirectory=/opt/assistant/local-reporting-server
  ExecStart=/home/youruser/.bun/bin/bun server.ts
  Restart=on-failure
  Environment=PORT=4040
  Environment=DATA_DIR=/var/data/assistant-reporter

  [Install]
  WantedBy=multi-user.target

  sudo systemctl enable assistant-reporter
  sudo systemctl start assistant-reporter

---

## Switching LLM Providers

Just change environment variables and restart. No code changes.

### To o3 (high reasoning)
  OPENAI_MODEL=o3
  OPENAI_SMALL_FAST_MODEL=gpt-4.1-mini
  REASONING_EFFORT=high

### To xAI Grok
  OPENAI_BASE_URL=https://api.x.ai/v1
  OPENAI_API_KEY=xai-...
  OPENAI_MODEL=grok-3
  OPENAI_SMALL_FAST_MODEL=grok-3-mini

### To Google Gemini
  OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
  OPENAI_API_KEY=AIza...
  OPENAI_MODEL=gemini-2.5-pro
  OPENAI_SMALL_FAST_MODEL=gemini-2.5-flash

### To local Ollama
  OPENAI_BASE_URL=http://localhost:11434/v1
  OPENAI_API_KEY=ollama
  OPENAI_MODEL=llama3.1:70b
  OPENAI_SMALL_FAST_MODEL=llama3.2:3b
  MODEL_NO_PARALLEL_TOOLS=1          # if tools cause errors

### To WatsonX or any non-OpenAI provider
  # Step 1: install and start LiteLLM proxy
  pip install 'litellm[proxy]'
  litellm --model watsonx/ibm/granite-20b-code-instruct --port 4000

  # Step 2: point app at proxy
  OPENAI_BASE_URL=http://localhost:4000/v1
  OPENAI_API_KEY=anything
  OPENAI_MODEL=watsonx/ibm/granite-20b-code-instruct

---

## Verifying the Deployment

  # Health check
  curl http://localhost:4040/health
  # Expected: {"ok":true,"ts":"..."}

  # Post a test event
  curl -X POST http://localhost:4040/events \
    -H 'Content-Type: application/json' \
    -d '{"event":"deploy_test","metadata":{"machine":"server1"}}'

  # Confirm no calls to Anthropic
  ss -tp | grep anthropic     # should return nothing
  # or on macOS:
  lsof -i | grep anthropic    # should return nothing

  # Open dashboard
  open http://localhost:4040/dashboard

---

## Data Backup

All data is plain NDJSON — just tar it up:

  tar -czf backup-$(date +%Y%m%d).tar.gz local-reporting-server/data/
  tar -xzf backup-20250101.tar.gz

---

## Updating the App

  git pull
  bun install          # picks up any new dependencies
  # Restart the process

No database migrations. No schema changes. NDJSON files are append-only.
