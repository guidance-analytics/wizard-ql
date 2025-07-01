import type { Token } from './spec'

/**
 * Construct an error header with details
 * @param startToken The starting token this error pertains to
 * @param startIndex The starting token's index
 * @param endToken   The end token this error pertains to
 * @param endIndex   The end token's index
 * @returns          The header
 */
function constructHeader (startToken: Token | undefined, startIndex: number | undefined, endToken: Token | undefined, endIndex: number | undefined): string {
  let header = 'Token #'
  header += startIndex === undefined ? '??' : startIndex
  if (endIndex !== undefined && endIndex !== startIndex) header += ' -> #' + endIndex
  if (startToken) {
    header += ' (char '

    header += startToken.index
    if (endToken && endToken !== startToken) {
      header += ' -> ' + endToken.index
    }

    header += ' "'

    header += startToken.content.replaceAll('"', '\\"')
    if (endToken && endToken !== startToken) {
      header += '" -> "' + endToken.content.replaceAll('"', '\\"')
    }

    header += '"'
    header += ')'
  }
  header += ': '

  return header
}

/**
 * A WizardQL string expression parsing error
 */
export class ParseError extends Error {
  readonly name = 'ParseError' as const
  /** The message without the header */
  readonly rawMessage: string
  /** The first token this error pertains to */
  readonly startToken: Token | undefined
  /** The last token this error pertains to */
  readonly endToken: Token | undefined
  /** The start token index */
  readonly startIndex: number | undefined
  /** The end token index */
  readonly endIndex: number | undefined

  /**
   * Construct a Parsing Error
   * @param message    The error message
   * @param startToken The first token this error pertains to
   * @param startIndex The start token index
   * @param endToken   The last token this error pertains to
   * @param endIndex   The end token index
   */
  constructor (
    message: string,
    startToken: Token | undefined,
    startIndex: number | undefined,
    endToken: Token | undefined = startToken,
    endIndex: number | undefined = startIndex
  ) {
    const header = constructHeader(startToken, startIndex, endToken, endIndex)

    super(header + message)
    this.rawMessage = message
    this.startToken = startToken
    this.endToken = endToken
    this.startIndex = startIndex
    this.endIndex = endIndex
  }
}

/**
 * A WizardQL string expression parsing constraint error
 */
export class ConstraintError extends Error {
  readonly name = 'ConstraintError' as const
  /** The message without the header */
  readonly rawMessage: string
  /** The first token this error pertains to */
  readonly startToken: Token | undefined
  /** The last token this error pertains to */
  readonly endToken: Token | undefined
  /** The start token index */
  readonly startIndex: number | undefined
  /** The end token index */
  readonly endIndex: number | undefined

  /**
   * Construct a Constraint Error
   * @param message    The error message
   * @param startToken The first token this error pertains to
   * @param startIndex The start token index
   * @param endToken   The last token this error pertains to
   * @param endIndex   The end token index
   */
  constructor (
    message: string,
    startToken: Token | undefined,
    startIndex: number | undefined,
    endToken: Token | undefined = startToken,
    endIndex: number | undefined = startIndex
  ) {
    const header = constructHeader(startToken, startIndex, endToken, endIndex)

    super(header + message)
    this.rawMessage = message
    this.startToken = startToken
    this.endToken = endToken
    this.startIndex = startIndex
    this.endIndex = endIndex
  }
}
