process.stderr.write("DIAG9f\n")
for (const mod of [
  './utils/git.js',
  './utils/path.js',
  './memdir/paths.js',
  './tools/AgentTool/agentMemory.js',
]) {
  try {
    process.stderr.write(`ok: ${mod}\n`)
    const m = await import(mod)
    process.stderr.write(`loaded: ${Object.keys(m).slice(0,3).join(',')}\n`)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${e}\n`) }
}
