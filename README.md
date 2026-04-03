# AI Code Assistant

An AI-powered coding assistant that works with any OpenAI-compatible model — GPT-4.1, o3, Grok, Gemini, Mistral, Ollama, or anything behind a LiteLLM proxy.

## Suggested repo name

**`ai-code-assistant`** — matches the `name` in package.json and the renamed binary.

Alternatives: `ai-assistant`, `code-agent`, `llm-coding-tool`

---

## Quick start (3 steps)

### 1 — Install

**Linux / macOS**
```bash
./install.sh
```

**Windows (PowerShell)**
```powershell
.\install.ps1
```

Both scripts install Bun if needed and run `bun install`.

### 2 — Configure

```bash
cp .env.example .env
# Open .env and set OPENAI_API_KEY (minimum required)
```

### 3 — Run

```bash
bun start
```

That's it. No login. No browser. No OAuth.

---

## Directory structure

```
ai-code-assistant/
├── src/                        ← App source (TypeScript/Bun/React/Ink)
│   ├── main.tsx                ← Entry point
│   ├── services/api/
│   │   ├── llm.ts              ← Core LLM API (streaming, tools, reasoning models)
│   │   └── client.ts           ← OpenAI client factory
│   ├── services/analytics/     ← Events → LOCAL_REPORTING_URL
│   ├── utils/auth.ts           ← API key from env, zero OAuth
│   └── utils/model/            ← Provider-agnostic model handling
│
├── local-reporting-server/     ← Self-hosted telemetry
│   └── server.ts               ← Dashboard at http://localhost:4040
│
├── stubs/                      ← Stubs for unavailable packages
│   └── @ant/                   ← Anthropic-internal packages (stubbed)
│
├── .env.example                ← All config vars, 15+ providers
├── package.json                ← All dependencies
├── tsconfig.json               ← Path aliases (src/* → ./src/*)
├── bunfig.toml                 ← Bun config
├── install.sh                  ← Linux/macOS install
├── install.ps1                 ← Windows install
├── instructions.md             ← Every env variable documented
├── deployment.md               ← Deploy to server, Docker, systemd
└── package-changes.md          ← Exact npm diff from original
```

---

## Provider examples

```bash
# xAI Grok
OPENAI_BASE_URL=https://api.x.ai/v1  OPENAI_API_KEY=xai-...  OPENAI_MODEL=grok-3

# Google Gemini
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
OPENAI_API_KEY=AIza...  OPENAI_MODEL=gemini-2.5-pro

# o3 with reasoning
OPENAI_MODEL=o3  REASONING_EFFORT=high

# Local Ollama
OPENAI_BASE_URL=http://localhost:11434/v1  OPENAI_API_KEY=ollama  OPENAI_MODEL=llama3.1:70b
```

See `instructions.md` for all providers including WatsonX, Cohere, AWS Bedrock.

---

## Local reporting server (optional)

```bash
cd local-reporting-server
bun server.ts
# Dashboard: http://localhost:4040/dashboard
```

Set `LOCAL_REPORTING_URL=http://localhost:4040` in `.env` to enable.
If not set, all analytics are silently dropped — the app works either way.

---

## Reasoning models — handled automatically

| Model | What happens automatically |
|---|---|
| o3, o4-mini | `max_completion_tokens`, `reasoning_effort`, `developer` role |
| o1 | Falls back to non-streaming (o1 original didn't support streaming) |
| o1-mini | Disables tool use |
| Gemini, Mistral, Llama | Disables `parallel_tool_calls` |

Override any detection: `MODEL_IS_REASONING=1`, `MODEL_NO_TOOLS=1`, `MODEL_NO_STREAMING=1`
