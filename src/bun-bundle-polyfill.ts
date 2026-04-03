/**
 * bun:bundle polyfill
 *
 * The original code uses `import { feature } from 'bun:bundle'` which is a
 * Bun compile-time macro for dead-code elimination. At runtime it needs to
 * return false for all internal flags (they're Anthropic-internal features)
 * OR read from environment variables.
 *
 * This module is imported by the alias below in package.json.
 * Set FEATURE_<FLAG>=1 to enable specific features.
 */

export function feature(flag: string): boolean {
  const envKey = `FEATURE_${flag.toUpperCase().replace(/-/g, '_')}`
  return process.env[envKey] === '1'
}

// ({VERSION:"1.0.0",PACKAGE_URL:process.env.PACKAGE_NAME??"ai-code-assistant"}) global — replaces Bun build-time macros
declare global {
  var ({VERSION:"1.0.0",PACKAGE_URL:process.env.PACKAGE_NAME??"ai-code-assistant"}): { VERSION: string; PACKAGE_URL: string; [key: string]: unknown }
}

if (typeof globalThis.({VERSION:"1.0.0",PACKAGE_URL:process.env.PACKAGE_NAME??"ai-code-assistant"}) === 'undefined') {
  globalThis.({VERSION:"1.0.0",PACKAGE_URL:process.env.PACKAGE_NAME??"ai-code-assistant"}) = {
    VERSION: process.env.PACKAGE_VERSION ?? '1.0.0',
    PACKAGE_URL: process.env.PACKAGE_NAME ?? 'ai-code-assistant',
  }
}
