process.stderr.write("DIAG9j\n")
for (const mod of [
  './utils/codeIndexing.js',
  './utils/bash/bashParser.js',
  './utils/bash/parser.js',
  './utils/bash/ast.js',
]) {
  try {
    process.stderr.write(`ok: ${mod}\n`)
    await import(mod)
    process.stderr.write(`loaded\n`)
  } catch(e) { process.stderr.write(`ERR: ${e}\n`) }
}
process.stderr.write("done\n")
