export type QueryTransition = {
  from: string
  to: string
  trigger: string
}
export function applyTransition(state: unknown, transition: QueryTransition): unknown {
  return state
}
