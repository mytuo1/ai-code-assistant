process.stderr.write("[DEBUG] Raw stdout test (no Ink)\n");

(async () => {
  try {
    if (process.stdin.isPaused?.()) process.stdin.resume();
    
    // Write directly to stdout
    process.stdout.write('\x1b[?1049h'); // Alt screen
    process.stdout.write('\x1b[2J');     // Clear
    process.stdout.write('\x1b[H');      // Home
    
    // Write visible text directly
    process.stdout.write('\x1b[1;32m');  // Bold green
    process.stdout.write('╔══════════════════════════════════╗\n');
    process.stdout.write('║   HELLO - THIS IS RAW TEXT       ║\n');
    process.stdout.write('║   Type below:                    ║\n');
    process.stdout.write('╚══════════════════════════════════╝\n');
    process.stdout.write('\x1b[0m');     // Reset
    
    process.stderr.write("[DEBUG] Text written to stdout\n");
    process.stderr.write("[DEBUG] Can you see the green box above?\n");
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    process.stdin.on('data', (data) => {
      const key = data.toString();
      if (key === '\x03') { // Ctrl+C
        process.stdout.write('\x1b[?1049l');
        process.exit(0);
      }
      process.stderr.write(`[DEBUG] Key: ${Buffer.from(data).toString('hex')}\n`);
      process.stdout.write(key); // Echo it
    });
    
    setInterval(() => {}, 500);
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
  }
})();
