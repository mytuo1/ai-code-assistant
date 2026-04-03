/** Overage credit grant — Anthropic-specific, removed. */
export async function checkOverageCreditGrant(): Promise<null> { return null }

export function getCachedOverageCreditGrant(): null { return null }
export async function refreshOverageCreditGrantCache(): Promise<void> {}
export function invalidateOverageCreditGrantCache(): void {}
export function formatGrantAmount(amount: number): string { return `$${(amount/100).toFixed(2)}` }
