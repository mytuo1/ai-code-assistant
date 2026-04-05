process.stderr.write("[DEBUG] Direct REPL render (no launchRepl)\n");

(async () => {
  try {
    const { createRoot } = await import('./ink.js');
    const React = await import('react');
    
    if (process.stdin.isPaused?.()) process.stdin.resume();
    process.stdout.write('\x1b[2J\x1b[H\x1b[?1049h\x1b[?25l');
    await new Promise(r => setTimeout(r, 100));
    
    const root = await createRoot({
      stdout: process.stdout,
      stdin: process.stdin,
      debug: false,
      exitOnCtrlC: false,
      patchConsole: false,
    });

    // Import components directly
    process.stderr.write("[DEBUG] Importing App and REPL...\n");
    const { App } = await import('./components/App.js');
    const { REPL } = await import('./screens/REPL.js');
    
    process.stderr.write("[DEBUG] Creating element...\n");
    
    const now = new Date();
    const element = React.createElement(
      App,
      { 
        getFpsMetrics: () => undefined, 
        initialState: {} as any 
      },
      React.createElement(REPL, {
        commands: [],
        debug: false,
        initialTools: [],
        thinkingConfig: { enabled: false, budgetTokens: 10000 } as any,
        initialMessages: [{
          id: 'x',
          type: 'user' as const,
          content: 'Ready',
          createdAt: now,
        }],
        abortSignal: new AbortController().signal,
        mcpClients: [],
      })
    );
    
    process.stderr.write("[DEBUG] Rendering element...\n");
    await root.render(element);
    process.stderr.write("[DEBUG] ✓ Rendered! Content should be visible\n");
    
    process.stdin.resume();
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(true); } catch (e) {}
    }
    
    const ka = setInterval(() => {}, 500);
    process.on('SIGINT', () => {
      clearInterval(ka);
      try { process.stdout.write('\x1b[?25h\x1b[?1049l'); } catch (e) {}
      process.exit(0);
    });
    
    process.stderr.write("[DEBUG] Ready - type something!\n");
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
    if (err?.stack) {
      process.stderr.write(`${String(err.stack).substring(0, 300)}\n`);
    }
    process.exit(1);
  }
})();
