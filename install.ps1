# AI Code Assistant — Windows Install Script
# Run in PowerShell: .\install.ps1

Write-Host ""
Write-Host "AI Code Assistant — Installing dependencies" -ForegroundColor Cyan
Write-Host "============================================"
Write-Host ""

# Check for Bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Bun runtime..." -ForegroundColor Yellow
    irm bun.sh/install.ps1 | iex
}

$bunVersion = bun --version
Write-Host "Bun $bunVersion found" -ForegroundColor Green

Write-Host ""
Write-Host "Installing npm packages..."
bun install

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Copy .env.example to .env and set OPENAI_API_KEY"
Write-Host "  2. Start reporting server (optional):  cd local-reporting-server; bun server.ts"
Write-Host "  3. Start the assistant:                bun start"
Write-Host ""
