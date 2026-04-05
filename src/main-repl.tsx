/**
 * AI Code Assistant REPL
 * Provider-agnostic, streaming, tool-enabled
 * 
 * Usage:
 *   bun run src/main-repl.tsx
 * 
 * Configuration:
 *   Create .ai-assistant-config.yaml in your project root
 *   (see ARCHITECTURE_DESIGN.md for example)
 */

import { REPL } from './repl/REPL.js'
import { getCwd } from './utils/cwd.js'

async function main() {
  try {
    // Get working directory
    const cwd = getCwd() ?? process.cwd()

    // Initialize REPL with config
    process.stderr.write('[REPL] Initializing...\n')
    const repl = await REPL.initialize(cwd)

    // Start the main loop
    await repl.start()
  } catch (err: any) {
    process.stderr.write(`\x1b[1;31m[FATAL] ${err?.message}\x1b[0m\n`)
    if (process.env.DEBUG) {
      process.stderr.write((err?.stack ?? '') + '\n')
    }
    process.exit(1)
  }
}

main()
