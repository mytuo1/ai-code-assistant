process.stderr.write("DIAG9b: start\n")
for (const mod of [
  './Task.js',
  './tasks/LocalAgentTask/LocalAgentTask.js',
  './state/AppState.js',
]) {
  try {
    process.stderr.write(`DIAG9b: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${String(e)}\n`) }
}
process.stderr.write("DIAG9b: done\n")
