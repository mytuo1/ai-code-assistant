process.stderr.write("DIAG7: start\n")
for (const mod of [
  './utils/autoUpdater.js',
  './utils/doctorDiagnostic.js',
  './components/AutoUpdater.js',
  './components/NativeAutoUpdater.js',
  './components/PackageManagerAutoUpdater.js',
]) {
  try {
    process.stderr.write(`DIAG7: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${String(e)}\n`) }
}
process.stderr.write("DIAG7: done\n")
