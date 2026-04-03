process.stderr.write("DIAG2: starting\n")
try {
  const mods = [
    './utils/advisor.js',
    './utils/agentSwarmsEnabled.js', 
    './utils/array.js',
    './utils/asciicast.js',
    './utils/auth.js',
    './utils/earlyInput.js',
    './utils/effort.js',
    './utils/fastMode.js',
    './utils/managedEnv.js',
    './utils/messages.js',
    './utils/platform.js',
    './utils/renderOptions.js',
    './utils/sessionIngressAuth.js',
    './utils/slowOperations.js',
    './utils/warningHandler.js',
    './utils/worktreeModeEnabled.js',
    './services/analytics/sink.js',
    './commands.js',
    './dialogLaunchers.js',
    './ink/termio/dec.js',
    './interactiveHelpers.js',
    './plugins/bundled/index.js',
    './services/claudeAiLimits.js',
    './services/mcp/client.js',
    './skills/bundled/index.js',
    './tools/AgentTool/loadAgentsDir.js',
    './utils/autoUpdater.js',
    './utils/claudeInChrome/prompt.js',
    './utils/claudeInChrome/setup.js',
    './utils/conversationRecovery.js',
    './utils/envUtils.js',
    './utils/git.js',
    './utils/log.js',
    './utils/model/model.js',
    './utils/permissions/permissionSetup.js',
    './utils/sessionStorage.js',
    './utils/settings/settings.js',
    './bootstrap/state.js',
    './interactiveHelpers.js',
    './screens/REPL.js',
  ]
  for (const mod of mods) {
    process.stderr.write(`DIAG2: importing ${mod}...\n`)
    await import(mod)
  }
  process.stderr.write("DIAG2: all done!\n")
} catch(e) {
  process.stderr.write("DIAG2 ERROR: " + String(e) + "\n")
  if (e instanceof Error) process.stderr.write(e.stack + "\n")
}
