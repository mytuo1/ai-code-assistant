process.stderr.write("[DEBUG] Starting\n");

(async () => {
  try {
    process.stderr.write("[DEBUG] Importing ink...\n");
    const { createRoot } = await import('./ink.js');
    
    process.stderr.write("[DEBUG] Creating root with exitOnCtrlC=false...\n");
    const root = await createRoot({
      stdout: process.stdout,
      stdin: process.stdin,
      debug: false,
      exitOnCtrlC: false,  // Try disabling this
      patchConsole: false,
    });
    
    process.stderr.write("[DEBUG] ✓ createRoot succeeded!\n");
    process.exit(0);
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
    process.exit(1);
  }
})();
