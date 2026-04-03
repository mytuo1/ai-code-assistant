/**
 * Local Reporting Server
 *
 * Receives all telemetry, analytics events, metrics, session transcripts,
 * and feedback that formerly went to Anthropic/Datadog infrastructure.
 *
 * Runs on port 4040 by default (set PORT env var to change).
 * Data is stored in ./data/ as NDJSON files, one per category.
 *
 * Endpoints:
 *   POST /events        — analytics events (replaces Datadog)
 *   POST /metrics       — OpenTelemetry metrics (replaces BigQuery exporter)
 *   POST /feedback      — user feedback (replaces api.anthropic.com/api/claude_cli_feedback)
 *   POST /sessions/:id  — session transcript append
 *   GET  /sessions/:id  — fetch session transcript
 *   GET  /events        — list recent events (last 500)
 *   GET  /metrics       — list recent metrics (last 500)
 *   GET  /health        — health check
 *   GET  /dashboard     — simple HTML dashboard
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { mkdir, appendFile, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT ?? '4040', 10)
const DATA_DIR = process.env.DATA_DIR ?? join(__dirname, 'data')

// ─── helpers ────────────────────────────────────────────────────────────────

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true })
  await mkdir(join(DATA_DIR, 'sessions'), { recursive: true })
}

async function appendNDJSON(file: string, record: unknown): Promise<void> {
  await appendFile(
    join(DATA_DIR, file),
    JSON.stringify(record) + '\n',
    'utf8',
  )
}

async function readLastN(file: string, n = 500): Promise<unknown[]> {
  try {
    const content = await readFile(join(DATA_DIR, file), 'utf8')
    const lines = content.split('\n').filter(Boolean)
    return lines
      .slice(-n)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)
  } catch {
    return []
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(data, null, 2))
}

function html(res: ServerResponse, content: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(content)
}

// ─── dashboard ───────────────────────────────────────────────────────────────

function buildDashboard(
  events: unknown[],
  metrics: unknown[],
): string {
  const evtRows = (events as Array<{ ts: string; event: string; metadata?: unknown }>)
    .slice(-50)
    .reverse()
    .map(e => `<tr>
      <td style="color:#888;white-space:nowrap">${e.ts ?? ''}</td>
      <td><b>${e.event ?? ''}</b></td>
      <td><small>${JSON.stringify(e.metadata ?? {}).slice(0, 120)}</small></td>
    </tr>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <title>Local Reporting Dashboard</title>
  <meta http-equiv="refresh" content="10">
  <style>
    body { font-family: monospace; background: #111; color: #eee; padding: 20px; }
    h1 { color: #7df; margin-bottom: 4px; }
    .subtitle { color: #888; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { text-align: left; padding: 8px; background: #222; color: #7df; }
    td { padding: 6px 8px; border-bottom: 1px solid #222; vertical-align: top; }
    tr:hover td { background: #1a1a1a; }
    .stat { display: inline-block; margin: 8px 16px 8px 0; padding: 12px 20px;
            background: #1a2a3a; border-radius: 8px; }
    .stat .n { font-size: 2em; color: #7df; }
    .stat .l { color: #888; font-size: 0.85em; }
    a { color: #7df; }
  </style>
</head>
<body>
  <h1>📊 Local Reporting Server</h1>
  <div class="subtitle">Port ${PORT} · Auto-refreshes every 10s · <a href="/events">events JSON</a> · <a href="/metrics">metrics JSON</a></div>

  <div class="stat"><div class="n">${events.length}</div><div class="l">Total Events</div></div>
  <div class="stat"><div class="n">${metrics.length}</div><div class="l">Metric Batches</div></div>

  <h2>Recent Events (last 50)</h2>
  <table>
    <thead><tr><th>Timestamp</th><th>Event</th><th>Metadata</th></tr></thead>
    <tbody>${evtRows || '<tr><td colspan="3" style="color:#666">No events yet</td></tr>'}</tbody>
  </table>
</body>
</html>`
}

// ─── server ───────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const path = url.pathname

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' })
    res.end()
    return
  }

  try {
    // ── GET /health ──────────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/health') {
      return json(res, { ok: true, ts: new Date().toISOString() })
    }

    // ── GET /dashboard ───────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/dashboard') {
      const [events, metrics] = await Promise.all([
        readLastN('events.ndjson'),
        readLastN('metrics.ndjson'),
      ])
      return html(res, buildDashboard(events, metrics))
    }

    // ── GET /events ──────────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/events') {
      return json(res, await readLastN('events.ndjson'))
    }

    // ── GET /metrics ─────────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/metrics') {
      return json(res, await readLastN('metrics.ndjson'))
    }

    // ── POST /events ──────────────────────────────────────────────────────────
    if (req.method === 'POST' && path === '/events') {
      const body = await readBody(req)
      const record = JSON.parse(body)
      await appendNDJSON('events.ndjson', record)
      process.stdout.write(`[event] ${record.event ?? '?'}\n`)
      return json(res, { ok: true })
    }

    // ── POST /metrics ─────────────────────────────────────────────────────────
    if (req.method === 'POST' && path === '/metrics') {
      const body = await readBody(req)
      const record = JSON.parse(body)
      await appendNDJSON('metrics.ndjson', record)
      return json(res, { ok: true })
    }

    // ── POST /feedback ────────────────────────────────────────────────────────
    if (req.method === 'POST' && path === '/feedback') {
      const body = await readBody(req)
      const record = JSON.parse(body)
      await appendNDJSON('feedback.ndjson', { ...record, ts: new Date().toISOString() })
      process.stdout.write(`[feedback] received\n`)
      return json(res, { ok: true })
    }

    // ── GET /domain_info ─────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/domain_info') {
      // stub — real domain info would need your own implementation
      return json(res, { domain: url.searchParams.get('domain'), safe: true })
    }

    // ── POST /sessions/:id ────────────────────────────────────────────────────
    if (req.method === 'POST' && path.startsWith('/sessions/')) {
      const sessionId = path.replace('/sessions/', '').replace(/[^a-zA-Z0-9_-]/g, '')
      if (!sessionId) return json(res, { error: 'invalid session id' }, 400)
      const body = await readBody(req)
      const record = JSON.parse(body)
      await appendNDJSON(`sessions/${sessionId}.ndjson`, record)
      return json(res, { ok: true })
    }

    // ── GET /sessions/:id ─────────────────────────────────────────────────────
    if (req.method === 'GET' && path.startsWith('/sessions/')) {
      const sessionId = path.replace('/sessions/', '').replace(/[^a-zA-Z0-9_-]/g, '')
      if (!sessionId) return json(res, { error: 'invalid session id' }, 400)
      const entries = await readLastN(`sessions/${sessionId}.ndjson`, 10000)
      return json(res, entries)
    }

    return json(res, { error: 'not found' }, 404)
  } catch (err) {
    process.stderr.write(`[error] ${err}\n`)
    return json(res, { error: String(err) }, 500)
  }
})

await ensureDataDir()
server.listen(PORT, () => {
  process.stdout.write(`\n🟢  Local Reporting Server running\n`)
  process.stdout.write(`    http://localhost:${PORT}/dashboard\n`)
  process.stdout.write(`    Data dir: ${DATA_DIR}\n\n`)
})
