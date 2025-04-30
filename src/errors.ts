/**
 * A WizardQL string expression parsing error
 */
export class ParseError extends Error {
  /**
   * Construct a Parsing Error
   * @param token   The token index
   * @param message The error message
   */
  constructor (token: number, message: string) {
    const header = token === -1 ? '' : `Token #${token}: `
    super(header + message)
  }
}

/**
 * A WizardQL string expression parsing constraint error
 */
export class ConstraintError extends Error {
  /**
   * Construct a Constraint Error
   * @param token   The token index
   * @param message The error message
   */
  constructor (token: number, message: string) {
    const header = token === -1 ? '' : `Token #${token}: `
    super(header + message)
  }
}
