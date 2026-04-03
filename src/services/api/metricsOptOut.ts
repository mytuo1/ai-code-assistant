/**
 * Metrics opt-out — Anthropic endpoint removed.
 * Metrics are always disabled unless LOCAL_REPORTING_URL is set,
 * in which case they go to the local server.
 */
export async function checkMetricsEnabled(): Promise<{ enabled: boolean; hasError: boolean }> {
  return { enabled: !!process.env.LOCAL_REPORTING_URL, hasError: false }
}
export const _clearMetricsEnabledCacheForTesting = (): void => {}
