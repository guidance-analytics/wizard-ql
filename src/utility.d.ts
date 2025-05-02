/* eslint-disable */
import '.'

declare global {
  type KeysWhereValue<T, V> = Exclude<{
    [K in keyof T]: T[K] extends V ? K : never
  }[keyof T], never>

  interface RegExpConstructor {
    escape (s: string): string
  }

  var RegExp: RegExpConstructor
}
