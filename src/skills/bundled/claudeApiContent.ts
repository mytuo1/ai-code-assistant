/**
 * OpenAI SDK skill — replaced from Claude API skill.
 * Shows users how to call the OpenAI API / compatible providers.
 */

export const SKILL_DESCRIPTION = `Guide for using the OpenAI SDK and compatible APIs.`

export const OPENAI_SKILL_CONTENT = `
## Using the OpenAI SDK

Install: \`npm install openai\` or \`pip install openai\`

### Basic usage (Node.js)
\`\`\`typescript
import OpenAI from 'openai'
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const response = await client.chat.completions.create({
  model: process.env.OPENAI_MODEL ?? 'gpt-4.1',
  messages: [{ role: 'user', content: 'Hello!' }],
})
console.log(response.choices[0].message.content)
\`\`\`

### With any compatible provider
Set \`baseURL\` to your provider's endpoint:
\`\`\`typescript
const client = new OpenAI({
  apiKey: 'your-key',
  baseURL: 'https://api.x.ai/v1', // xAI, Mistral, Groq, Ollama, etc.
})
\`\`\`
`

// Legacy constants — callers still reference these
export const CURRENT_MODEL_IDS = {
  large:     process.env.OPENAI_MODEL             ?? 'gpt-4.1',
  small:     process.env.OPENAI_SMALL_FAST_MODEL  ?? 'gpt-4.1-mini',
  reasoning: 'o3',
}
// Compatibility aliases
export const OPUS_ID    = CURRENT_MODEL_IDS.reasoning
export const SONNET_ID  = CURRENT_MODEL_IDS.large
export const HAIKU_ID   = CURRENT_MODEL_IDS.small
export const PREV_SONNET_ID = CURRENT_MODEL_IDS.large
