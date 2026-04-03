/** Grove — Anthropic internal, removed. */
export async function fetchGroveData(): Promise<null> { return null }

export type GroveDecision = 'opt_in' | 'opt_out' | 'undecided'
export function isQualifiedForGrove(): boolean { return false }
export function getGroveSettings(): null { return null }
export function getGroveNoticeConfig(): null { return null }
export async function checkGroveForNonInteractive(): Promise<void> {}
export function GroveDialog(): null { return null }
export function PrivacySettingsDialog(): null { return null }
