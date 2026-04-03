process.stderr.write("DIAG9g\n")
for (const mod of [
  './utils/embeddedTools.js',
  './tools/GrepTool/prompt.js',
  './tools/REPLTool/constants.js',
  './memdir/memdir.js',
]) {
  try {
    process.stderr.write(`ok: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR: ${e}\n`) }
}
process.stderr.write("done\n")
