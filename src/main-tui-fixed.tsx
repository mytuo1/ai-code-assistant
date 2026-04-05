process.stderr.write("[DEBUG] REPL with cursor positioning fix\n");

(async () => {
  try {
    const { createRoot, Box, Text } = await import('./ink.js');
    const React = await import('react');
    const { launchRepl } = await import('./replLauncher.tsx');
    
    // Ensure stdin is ready
    if (process.stdin.isPaused?.()) process.stdin.resume();
    
    // CRITICAL: Clear screen and reset cursor BEFORE creating root
    process.stdout.write('\x1b[2J');      // Clear entire screen
    process.stdout.write('\x1b[H');       // Cursor to home (0,0)
    process.stdout.write('\x1b[?1049h');  // Enter alt screen
    process.stdout.write('\x1b[?25l');    // Hide cursor
    
    // Small delay to let terminal settle
    await new Promise(r => setTimeout(r, 100));
    
    const root = await createRoot({
      stdout: process.stdout,
      stdin: process.stdin,
      debug: false,
      exitOnCtrlC: false,
      patchConsole: false,
    });

    const now = new Date();
    const appProps = { getFpsMetrics: () => undefined, initialState: {} as any };
    const replProps = {
      commands: [], debug: false, initialTools: [],
      thinkingConfig: { enabled: false, budgetTokens: 10000 } as any,
      initialMessages: [{
        id: 'x', type: 'user' as const, content: 'Session started',
        createdAt: now,
      }],
      abortSignal: new AbortController().signal,
      mcpClients: [],
    } as any;
    
    const renderAndRun = async (r: any, element: any) => {
      process.stderr.write("[DEBUG] About to render REPL\n");
      await r.render(element);
      process.stderr.write("[DEBUG] ✓ REPL rendered\n");
      
      process.stdin.resume();
      if (process.stdin.isTTY) {
        try { process.stdin.setRawMode(true); } catch (e) {}
      }
      
      const ka = setInterval(() => {}, 500);
      process.on('SIGINT', () => {
        clearInterval(ka);
        try { 
          process.stdout.write('\x1b[?25h');   // Show cursor
          process.stdout.write('\x1b[?1049l'); // Exit alt screen
        } catch (e) {}
        process.exit(0);
      });
      
      process.stderr.write("[DEBUG] ✓ Ready for input\n");
    };
    
    await launchRepl(root, appProps, replProps, renderAndRun);
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
    process.exit(1);
  }
})();
