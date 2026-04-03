process.stderr.write("DIAGF\n")
for (const mod of [
  './services/api/firstPartyEventLogger.js',
  './utils/browser.js',
  './utils/privacyLevel.js',
  './utils/systemPromptType.js',
  './components/ConfigurableShortcutHint.js',
  './components/design-system/Byline.js',
  './components/design-system/Dialog.js',
  './components/TextInput.js',
]) {
  try {
    process.stderr.write(`ok: ${mod}\n`)
    await import(mod)
  } catch(e) { process.stderr.write(`ERR: ${e}\n`) }
}
process.stderr.write("done\n")
