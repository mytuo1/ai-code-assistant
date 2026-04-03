try {
  process.stderr.write("testing Task\n")
  await import('./Task.js')
  process.stderr.write("testing analytics\n")
  await import('./services/analytics/index.js')
  process.stderr.write("testing teammateViewHelpers\n")
  await import('./state/teammateViewHelpers.js')
  process.stderr.write("done\n")
} catch(e) { process.stderr.write("ERR: " + String(e) + "\n") }
