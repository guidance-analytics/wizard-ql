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
  // const header = `Token #${startIndex === -1 ? '??' : startIndex} -> #${endIndex === -1 ? '??' : endIndex} (${startToken?.index ?? '??'} -> ${endToken?.index ?? '??'} "${startToken?.content ?? '???'}" -> "${endToken?.content}"): `
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

    header += startToken.content
    if (endToken && endToken !== startToken) {
      header += '" -> "' + endToken.content
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
export class ParseError<Filled extends boolean = true> extends Error {
  readonly name = 'ParseError' as const
  /** The message without the header */
  readonly rawMessage: string
  /** The first token this error pertains to */
  readonly startToken: Filled extends true ? Token : Token | undefined
  /** The last token this error pertains to */
  readonly endToken: Filled extends true ? Token : Token | undefined
  /** The start token index */
  readonly startIndex: Filled extends true ? number : number | undefined
  /** The end token index */
  readonly endIndex: Filled extends true ? number : number | undefined

  // @ts-expect-error
  constructor (message: Filled extends true ? never : string) // eslint-disable-line jsdoc/require-jsdoc
  constructor (message: string, startToken: Filled extends true ? Token : Token | undefined, startIndex: Filled extends true ? number : number | undefined) // eslint-disable-line jsdoc/require-jsdoc
  constructor ( // eslint-disable-line jsdoc/require-jsdoc
    message: string,
    startToken: Filled extends true ? Token : Token | undefined,
    startIndex: Filled extends true ? number : number | undefined,
    endToken: Filled extends true ? Token : Token | undefined,
    endIndex: Filled extends true ? number : number | undefined
  )

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
    startToken: Filled extends true ? Token : Token | undefined,
    startIndex: Filled extends true ? number : number | undefined,
    endToken: Filled extends true ? Token : Token | undefined = startToken,
    endIndex: Filled extends true ? number : number | undefined = startIndex
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
export class ConstraintError<Filled extends boolean = true> extends Error {
  readonly name = 'ConstraintError' as const
  /** The message without the header */
  readonly rawMessage: string
  /** The first token this error pertains to */
  readonly startToken: Filled extends true ? Token : Token | undefined
  /** The last token this error pertains to */
  readonly endToken: Filled extends true ? Token : Token | undefined
  /** The start token index */
  readonly startIndex: Filled extends true ? number : number | undefined
  /** The end token index */
  readonly endIndex: Filled extends true ? number : number | undefined

  // @ts-expect-error
  constructor (message: Filled extends true ? never : string) // eslint-disable-line jsdoc/require-jsdoc
  constructor (message: string, startToken: Filled extends true ? Token : Token | undefined, startIndex: Filled extends true ? number : number | undefined) // eslint-disable-line jsdoc/require-jsdoc
  constructor ( // eslint-disable-line jsdoc/require-jsdoc
    message: string,
    startToken: Filled extends true ? Token : Token | undefined,
    startIndex: Filled extends true ? number : number | undefined,
    endToken: Filled extends true ? Token : Token | undefined,
    endIndex: Filled extends true ? number : number | undefined
  )

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
    startToken: Filled extends true ? Token : Token | undefined,
    startIndex: Filled extends true ? number : number | undefined,
    endToken: Filled extends true ? Token : Token | undefined = startToken,
    endIndex: Filled extends true ? number : number | undefined = startIndex
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
