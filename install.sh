#!/bin/bash
# AI Code Assistant — Install Script
# Installs all dependencies for the assistant

set -e
echo ""
echo "AI Code Assistant — Installing dependencies"
echo "============================================"
echo ""

# Check for Bun
if ! command -v bun &>/dev/null; then
  echo "Installing Bun runtime..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

echo "Bun $(bun --version) found"
echo ""

# Install dependencies
echo "Installing npm packages..."
bun install

echo ""
echo "✓ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and set OPENAI_API_KEY"
echo "  2. Start reporting server (optional):  cd local-reporting-server && bun server.ts"
echo "  3. Start the assistant:                bun start"
echo ""
