process.stderr.write("DIAG9c: start\n")
for (const mod of [
  './types/ids.js',
  './utils/task/diskOutput.js',
  './state/AppState.js',
]) {
  try {
    process.stderr.write(`DIAG9c: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${String(e)}\n`) }
}
process.stderr.write("DIAG9c: done\n")
