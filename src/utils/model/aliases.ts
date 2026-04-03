/**
 * Model alias resolution — passthrough, any string is a literal model ID.
 */
export type ModelAlias = string
export const MODEL_ALIASES = ['sonnet', 'opus', 'haiku', 'small', 'fast'] as const
export function isModelAlias(_model: string): boolean { return false }
export function isModelFamilyAlias(_model: string): boolean { return false }
export function resolveModelAlias(model: string): string { return model }
