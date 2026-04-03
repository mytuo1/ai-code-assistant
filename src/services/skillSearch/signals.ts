export type SkillSearchSignal = {
  query: string
  results: string[]
}
export function emitSkillSearchSignal(_signal: SkillSearchSignal): void {}
