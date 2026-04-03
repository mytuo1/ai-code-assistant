import * as React from 'react';

/**
 * Open-source stub for usePromptsFromBrowserIntegration
 * Original was Anthropic-internal (browser/extension prompt sync).
 * Disabled for the clean open-source build — we don't ship any browser integration.
 */
export function usePromptsFromBrowserIntegration() {
  return React.useMemo(() => ({
    prompts: [],
    isEnabled: false,
    isLoading: false,
    error: null,
    refresh: () => {},
    selectPrompt: () => {},
    // These are the common fields the REPL/App expect — add more if next error complains
  }), []);
}
