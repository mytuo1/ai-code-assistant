// Stub for react/compiler-runtime
// _c(n) creates a memoization cache of size n for the React compiler
// Without real React compiler runtime the components still work — 
// they just skip memoization (safe, minor perf difference)
export function c(size) {
  return new Array(size).fill(Symbol.for('react.memo_cache_sentinel'))
}
export default { c }
