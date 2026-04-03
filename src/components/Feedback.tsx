import * as React from 'react';
import { Box, Text } from '../ink.js';  // adjust path if your ink export is elsewhere

// === REDACT FUNCTION (exactly what the rest of the code expects) ===
export function redactSensitiveInfo(text: string): string {
  let redacted = text;

  // LLM API keys (sk-ant... etc.) — safe no-op for open-source
  redacted = redacted.replace(/"(sk-ant[^\s"']{24,})"/g, '"[REDACTED_API_KEY]"');
  redacted = redacted.replace(
    /(?<![A-Za-z0-9"'])(sk-ant-?[A-Za-z0-9_-]{10,})(?![A-Za-z0-9"'])/g,
    '[REDACTED_API_KEY]'
  );

  // Generic keys / tokens / secrets
  redacted = redacted.replace(/(["']?x-api-key["']?\s*[:=]\s*["']?)[^"',\s)}\]]+/gi, '$1[REDACTED_API_KEY]');
  redacted = redacted.replace(/(["']?authorization["']?\s*[:=]\s*["']?(bearer\s+)?)[^"',\s)}\]]+/gi, '$1[REDACTED_TOKEN]');
  redacted = redacted.replace(/((API[-_]?KEY|TOKEN|SECRET|PASSWORD)\s*[=:]\s*)["']?[^"',\s)}\]]+["']?/gi, '$1[REDACTED]');

  return redacted;
}

// === MINIMAL COMPONENT (auto-closes feedback dialog) ===
type Props = {
  abortSignal: AbortSignal;
  messages: any[];
  initialDescription?: string;
  onDone: (result: string, options?: any) => void;
  backgroundTasks?: any;
};

export function Feedback({ onDone }: Props): React.ReactNode {
  React.useEffect(() => {
    // Immediately close — we disabled the old Anthropic feedback flow
    onDone('Feedback disabled in open-source version (use local reporting server)', {
      display: 'system',
    });
  }, [onDone]);

  return (
    <Box>
      <Text dimColor>Feedback / bug report disabled (open-source build)</Text>
    </Box>
  );
}
