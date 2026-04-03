# Configuration Reference — Every Variable

No login required. Set OPENAI_API_KEY and run. Everything else is optional.

---

## MINIMUM TO RUN

  OPENAI_API_KEY=sk-...your-key...

That is it. The app starts, connects to OpenAI, analytics are silently dropped.
Add LOCAL_REPORTING_URL if you want visibility into what the agent is doing.

---

## 1. LLM PROVIDER

### Direct OpenAI (default)
  OPENAI_API_KEY=sk-...                         REQUIRED
  OPENAI_MODEL=gpt-4.1                          default: gpt-4.1
  OPENAI_SMALL_FAST_MODEL=gpt-4.1-mini          default: gpt-4.1-mini (used for sub-tasks)
  OPENAI_ORG_ID=org-...                         optional

### xAI (Grok) — OpenAI-compatible
  OPENAI_BASE_URL=https://api.x.ai/v1
  OPENAI_API_KEY=xai-...
  OPENAI_MODEL=grok-3
  OPENAI_SMALL_FAST_MODEL=grok-3-mini

### Google Gemini — OpenAI-compatible endpoint
  OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
  OPENAI_API_KEY=AIza...                        Google AI Studio key
  OPENAI_MODEL=gemini-2.5-pro
  OPENAI_SMALL_FAST_MODEL=gemini-2.5-flash

### Mistral — OpenAI-compatible
  OPENAI_BASE_URL=https://api.mistral.ai/v1
  OPENAI_API_KEY=...
  OPENAI_MODEL=mistral-large-latest
  OPENAI_SMALL_FAST_MODEL=mistral-small-latest

### Groq — OpenAI-compatible
  OPENAI_BASE_URL=https://api.groq.com/openai/v1
  OPENAI_API_KEY=gsk_...
  OPENAI_MODEL=llama-3.3-70b-versatile
  OPENAI_SMALL_FAST_MODEL=llama-3.1-8b-instant

### Cerebras — OpenAI-compatible
  OPENAI_BASE_URL=https://api.cerebras.ai/v1
  OPENAI_API_KEY=csk-...
  OPENAI_MODEL=llama3.1-70b

### Together AI — OpenAI-compatible
  OPENAI_BASE_URL=https://api.together.xyz/v1
  OPENAI_API_KEY=...
  OPENAI_MODEL=meta-llama/Llama-3.3-70B-Instruct-Turbo
  OPENAI_SMALL_FAST_MODEL=meta-llama/Llama-3.2-3B-Instruct-Turbo

### Fireworks AI — OpenAI-compatible
  OPENAI_BASE_URL=https://api.fireworks.ai/inference/v1
  OPENAI_API_KEY=fw_...
  OPENAI_MODEL=accounts/fireworks/models/deepseek-r1

### Perplexity — OpenAI-compatible
  OPENAI_BASE_URL=https://api.perplexity.ai
  OPENAI_API_KEY=pplx-...
  OPENAI_MODEL=llama-3.1-sonar-large-128k-online

### Azure OpenAI
  AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com   REQUIRED for Azure
  AZURE_OPENAI_API_KEY=...                                        REQUIRED for Azure
  OPENAI_MODEL=gpt-4.1                                            must match your deployment name
  AZURE_OPENAI_API_VERSION=2024-08-01-preview                     default shown

### Ollama (local) — OpenAI-compatible
  OPENAI_BASE_URL=http://localhost:11434/v1
  OPENAI_API_KEY=ollama                         any string
  OPENAI_MODEL=llama3.1:70b
  OPENAI_SMALL_FAST_MODEL=llama3.2:3b

### vLLM (local) — OpenAI-compatible
  OPENAI_BASE_URL=http://localhost:8000/v1
  OPENAI_API_KEY=vllm
  OPENAI_MODEL=meta-llama/Llama-3.1-70B-Instruct

### LM Studio (local) — OpenAI-compatible
  OPENAI_BASE_URL=http://localhost:1234/v1
  OPENAI_API_KEY=lmstudio
  OPENAI_MODEL=local-model

### WatsonX IBM — requires LiteLLM proxy
  # First: pip install 'litellm[proxy]'
  # Then:  litellm --model watsonx/ibm/granite-20b-code-instruct --port 4000
  OPENAI_BASE_URL=http://localhost:4000/v1
  OPENAI_API_KEY=anything
  OPENAI_MODEL=watsonx/ibm/granite-20b-code-instruct
  WATSONX_API_KEY=...
  WATSONX_URL=https://us-south.ml.cloud.ibm.com
  WATSONX_PROJECT_ID=...

### AWS Bedrock (non-Anthropic models) — requires LiteLLM proxy
  # litellm --model bedrock/amazon.nova-pro-v1:0 --port 4000
  OPENAI_BASE_URL=http://localhost:4000/v1
  OPENAI_API_KEY=anything
  OPENAI_MODEL=bedrock/amazon.nova-pro-v1:0
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_REGION_NAME=us-east-1

### Cohere — requires LiteLLM proxy
  # litellm --model cohere/command-r-plus --port 4000
  OPENAI_BASE_URL=http://localhost:4000/v1
  OPENAI_API_KEY=anything
  OPENAI_MODEL=cohere/command-r-plus
  COHERE_API_KEY=...

---

## 2. REASONING MODEL TUNING

These apply when using o1, o3, o4-mini, or any reasoning-capable model.

  REASONING_EFFORT=high               default: high. Options: low, medium, high
                                      Controls how much compute the model spends reasoning.
                                      Only applies to o3 and o4-series models.

  MODEL_IS_REASONING=1                Force reasoning-model mode for any model name.
                                      Use this for custom/fine-tuned reasoning models.

  MODEL_NO_STREAMING=1                Disable streaming for any model.
                                      The app will use non-streaming (blocks until complete).
                                      Auto-set for o1 (original).

  MODEL_NO_TOOLS=1                    Disable tool use for any model.
                                      Auto-set for o1-mini.
                                      Use for models that reject tool definitions.

  MODEL_NO_PARALLEL_TOOLS=1           Disable parallel tool calls.
                                      Auto-set for Gemini, Mistral, Llama.
                                      Use if your model rejects parallel_tool_calls.

  MODEL_TEMPERATURE=0.7               Set temperature (float).
                                      Omit for reasoning models (ignored by o1/o3/o4).

  MODEL_MAX_OUTPUT_TOKENS=32768       Override max output tokens for any model.
  MODEL_CONTEXT_WINDOW=200000         Override context window size for any model.
  MODEL_KNOWLEDGE_CUTOFF=2025-01      Set the knowledge cutoff date shown to the model.

---

## 3. AUTHENTICATION — ZERO LOGIN

  OPENAI_API_KEY=sk-...               REQUIRED. Your API key for whichever provider.
  ANTHROPIC_API_KEY=sk-ant-...        Legacy fallback — checked if OPENAI_API_KEY is not set.

There is no login command, no browser flow, no OAuth. Set the key and run.

---

## 4. LOCAL REPORTING SERVER

  LOCAL_REPORTING_URL=http://localhost:4040    Base URL of your local reporting server.
                                               If unset, all analytics are silently dropped.
                                               App works fine without it.

  LOCAL_SESSION_DIR=~/.local-sessions         Where session transcripts are written (NDJSON).
  LOCAL_METRICS_DIR=~/.local-metrics          Where metric files are written (NDJSON).

Reporting server settings (set when running local-reporting-server/server.ts):
  PORT=4040                                   Server port.
  DATA_DIR=./data                             Directory for NDJSON files.

---

## 5. AGENT IDENTITY

  AGENT_NAME=AI Code Assistant               Name in system prompts and UI.
  PACKAGE_NAME=ai-code-assistant             Name in update/install messages.
  AGENT_BASE_URL=                            Base URL for remote session links (optional).
  AGENT_DOCS_URL=https://...                 URL shown in agent doc links.

---

## 6. MODEL CONTEXT AND CAPABILITY

  MODEL_CONTEXT_WINDOW=200000         Override context window tokens for unlisted models.
  MODEL_MAX_OUTPUT_TOKENS=32768       Override max output tokens for unlisted models.
  DISABLE_1M_CONTEXT=1                Disable 1M context mode even for supporting models.
  VERTEX_REGION=us-central1           Default region if using a Vertex-style endpoint.

---

## 7. FEATURE FLAGS

All GrowthBook feature flags replaced with env vars. Set to 1 to enable.

  DISABLE_ANALYTICS=1                 Disable all analytics event logging.
  FEATURE_REACTIVE_COMPACT=1          Enable reactive context compaction.
  FEATURE_CONTEXT_COLLAPSE=1          Enable context collapse.
  FEATURE_CONNECTOR_TEXT=1            Enable connector text streaming blocks.
  FEATURE_TENGU_TOOL_PEAR=1           Enable strict JSON schemas for tools.

---

## 8. BRIDGE / REMOTE SESSIONS (advanced)

  BRIDGE_ENABLED=1                    Enable the bridge/remote session feature.
                                      Disabled by default.
  BRIDGE_SESSION_URL=wss://...        Your bridge backend WebSocket URL.
  BRIDGE_API_KEY=...                  API key for the bridge backend.
                                      Falls back to OPENAI_API_KEY if unset.

---

## 9. MCP

  LOCAL_MCP_REGISTRY_URL=http://...   URL to your own MCP server registry.
                                      If unset, auto-discovery is disabled.
                                      Configure MCP servers manually in settings.

---

## 10. DEBUGGING

  DEBUG_TO_STDERR=1                   Log full API request details to stderr.
  CLAUDE_ENABLE_STREAM_WATCHDOG=1     Abort streams idle for more than N ms.
  CLAUDE_STREAM_IDLE_TIMEOUT_MS=90000 Idle timeout ms (watchdog must be enabled).
  API_TIMEOUT_MS=600000               Request timeout in ms (default 10 minutes).

---

## COMPLETE .env.example

See the .env.example file in the project root. It has every variable with comments.

---

## PRE-FLIGHT CHECKLIST

Before deploying to a new machine, verify:

[ ] OPENAI_API_KEY is set and non-empty
[ ] Model is reachable: curl $OPENAI_BASE_URL/models -H "Authorization: Bearer $OPENAI_API_KEY"
    (or use a test completion if /models is not supported by your provider)
[ ] App starts without any login prompt
[ ] No traffic to api.anthropic.com: ss -tp | grep anthropic  (should be empty)
[ ] If using reporting: curl $LOCAL_REPORTING_URL/health returns {"ok":true}
[ ] Dashboard accessible: open http://localhost:4040/dashboard
