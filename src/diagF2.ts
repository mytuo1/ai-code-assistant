process.stderr.write("DIAGF2\n")
for (const mod of [
  './services/analytics/firstPartyEventLogger.js',
  './components/Feedback.js',
]) {
  try {
    process.stderr.write(`ok: ${mod}\n`)
    await import(mod)
    process.stderr.write(`loaded\n`)
  } catch(e) { process.stderr.write(`ERR: ${e}\n`) }
}
process.stderr.write("done\n")
