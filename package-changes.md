# package.json Changes Required

These are the exact npm package changes to make in your `package.json`
before running `bun install` / `npm install`.

## Remove these packages

```json
"@anthropic-ai/sdk": "*",
"@anthropic-ai/bedrock-sdk": "*",
"@anthropic-ai/vertex-sdk": "*",
"@anthropic-ai/foundry-sdk": "*",
"@anthropic-ai/mcpb": "*",
"@anthropic-ai/sandbox-runtime": "*",
"@anthropic-ai/claude-agent-sdk": "*"
```

## Add this package

```json
"openai": "^4.90.0"
```

## Full diff (apply to your dependencies block)

```diff
 "dependencies": {
-  "@anthropic-ai/sdk": "^0.x.x",
-  "@anthropic-ai/bedrock-sdk": "^0.x.x",
-  "@anthropic-ai/vertex-sdk": "^0.x.x",
-  "@anthropic-ai/foundry-sdk": "^0.x.x",
-  "@anthropic-ai/mcpb": "^0.x.x",
-  "@anthropic-ai/sandbox-runtime": "^0.x.x",
-  "@anthropic-ai/claude-agent-sdk": "^0.x.x",
+  "openai": "^4.90.0",
   ... rest of your dependencies unchanged ...
 }
```

## One-liner to apply with jq

```bash
# Remove all @anthropic-ai packages and add openai
cat package.json \
  | jq 'del(.dependencies | to_entries[] | select(.key | startswith("@anthropic-ai"))) | .dependencies.openai = "^4.90.0"' \
  > package.json.tmp && mv package.json.tmp package.json
```

## Optional: if using LiteLLM for non-OpenAI providers

LiteLLM runs as a standalone Python proxy — you do NOT add it to package.json.
Install it separately on the machine running the proxy:

```bash
pip install 'litellm[proxy]'
litellm --model watsonx/ibm/granite-20b-code-instruct --port 4000
```

Then set:
```bash
OPENAI_BASE_URL=http://localhost:4000/v1
```
