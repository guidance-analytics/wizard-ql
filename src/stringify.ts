import { ESCAPE_REGEX } from './regex'
import type { Expression, JunctionOperation, Operation, Primitive } from './spec'

export interface StringifyOptions {
  /**
   * The notation to use for junction operations
   * @example Programmatic: foo & bar
   * @example Linguistic: foo AND bar
   * @example Formal: foo ^ bar
   * @default 'programmatic'
   */
  junctionNotation?: 'programmatic' | 'linguistic' | 'formal'
  /**
   * The notation to use for comparison expressions
   * @example Programmatic: foo = bar
   * @example Linguistic: foo EQUALS bar
   * @default 'programmatic'
   */
  comparisonNotation?: 'programmatic' | 'linguistic'
  /**
   * Always surround a group with parentheses, even if unnecessary
   * @default false
   */
  alwaysParenthesize?: boolean
  /**
   * Don't include spaces (Spaces will be included around operators that are "linguistic")
   * @default false
   */
  compact?: boolean
  /**
   * Condense boolean values to their implicit denotations
   * @example 'field'
   * @example '!field'
   * @default false
   */
  condenseBooleans?: boolean
}

const formats = {
  programmatic: {
    AND: '&',
    OR: '|',
    EQUAL: '=',
    NOTEQUAL: '!=',
    GEQ: '>=',
    GREATER: '>',
    LEQ: '<=',
    LESS: '<',
    IN: ':',
    NOTIN: '!:',
    MATCH: '~',
    NOTMATCH: '!~'
  } satisfies Record<Operation, string>,
  linguistic: {
    AND: 'AND',
    OR: 'OR',
    EQUAL: 'EQUALS',
    NOTEQUAL: 'NOTEQUALS',
    GEQ: 'GEQ',
    GREATER: 'GREATER',
    LEQ: 'LEQ',
    LESS: 'LESS',
    IN: 'IN',
    NOTIN: 'NOTIN',
    MATCH: 'MATCHES',
    NOTMATCH: 'NOTMATCHES'
  } satisfies Record<Operation, string>,
  formal: {
    AND: '^',
    OR: 'V'
  } satisfies Record<JunctionOperation, string>
}

/**
 * Add quotes to a string value if it resembles another primitive
 * @param value The value
 * @returns     The value, possibly quoted
 */
function addQuotesIfNecessary (value: Primitive): Primitive {
  if (typeof value !== 'string') return value

  const number = Number(value)
  return isNaN(number) && !value.match(`${ESCAPE_REGEX}[[\\]()]`)
    ? value === 'true'
      ? '"true"'
      : value === 'false'
        ? '"false"'
        : value.replaceAll('"', '\\"')
    : `"${value.replaceAll('"', '\\"')}"`
}

/**
 * Convert a parsed WizardQL expression to a string
 * @param expression The expression
 * @param opts       Formatting options
 * @returns          The formatted string
 */
export function stringify (
  expression: Expression,
  opts: StringifyOptions = {}
): string {
  const {
    junctionNotation = 'programmatic',
    comparisonNotation = 'programmatic',
    alwaysParenthesize = false,
    compact = false,
    condenseBooleans = false
  } = opts

  let string = ''
  switch (expression.type) {
    case 'group':
      for (const constituent of expression.constituents) {
        if (string.length) {
          if (!compact || junctionNotation === 'linguistic') string += ' '
          string += formats[junctionNotation][expression.operation]
          if ((!compact || junctionNotation === 'linguistic')) string += ' '
        }

        if ((alwaysParenthesize && constituent.type === 'group') || (expression.operation === 'AND' && constituent.operation === 'OR')) string += '('
        string += stringify(constituent, opts)
        if ((alwaysParenthesize && constituent.type === 'group') || (expression.operation === 'AND' && constituent.operation === 'OR')) string += ')'
      }

      break
    case 'condition':
      if (condenseBooleans && ['EQUAL', 'NOTEQUAL'].includes(expression.operation) && typeof expression.value === 'boolean') {
        const negative = (expression.operation === 'EQUAL' && !expression.value) || (expression.operation === 'NOTEQUAL' && expression.value)

        string += `${negative ? '!' : ''}${expression.field}`
      } else {
        string += expression.field
        if (!compact || comparisonNotation === 'linguistic') string += ' '
        string += formats[comparisonNotation][expression.operation]
        if (!compact || comparisonNotation === 'linguistic') string += ' '
        if (Array.isArray(expression.value)) {
          const join = expression.value.map(addQuotesIfNecessary).join(compact ? ',' : ', ')

          string += `[${join}]`
        } else string += addQuotesIfNecessary(expression.value).toString()
      }

      break
  }

  return string
}
