export type Option<T = string> = {
  label: string
  value: T
}
export type SelectOption<T = string> = Option<T>
export type SelectInputOption<T = string> = Option<T> & {
  key?: string
  hotkey?: string
}
