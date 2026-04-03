process.stderr.write("DIAG5: start\n")
try {
  process.stderr.write("DIAG5: PromptInput\n")
  await import('./components/PromptInput/PromptInput.js')
  process.stderr.write("DIAG5: VirtualMessageList\n")
  await import('./components/VirtualMessageList.js')
  process.stderr.write("DIAG5: LogoV2\n")
  await import('./components/LogoV2/LogoV2.js')
  process.stderr.write("DIAG5: REPL\n")
  await import('./screens/REPL.js')
  process.stderr.write("DIAG5: done!\n")
} catch(e) {
  process.stderr.write("ERR: " + String(e) + "\n")
  if (e instanceof Error) process.stderr.write(e.stack + "\n")
}
