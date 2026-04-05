process.stderr.write("[DEBUG] Ultra-basic test - no REPL, just text\n");

(async () => {
  try {
    if (process.stdin.isPaused?.()) process.stdin.resume();
    
    // Clear screen properly
    process.stdout.write('\x1b[?1049h'); // Alt screen
    process.stdout.write('\x1b[2J');     // Clear
    process.stdout.write('\x1b[H');      // Home
    process.stdout.write('\x1b[?25l');   // Hide cursor
    
    await new Promise(r => setTimeout(r, 100));
    
    process.stderr.write("[DEBUG] Creating Ink root...\n");
    const { createRoot, Text, Box } = await import('./ink.js');
    const React = await import('react');
    
    const root = await createRoot({
      stdout: process.stdout,
      stdin: process.stdin,
      debug: false,
      exitOnCtrlC: false,
      patchConsole: false,
    });
    
    process.stderr.write("[DEBUG] Rendering simple box...\n");
    
    const SimpleBox = () => {
      return React.createElement(
        Box,
        { padding: 1, borderStyle: 'round' },
        React.createElement(Text, { color: 'green' }, 'Hello from TUI!'),
        React.createElement(Text, null, 'Type something below:'),
      );
    };
    
    await root.render(React.createElement(SimpleBox));
    
    process.stderr.write("[DEBUG] ✓ Box rendered\n");
    process.stderr.write("[DEBUG] Look at your screen - do you see the box?\n");
    
    process.stdin.resume();
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(true); } catch (e) {}
    }
    
    // Add basic keystroke listener
    process.stdin.on('data', (data) => {
      process.stderr.write(`[DEBUG] Keystroke: ${Buffer.from(data).toString('hex')}\n`);
    });
    
    const ka = setInterval(() => {}, 500);
    process.on('SIGINT', () => {
      clearInterval(ka);
      try { process.stdout.write('\x1b[?25h\x1b[?1049l'); } catch (e) {}
      process.exit(0);
    });
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
    process.exit(1);
  }
})();
