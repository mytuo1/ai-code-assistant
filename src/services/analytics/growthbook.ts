/**
 * GrowthBook feature flags — stubbed.
 * All flags disabled by default. Use FEATURE_<FLAG>=1 env vars to enable.
 */

export function initializeGrowthBook(): void {}
export function checkStatsigFeatureGate_CACHED_MAY_BE_STALE(key: string): boolean {
  return !!process.env[`FEATURE_${key.toUpperCase().replace(/-/g,'_')}`]
}
export function getFeatureValue_CACHED_MAY_BE_STALE<T>(key: string, defaultVal: T): T {
  const env = process.env[`FEATURE_${key.toUpperCase().replace(/-/g,'_')}`]
  if (env === undefined) return defaultVal
  try { return JSON.parse(env) as T } catch { return env as unknown as T }
}
export function getFeatureValue_CACHED_WITH_REFRESH<T>(key: string, defaultVal: T): T {
  return getFeatureValue_CACHED_MAY_BE_STALE(key, defaultVal)
}
export function getFeatureValue_DEPRECATED<T>(key: string, defaultVal: T): T {
  return getFeatureValue_CACHED_MAY_BE_STALE(key, defaultVal)
}
export function checkGate_CACHED_OR_BLOCKING(key: string): boolean {
  return checkStatsigFeatureGate_CACHED_MAY_BE_STALE(key)
}
export function checkSecurityRestrictionGate(_key: string): boolean { return false }
export function getDynamicConfig_CACHED_MAY_BE_STALE(_key: string): Record<string, unknown> { return {} }
export function hasGrowthBookEnvOverride(_key: string): boolean { return false }
export function onGrowthBookRefresh(_cb: () => void): () => void { return () => {} }
export function refreshGrowthBookAfterAuthChange(): void {}
export function resetGrowthBook(): void {}

export function getDynamicConfig_BLOCKS_ON_INIT(_key: string): Record<string, unknown> { return {} }
export type GrowthbookExperimentEvent = { experimentId: string; variationId: string }
