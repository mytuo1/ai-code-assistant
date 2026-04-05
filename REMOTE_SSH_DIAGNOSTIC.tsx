// ================================================
// REMOTE SSH DIAGNOSTIC
// ================================================
// Run this to debug SSH terminal issues
// ================================================

process.stderr.write("═══════════════════════════════════════════\n");
process.stderr.write("REMOTE TERMINAL DIAGNOSTIC\n");
process.stderr.write("═══════════════════════════════════════════\n");

(async () => {
  try {
    // 1. Check stdin status
    process.stderr.write("\n[TEST 1] stdin Status\n");
    process.stderr.write(`  isTTY: ${process.stdin.isTTY}\n`);
    process.stderr.write(`  isPaused: ${process.stdin.isPaused?.()}\n`);
    process.stderr.write(`  readable: ${process.stdin.readable}\n`);
    
    if (!process.stdin.isTTY) {
      process.stderr.write("  ❌ PROBLEM: stdin is NOT a TTY!\n");
      process.stderr.write("  This is expected for SSH connections.\n");
      process.stderr.write("  Solution: Use SSH's -t flag: ssh -t user@host 'bun start'\n");
    } else {
      process.stderr.write("  ✅ stdin is a TTY\n");
    }
    
    // 2. Check stdout status
    process.stderr.write("\n[TEST 2] stdout Status\n");
    process.stderr.write(`  isTTY: ${process.stdout.isTTY}\n`);
    process.stderr.write(`  writable: ${process.stdout.writable}\n`);
    
    if (!process.stdout.isTTY) {
      process.stderr.write("  ⚠️  WARNING: stdout is NOT a TTY\n");
    } else {
      process.stderr.write("  ✅ stdout is a TTY\n");
    }
    
    // 3. Check environment variables
    process.stderr.write("\n[TEST 3] Terminal Environment\n");
    process.stderr.write(`  TERM: ${process.env.TERM || '(not set)'}\n`);
    process.stderr.write(`  SSH_CONNECTION: ${process.env.SSH_CONNECTION ? '✅ SSH detected' : '❌ Not SSH'}\n`);
    process.stderr.write(`  SHELL: ${process.env.SHELL || '(not set)'}\n`);
    
    // 4. Try to write to alternate screen
    process.stderr.write("\n[TEST 4] Alternate Screen Buffer\n");
    process.stderr.write("  Attempting to enter alternate screen...\n");
    
    try {
      process.stdout.write('\x1b[?1049h'); // Enter alt screen
      process.stderr.write("  ✅ Alternate screen command sent\n");
      
      process.stdout.write('\x1b[2J\x1b[H'); // Clear
      process.stdout.write('TEST: If you see this text, alt screen works\n');
      process.stderr.write("  If you see 'TEST:' line on screen, alt screen works\n");
      
      await new Promise(r => setTimeout(r, 1000));
      
      process.stdout.write('\x1b[?1049l'); // Exit alt screen
      process.stderr.write("  ✅ Exited alternate screen\n");
    } catch (err: any) {
      process.stderr.write(`  ❌ Alternate screen failed: ${err?.message}\n`);
    }
    
    // 5. Try raw mode
    process.stderr.write("\n[TEST 5] Raw Mode\n");
    process.stderr.write("  Attempting setRawMode...\n");
    
    try {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stderr.write("  ✅ Raw mode enabled\n");
        process.stdin.setRawMode(false);
      } else {
        process.stderr.write("  ⚠️  Cannot set raw mode - stdin is not a TTY\n");
      }
    } catch (err: any) {
      process.stderr.write(`  ❌ Raw mode failed: ${err?.message}\n`);
    }
    
    // 6. Try Ink import
    process.stderr.write("\n[TEST 6] Ink Rendering\n");
    process.stderr.write("  Importing Ink...\n");
    
    try {
      const { createRoot, Text, Box } = await import('./ink.js');
      process.stderr.write("  ✅ Ink imported successfully\n");
      
      process.stderr.write("  Creating root...\n");
      const root = await createRoot({
        stdout: process.stdout,
        stdin: process.stdin,
        debug: false,
        exitOnCtrlC: true,
      });
      process.stderr.write("  ✅ Ink root created\n");
      
      process.stderr.write("  Rendering component...\n");
      const TestComponent = () => (
        <Box padding={1} borderStyle="round">
          <Text>If you see a box here, Ink rendering works</Text>
        </Box>
      );
      
      await root.render(TestComponent());
      process.stderr.write("  ✅ Component rendered\n");
      process.stderr.write("  (If you see a box on screen, rendering works!)\n");
      
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      process.stderr.write(`  ❌ Ink failed: ${err?.message}\n`);
      if (err?.stack) {
        process.stderr.write(`  Stack: ${String(err.stack).substring(0, 300)}\n`);
      }
    }
    
    process.stderr.write("\n═══════════════════════════════════════════\n");
    process.stderr.write("SUMMARY\n");
    process.stderr.write("═══════════════════════════════════════════\n");
    
    if (!process.stdin.isTTY) {
      process.stderr.write("\n⚠️  PRIMARY ISSUE: stdin is not a TTY\n");
      process.stderr.write("\nSOLUTION FOR SSH:\n");
      process.stderr.write("  Instead of:\n");
      process.stderr.write("    ssh user@host 'bun start'\n");
      process.stderr.write("\n  Use:\n");
      process.stderr.write("    ssh -t user@host 'bun start'\n");
      process.stderr.write("\nThe '-t' flag forces pseudo-terminal allocation.\n");
      process.stderr.write("\nIn PowerShell, you might need to do:\n");
      process.stderr.write("    ssh -t user@host bun start\n");
    }
    
    process.stderr.write("\nYou can now close this and try again with the -t flag.\n");
    
  } catch (err: any) {
    process.stderr.write(`\nFATAL ERROR: ${err?.message}\n`);
  }
  
  process.exit(0);
})();
