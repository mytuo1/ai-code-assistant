process.stderr.write("[DEBUG] Console REPL with Claude integration\n");

(async () => {
  try {
    // Setup terminal
    if (process.stdin.isPaused?.()) process.stdin.resume();
    process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    // Draw header
    process.stdout.write('\x1b[1;36m');
    process.stdout.write('╔════════════════════════════════════════╗\n');
    process.stdout.write('║    AI Code Assistant - Console REPL    ║\n');
    process.stdout.write('║  (Ctrl+C to exit, Enter to submit)     ║\n');
    process.stdout.write('╚════════════════════════════════════════╝\n');
    process.stdout.write('\x1b[0m\n');
    
    let messages: Array<{role: string, content: string}> = [];
    let input = '';
    let isProcessing = false;
    
    const drawPrompt = () => {
      process.stdout.write('\x1b[1;33m> \x1b[0m');
    };
    
    const processInput = async (text: string) => {
      if (!text.trim() || isProcessing) return;
      
      isProcessing = true;
      
      // Show user message
      process.stdout.write('\x1b[1;32m');
      process.stdout.write(`You: ${text}\n`);
      process.stdout.write('\x1b[0m');
      
      messages.push({ role: 'user', content: text });
      
      // Show processing indicator
      process.stdout.write('\x1b[2;33m[Processing...]\x1b[0m\n');
      
      try {
        // Placeholder response (you can integrate Claude API here)
        const response = `Echo: ${text}`;
        
        process.stdout.write('\x1b[1;34m');
        process.stdout.write(`Assistant: ${response}\n`);
        process.stdout.write('\x1b[0m\n');
        
        messages.push({ role: 'assistant', content: response });
      } catch (err: any) {
        process.stdout.write(`\x1b[1;31mError: ${err?.message}\x1b[0m\n`);
      }
      
      isProcessing = false;
      input = '';
      drawPrompt();
    };
    
    // Input handler
    process.stdin.on('data', async (data) => {
      const key = data.toString();
      
      if (key === '\x03') { // Ctrl+C
        process.stdout.write('\x1b[?1049l\x1b[?25h');
        process.exit(0);
      }
      
      if (key === '\r' || key === '\n') {
        process.stdout.write('\n');
        await processInput(input);
      } else if (key === '\x7f') { // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\x08 \x08');
        }
      } else if (key.charCodeAt(0) >= 32) { // Printable
        input += key;
        process.stdout.write(key);
      }
    });
    
    process.stderr.write("[DEBUG] REPL ready\n");
    drawPrompt();
    
    setInterval(() => {}, 500);
    
  } catch (err: any) {
    process.stderr.write(`[ERROR] ${err?.message}\n`);
    process.exit(1);
  }
})();
