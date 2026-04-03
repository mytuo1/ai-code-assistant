/**
 * color-diff-napi stub — native addon not available on all platforms.
 * Syntax highlighting degrades gracefully: diffs still show, just without color theming.
 */
export type SyntaxTheme = Record<string, unknown>
export type ColorModuleUnavailableReason = 'env' | 'native_unavailable'
export function getColorModuleUnavailableReason(): ColorModuleUnavailableReason | null {
  return 'native_unavailable'
}
export function expectColorDiff(): null { return null }
export function expectColorFile(): null { return null }
export function getSyntaxTheme(_themeName: string): SyntaxTheme | null { return null }
