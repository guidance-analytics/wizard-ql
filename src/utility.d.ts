/* eslint-disable */
import '.'

declare global {
  interface RegExpConstructor {
    escape (s: string): string
  }

  var RegExp: RegExpConstructor
}
