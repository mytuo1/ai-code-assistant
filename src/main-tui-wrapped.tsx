process.stderr.write("[DEBUG] REPL with forced visibility wrapper\n");

(async () => {
  try {
    const { createRoot, Box, Text } = await import('./ink.js');
    const React = await import('react');
    const { launchRepl } = await import('./replLauncher.tsx');
    
    if (process.stdin.isPaused?.()) process.stdin.resume();
    process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
    
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
        id: 'x', type: 'user' as const, content: 'Ready',
        createdAt: now,
      }],
      abortSignal: new AbortController().signal,
      mcpClients: [],
    } as any;
    
    const renderAndRun = async (r: any, element: any) => {
      process.stderr.write("[DEBUG] Wrapping REPL in visible border...\n");
      
      // Force a visible wrapper
      const wrapped = React.createElement(
        Box,
        { 
          flexDirection: 'column',
          borderStyle: 'round',
          borderColor: 'green',
          padding: 1,
          width: process.stdout.columns || 80,
        },
        React.createElement(Text, { color: 'green' }, '═ REPL Content Below ═'),
        element,
        React.createElement(Text, { color: 'green' }, '═ End REPL ═'),
      );
      
      process.stderr.write("[DEBUG] Rendering wrapped REPL...\n");
      await r.render(wrapped);
      process.stderr.write("[DEBUG] ✓ Wrapped REPL rendered\n");
      
      process.stdin.resume();
      if (process.stdin.isTTY) {
        try { process.stdin.setRawMode(true); } catch (e) {}
      }
      
      const ka = setInterval(() => {}, 500);
      process.on('SIGINT', () => {
        clearInterval(ka);
        try { process.stdout.write('\x1b[?1049l\x1b[?25h'); } catch (e) {}
        process.exit(0);
      });
    };
    
    await launchRepl(root, appProps, replProps, renderAndRun);
    process.stderr.write("[DEBUG] Ready!\n");
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
    process.exit(1);
  }
})();
