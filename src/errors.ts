import type { Token } from './spec'

/**
 * A WizardQL string expression parsing error
 */
export class ParseError extends Error {
  name = 'ParseError'
  /** The token errored on */
  tokenIndex: number
  /** The index in the original content this token pertains to (-1 if a string array if unknown) */
  expressionIndex: number
  /** The length of the token */
  span: number

  /**
   * Construct a Parsing Error
   * @param token   The token
   * @param index   The token index
   * @param message The error message
   */
  constructor (token: Token | undefined, index: number, message: string) {
    const header = `Token #${index === -1 ? '??' : index} (${token?.index ?? '??'} -> ${token === undefined ? '??' : token.index + token.content.length} "${token?.content ?? '???'}"): `

    super(header + message)
    this.tokenIndex = index
    this.expressionIndex = token?.index ?? -1
    this.span = token?.content.length ?? 0
  }
}

/**
 * A WizardQL string expression parsing constraint error
 */
export class ConstraintError extends Error {
  name = 'ConstraintError'
  /** The token errored on */
  tokenIndex: number
  /** The index in the original content this token pertains to (-1 if a string array if unknown) */
  expressionIndex: number
  /** The length of the token */
  span: number

  /**
   * Construct a Parsing Error
   * @param token   The token
   * @param index   The token index
   * @param message The error message
   */
  constructor (token: Token | undefined, index: number, message: string) {
    const header = `Token #${index === -1 ? '??' : index} (${token?.index ?? '??'} -> ${token === undefined ? '??' : token.index + token.content.length} "${token?.content ?? '???'}"): `

    super(header + message)
    this.tokenIndex = index
    this.expressionIndex = token?.index ?? -1
    this.span = token?.content.length ?? 0
  }
}
