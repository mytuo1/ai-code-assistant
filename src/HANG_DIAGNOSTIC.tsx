// ================================================
// HANG DIAGNOSTIC - Find where it gets stuck
// ================================================

process.stderr.write("[DEBUG] Starting with timeout wrapper\n");

// Set a timeout - if nothing happens in 5 seconds, exit
const timeout = setTimeout(() => {
  process.stderr.write("[ERROR] TIMEOUT: Process hung for 5 seconds!\n");
  process.stderr.write("[ERROR] Likely hung at: createRoot() or render()\n");
  process.exit(1);
}, 5000);

(async () => {
  try {
    process.stderr.write("[DEBUG] Importing Ink...\n");
    const { createRoot, Text, Box } = await import('./ink.js');
    process.stderr.write("[DEBUG] Ink imported\n");
    
    process.stderr.write("[DEBUG] About to call createRoot...\n");
    process.stderr.write("[DEBUG] stdin.isTTY = " + process.stdin.isTTY + "\n");
    process.stderr.write("[DEBUG] stdout.isTTY = " + process.stdout.isTTY + "\n");
    
    // Create root with timeout
    const rootPromise = createRoot({
      stdout: process.stdout,
      stdin: process.stdin,
      debug: false,
      exitOnCtrlC: true,
    });
    
    process.stderr.write("[DEBUG] createRoot() called, awaiting...\n");
    const root = await rootPromise;
    process.stderr.write("[DEBUG] ✓ createRoot() returned\n");
    
    clearTimeout(timeout);
    process.stderr.write("[DEBUG] SUCCESS! createRoot() works\n");
    process.exit(0);
    
  } catch (err: any) {
    clearTimeout(timeout);
    process.stderr.write(`[ERROR] Exception: ${err?.message}\n`);
    if (err?.stack) {
      process.stderr.write(`[ERROR] ${String(err.stack).substring(0, 500)}\n`);
    }
    process.exit(1);
  }
})();
