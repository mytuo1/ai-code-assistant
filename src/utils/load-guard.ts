/**
 * Load Guard - Prevent accidental full project loads
 * Throws if code tries to load > 2MB of project
 */

let loadedBytes = 0
const MAX_LOAD = 2 * 1024 * 1024 // 2MB

export function trackLoad(filePath: string, sizeBytes: number): void {
  loadedBytes += sizeBytes

  if (loadedBytes > MAX_LOAD) {
    throw new Error(
      `Project load exceeded limit: ${Math.round(loadedBytes / 1024 / 1024)}MB > 2MB\n` +
        `Last file: ${filePath}\n` +
        `Possible full project load detected. Check for wildcard imports or globbing.`
    )
  }
}

export function resetLoadCounter(): void {
  loadedBytes = 0
}

export function getLoadedBytes(): number {
  return loadedBytes
}
