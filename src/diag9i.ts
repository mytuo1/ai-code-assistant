process.stderr.write("DIAG9i\n")
for (const mod of [
  './services/api/llm.js',
  './services/mcp/client.js',
  './tools/BashTool/BashTool.js',
  './tools/FileEditTool/FileEditTool.js',
  './tools/FileWriteTool/FileWriteTool.js',
  './tools.js',
  './services/tokenEstimation.js',
  './tools/AgentTool/constants.js',
  './tools/TaskOutputTool/constants.js',
  './utils/systemPromptType.js',
  './utils/toolSchemaCache.js',
  './utils/windowsPaths.js',
  './utils/zodToJsonSchema.js',
  './utils/api.js',
]) {
  try {
    process.stderr.write(`ok: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${e}\n`) }
}
process.stderr.write("done\n")
