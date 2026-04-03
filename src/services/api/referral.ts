/** Referral service — removed. */
export async function fetchReferralInfo(): Promise<null> { return null }

export function getCachedReferrerReward(): number | null { return null }
export function getCachedRemainingPasses(): number | null { return null }
export function checkCachedPassesEligibility(): boolean { return false }
export function getCachedOrFetchPassesEligibility(): Promise<boolean> { return Promise.resolve(false) }
export async function prefetchPassesEligibility(): Promise<void> {}
export async function fetchReferralRedemptions(): Promise<[]> { return [] }
export function formatCreditAmount(amount: number): string { return `$${(amount / 100).toFixed(2)}` }
