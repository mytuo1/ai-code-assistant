process.stderr.write("DIAG5b: start\n")
for (const mod of [
  './components/PromptInput/HistorySearchInput.js',
  './components/PromptInput/IssueFlagBanner.js',
  './components/PromptInput/Notifications.js',
  './components/PromptInput/PromptInputFooter.js',
  './components/PromptInput/PromptInputFooterLeftSide.js',
  './components/PromptInput/PromptInputFooterSuggestions.js',
  './components/PromptInput/PromptInputHelpMenu.js',
  './components/PromptInput/PromptInputModeIndicator.js',
  './components/PromptInput/PromptInputQueuedCommands.js',
  './components/PromptInput/PromptInputStashNotice.js',
  './components/PromptInput/SandboxPromptFooterHint.js',
  './components/PromptInput/ShimmeredInput.js',
  './components/PromptInput/VoiceIndicator.js',
  './components/PromptInput/inputModes.js',
  './components/PromptInput/useMaybeTruncateInput.js',
  './components/PromptInput/usePromptInputPlaceholder.js',
  './components/PromptInput/useShowFastIconHint.js',
  './components/PromptInput/useSwarmBanner.js',
  './components/PromptInput/utils.js',
]) {
  try {
    process.stderr.write(`DIAG5b: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR: ${mod}: ${String(e)}\n`) }
}
process.stderr.write("DIAG5b: done\n")
