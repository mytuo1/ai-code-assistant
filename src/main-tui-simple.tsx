process.stderr.write("[DEBUG] Simple REPL test\n");

(async () => {
  try {
    const { createRoot, Box, Text } = await import('./ink.js');
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
      process.stderr.write("[DEBUG] Rendering REPL...\n");
      await r.render(element);
      process.stderr.write("[DEBUG] ✓ Rendered\n");
      
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
    process.stderr.write("[DEBUG] Ready - type something!\n");
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
    process.exit(1);
  }
})();
