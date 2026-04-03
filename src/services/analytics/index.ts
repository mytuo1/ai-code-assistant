/**
 * Analytics — local reporting only
 *
 * All events are routed to the local telemetry server (LOCAL_REPORTING_URL)
 * instead of Datadog / Anthropic 1P logging.
 * Set LOCAL_REPORTING_URL=http://localhost:4040 (or wherever your server runs).
 * Events are fire-and-forget; failures are logged and silently dropped.
 */

// Marker types kept for TypeScript compatibility with call sites
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = never
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED = never

export function stripProtoFields<V>(
  metadata: Record<string, V>,
): Record<string, V> {
  const result: Record<string, V> = {}
  for (const key in metadata) {
    if (!key.startsWith('_PROTO_')) result[key] = metadata[key]
  }
  return result
}

type EventMetadata = Record<string, boolean | number | string | undefined>

// Internal queue — holds events before the sink is attached
const eventQueue: Array<{ name: string; metadata: EventMetadata }> = []
let sinkAttached = false
let localReportingUrl: string | null = null

/** Called once at startup. After this point queued events are flushed. */
export function attachAnalyticsSink(url?: string): void {
  localReportingUrl = url ?? process.env.LOCAL_REPORTING_URL ?? null
  sinkAttached = true
  // flush queue
  for (const evt of eventQueue) {
    void sendEvent(evt.name, evt.metadata)
  }
  eventQueue.length = 0
}

/** Log an analytics event — queued until sink is attached, then sent locally */
export function logEvent(
  name: string,
  metadata: EventMetadata = {},
): void {
  if (!sinkAttached) {
    eventQueue.push({ name, metadata })
    return
  }
  void sendEvent(name, metadata)
}

async function sendEvent(
  name: string,
  metadata: EventMetadata,
): Promise<void> {
  if (!localReportingUrl) return
  try {
    await fetch(`${localReportingUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: name,
        metadata: stripProtoFields(metadata as Record<string, unknown>),
        ts: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Silently drop — local server may not be running
  }
}
export async function logEventAsync(event: string, metadata?: unknown): Promise<void> {
  logEvent(event, metadata as Record<string, unknown>)
}
