import { ALIASES } from './spec'

export const ESCAPE_REGEX = '(?<=(?<!\\\\)(?:\\\\\\\\)*)'
const QUOTES = ['\'', '"', '`']
const QUOTE_TOKEN_REGEX_STR = `${ESCAPE_REGEX}(?<quote>${QUOTES.map((q) => RegExp.escape(q)).join('|')})(?<quotecontent>.*?)${ESCAPE_REGEX}\\k<quote>`

/**
 * Create a Regex to look for quotes
 * @returns The regular expression
 */
export function createQuoteEdgeRegexString (): string {
  return `^${QUOTE_TOKEN_REGEX_STR}$`
}

/**
 * Create a Regex to find tokens
 * @returns The regular expression
 */
export function createTokenRegexString (): string {
  const pieces = ALIASES.concat(['(', ')', '[', ']', '{', '}', ',', '!']).map((alias) => {
    let isAlpha = true
    for (let c = 0; c < alias.length; ++c) {
      const char = alias.charCodeAt(c)
      if (char < 65 || char > 90) {
        isAlpha = false
        break
      }
    }

    const escaped = RegExp.escape(alias)

    return isAlpha
      ? `(?<=\\s|^)${escaped}(?=\\s|$)`
      : `(?<!(?<!\\\\)\\\\)${escaped}`
  })
  const inner = `(?:${QUOTE_TOKEN_REGEX_STR}|${pieces.join('|')})`

  // const lookasides = `(?:(?=${inner})|(?<=${inner}))`

  return inner
}
