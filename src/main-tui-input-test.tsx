process.stderr.write("[DEBUG] REPL with input test\n");

(async () => {
  try {
    const { createRoot, Box, Text } = await import('./ink.js');
    const React = await import('react');
    const { useState } = React;
    const { useInput } = await import('./ink.js');
    const { launchRepl } = await import('./replLauncher.tsx');
    
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

    // INPUT TEST COMPONENT - simple component with useInput
    const InputTest = () => {
      const [text, setText] = useState('');
      
      useInput((ch, key) => {
        process.stderr.write(`[DEBUG] INPUT CAPTURED: "${ch}"\n`);
        if (ch) setText(prev => prev + ch);
        if (key.return) setText('');
        if (key.backspace) setText(prev => prev.slice(0, -1));
      });
      
      return React.createElement(
        Box,
        { flexDirection: 'column', padding: 1, borderStyle: 'round', borderColor: 'cyan' },
        React.createElement(Text, { color: 'cyan' }, 'INPUT TEST: Type here:'),
        React.createElement(Text, { color: 'yellow' }, text || '(nothing yet)'),
      );
    };

    // First test: render input test component alone
    process.stderr.write("[DEBUG] TEST 1: Rendering input test alone...\n");
    await root.render(React.createElement(InputTest));
    process.stderr.write("[DEBUG] TEST 1: Done - can you type in the cyan box?\n");
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Clear for REPL test
    process.stdout.write('\x1b[2J\x1b[H');
    
    // Now test REPL
    process.stderr.write("[DEBUG] TEST 2: Now testing REPL...\n");
    
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
        try { 
          process.stdout.write('\x1b[?25h\x1b[?1049l');
        } catch (e) {}
        process.exit(0);
      });
    };
    
    await launchRepl(root, appProps, replProps, renderAndRun);
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
    process.exit(1);
  }
})();
