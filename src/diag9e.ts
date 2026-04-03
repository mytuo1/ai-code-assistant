process.stderr.write("DIAG9e\n")
for (const mod of [
  './memdir/paths.js',
  './tools/AgentTool/agentMemory.js',
  './Tool.js',
  './tools/FileReadTool/prompt.js',
  './utils/plans.js',
  './utils/sessionStorage.js',
  './utils/settings/constants.js',
  './utils/shell/readOnlyCommandValidation.js',
  './utils/toolResultStorage.js',
  './utils/windowsPaths.js',
  './utils/permissions/PermissionRule.js',
  './utils/permissions/PermissionUpdate.js',
  './utils/permissions/PermissionUpdateSchema.js',
  './utils/permissions/permissions.js',
]) {
  try {
    process.stderr.write(`ok: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR ${mod}: ${e}\n`) }
}
process.stderr.write("done\n")
