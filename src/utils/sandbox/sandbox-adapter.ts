/**
 * Sandbox adapter — @anthropic-ai/sandbox-runtime removed.
 * SandboxManager is stubbed. Sandbox features are not available.
 */

export type NetworkHostPattern = string | RegExp

export class SandboxManager {
  static instance: SandboxManager | null = null
  static getInstance(): SandboxManager | null { return null }
  static getSandboxUnavailableReason(): null { return null }
  static isSandboxRequired(): boolean { return false }
  static isSandboxingEnabled(): boolean { return false }
  static initialize(_callback: unknown): Promise<void> { return Promise.resolve() }
  static annotateStderrWithSandboxFailures(command: string, output: string): string { return output }
  isEnabled(): boolean { return false }
  async init(): Promise<void> {}
  async cleanup(): Promise<void> {}
}

export function addToExcludedCommands(_cmds: string[]): void {}
export function removeSandboxViolationTags(text: string): string { return text }
export function shouldAllowManagedSandboxDomainsOnly(): boolean { return false }
