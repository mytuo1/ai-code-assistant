process.stderr.write("DIAG3: starting\n")
try {
  for (const mod of [
    './bootstrap/state.js',
    './utils/tokenBudget.js',
    './hooks/useSearchInput.js',
    './ink/hooks/use-search-highlight.js',
    './utils/exportRenderer.js',
    './utils/editor.js',
    './components/IdleReturnDialog.js',
    './context/notifications.js',
    './services/notifier.js',
    './services/preventSleep.js',
    './ink/useTerminalNotification.js',
    './ink/terminal.js',
    './utils/fileStateCache.js',
    './types/ids.js',
    './utils/QueryGuard.js',
    './components/Messages.js',
    './components/PromptInput/PromptInput.js',
    './components/LogoV2/LogoV2.js',
    './components/VirtualMessageList.js',
    './screens/REPL.js',
  ]) {
    process.stderr.write(`DIAG3: ${mod}\n`)
    await import(mod)
  }
  process.stderr.write("DIAG3: done!\n")
} catch(e) {
  process.stderr.write("DIAG3 ERROR: " + String(e) + "\n")
  if (e instanceof Error) process.stderr.write(e.stack + "\n")
}
