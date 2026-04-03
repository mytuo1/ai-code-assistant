// react/compiler-runtime shim
// _c(n) allocates memoization cache slots for React compiler output
export function c(size: number): unknown[] {
  return new Array(size).fill(Symbol.for('react.memo_cache_sentinel'))
}
