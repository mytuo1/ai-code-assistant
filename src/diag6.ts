process.stderr.write("DIAG6: start\n")
for (const mod of [
  './context/voice.js',
  './hooks/useApiKeyVerification.js',
  './hooks/useIdeConnectionStatus.js',
  './hooks/useMainLoopModel.js',
  './hooks/useVoiceEnabled.js',
  './services/claudeAiLimitsHook.js',
  './services/compact/autoCompact.js',
  './utils/hooks/fileChangedWatcher.js',
  './utils/ide.js',
  './utils/tokens.js',
  './components/AutoUpdaterWrapper.js',
  './components/ConfigurableShortcutHint.js',
  './components/IdeStatusIndicator.js',
  './components/MemoryUsageIndicator.js',
  './components/SentryErrorBoundary.js',
  './components/TokenWarning.js',
  './components/PromptInput/SandboxPromptFooterHint.js',
  './components/PromptInput/VoiceIndicator.js',
]) {
  try {
    process.stderr.write(`DIAG6: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${String(e)}\n`) }
}
process.stderr.write("DIAG6: done\n")
