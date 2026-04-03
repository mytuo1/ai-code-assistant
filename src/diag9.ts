process.stderr.write("DIAG9: start\n")
for (const mod of [
  'src/coordinator/coordinatorMode.js',
  'src/state/teammateViewHelpers.js',
  'src/tasks/DreamTask/DreamTask.js',
  'src/tasks/InProcessTeammateTask/InProcessTeammateTask.js',
  'src/tasks/LocalAgentTask/LocalAgentTask.js',
  'src/tasks/LocalShellTask/LocalShellTask.js',
  'src/tasks/RemoteAgentTask/RemoteAgentTask.js',
  'src/tasks/types.js',
  'src/utils/swarm/constants.js',
  '../../commands/ultraplan.js',
  '../../context/overlayContext.js',
  '../../keybindings/useKeybinding.js',
  '../../keybindings/useShortcutDisplay.js',
].map(m => m.startsWith('src/') ? './' + m.slice(4) : m)) {
  try {
    process.stderr.write(`DIAG9: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${String(e)}\n`) }
}
process.stderr.write("DIAG9: done\n")
