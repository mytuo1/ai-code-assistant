process.stderr.write("DIAG8: start\n")
for (const mod of [
  './utils/autoUpdater.js',
  './utils/bundledMode.js',
  './utils/execFileNoThrow.js',
  './utils/fsOperations.js',
  './utils/ripgrep.js',
  './utils/sandbox/sandbox-adapter.js',
  './utils/settings/managedPath.js',
  './utils/settings/types.js',
  './utils/which.js',
  './utils/config.js',
]) {
  try {
    process.stderr.write(`DIAG8: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${String(e)}\n`) }
}
process.stderr.write("DIAG8: done\n")
