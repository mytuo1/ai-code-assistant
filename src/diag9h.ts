process.stderr.write("DIAG9h\n")
for (const mod of [
  './memdir/teamMemPaths.js',
  './memdir/teamMemPrompts.js',
]) {
  try {
    process.stderr.write(`ok: ${mod}\n`)
    await import(mod)
    process.stderr.write(`loaded ok\n`)
  } catch(e) { process.stderr.write(`ERR: ${e}\n`) }
}
process.stderr.write("done\n")
