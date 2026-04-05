process.stderr.write("[DEBUG] Console-based REPL (no Ink)\n");

(async () => {
  try {
    if (process.stdin.isPaused?.()) process.stdin.resume();
    
    // Setup terminal
    process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    // Draw UI with raw ANSI
    process.stdout.write('\x1b[1;36m'); // Cyan bold
    process.stdout.write('╔════════════════════════════════════════╗\n');
    process.stdout.write('║         AI Code Assistant REPL          ║\n');
    process.stdout.write('╚════════════════════════════════════════╝\n');
    process.stdout.write('\x1b[0m'); // Reset
    
    process.stdout.write('\nType your query below (Ctrl+C to exit):\n');
    process.stdout.write('\x1b[1;33m> \x1b[0m'); // Yellow prompt
    
    let input = '';
    
    process.stdin.on('data', async (data) => {
      const key = data.toString();
      
      if (key === '\x03') { // Ctrl+C
        process.stdout.write('\x1b[?1049l\x1b[?25h');
        process.exit(0);
      }
      
      if (key === '\r' || key === '\n') {
        process.stdout.write('\n');
        
        if (input.trim()) {
          process.stderr.write(`[DEBUG] User input: ${input}\n`);
          process.stdout.write(`You said: ${input}\n`);
          input = '';
        }
        
        process.stdout.write('\x1b[1;33m> \x1b[0m');
      } else if (key === '\x7f') { // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\x08 \x08'); // Visual backspace
        }
      } else if (key.charCodeAt(0) >= 32) { // Printable
        input += key;
        process.stdout.write(key);
      }
    });
    
    process.stderr.write("[DEBUG] REPL ready\n");
    
    setInterval(() => {}, 500);
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
    process.exit(1);
  }
})();
