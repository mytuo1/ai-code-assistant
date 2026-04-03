process.stderr.write("DIAG9d\n")
for (const mod of [
  './bootstrap/state.js',
  './utils/errors.js',
  './utils/fsOperations.js',
  './utils/log.js',
  './utils/permissions/filesystem.js',
]) {
  try {
    process.stderr.write(`ok: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${String(e)}\n`) }
}
