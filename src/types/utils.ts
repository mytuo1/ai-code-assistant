/**
 * Utility types
 */

export type DeepImmutable<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepImmutable<U>>
  : T extends object
  ? { readonly [K in keyof T]: DeepImmutable<T[K]> }
  : T

export type Permutations<T extends string, U extends string = T> = [T] extends [never]
  ? []
  : T extends unknown
  ? [T, ...Permutations<Exclude<U, T>>]
  : never

export type MaybePromise<T> = T | Promise<T>

export type Nullable<T> = T | null | undefined

export type AnyFunction = (...args: unknown[]) => unknown
