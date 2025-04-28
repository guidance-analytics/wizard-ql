/* eslint-disable @stylistic/quote-props */
// NOTE: Longer tokens that encompass others must be first so that they are matched first in the Regex
/** All available operation aliases */
export const OPERATION_ALIAS_DICTIONARY = {
  'AND': 'AND',
  '&&': 'AND',
  '&': 'AND',
  '^': 'AND',

  'OR': 'OR',
  '||': 'OR',
  '|': 'OR',
  'V': 'OR',

  'GEQ': 'GEQ',
  '>=': 'GEQ',
  '=>': 'GEQ',

  'LEQ': 'LEQ',
  '<=': 'LEQ',
  '=<': 'LEQ',

  'NOTEQUALS': 'NOTEQUAL',
  'NOTEQUAL': 'NOTEQUAL',
  'ISNT': 'NOTEQUAL',
  '!==': 'NOTEQUAL',
  '!=': 'NOTEQUAL',

  'EQUALS': 'EQUAL',
  'EQUAL': 'EQUAL',
  'IS': 'EQUAL',
  '==': 'EQUAL',
  '=': 'EQUAL',

  'LESS': 'LESS',
  '<': 'LESS',

  'GREATER': 'GREATER',
  '>': 'GREATER',
  'MORE': 'GREATER',

  'IN': 'IN',
  ':': 'IN',
  'NOTIN': 'NOTIN',
  '!:': 'NOTIN'
} as const
/* eslint-enable @stylistic/quote-props */
type OPERATION = (typeof OPERATION_ALIAS_DICTIONARY)[keyof typeof OPERATION_ALIAS_DICTIONARY]

/** All base operations and their type */
const OPERATION_DICTIONARY = {
  AND: 'junction',
  OR: 'junction',
  EQUAL: 'comparison',
  NOTEQUAL: 'comparison',
  LESS: 'comparison',
  GREATER: 'comparison',
  GEQ: 'comparison',
  LEQ: 'comparison',
  IN: 'comparison',
  NOTIN: 'comparison'
} as const satisfies Record<OPERATION, 'junction' | 'comparison'>

type JUNCTION_OPERATOR = KeysWhereValue<typeof OPERATION_DICTIONARY, 'junction'>
type COMPARISON_OPERATOR = KeysWhereValue<typeof OPERATION_DICTIONARY, 'comparison'>

/** A group of conditions joined by a junction operator */
export interface Group {
  type: 'group'
  /** The junction operator */
  operation: JUNCTION_OPERATOR
  /** The members of the group */
  constituents: Array<Group | Condition>
}
/** A query on a field */
export interface Condition {
  type: 'condition'
  /** The operation */
  operation: COMPARISON_OPERATOR
  /** The name of the field */
  field: string
  /** The value being checked */
  value: string | string[] | number | boolean
}
export type Expression = Group | Condition
export interface AggregationValue {
  /** The value being checked */
  value: string
  /** The operator being used */
  operation: COMPARISON_OPERATOR
  /** Is this an exclusionary operator? (Ex: NOT, NOTIN) */
  exclusionary: boolean
}
export interface FieldAggregation {
  /** The field being query */
  field: string
  /** The values being checked against */
  values: AggregationValue[]
}
export interface ParsedExpression {
  /** The parsed expression */
  expression: Expression
  /** A summary of all fields being queried */
  summary: FieldAggregation
}

const ALIASES = Object.keys(OPERATION_ALIAS_DICTIONARY)
const ESCAPE_REGEX = '(?<!(?<!\\\\)\\\\)'
const QUOTES = ['\'', '"', '`']
const QUOTE_REGEX = new RegExp(`^\\s*${ESCAPE_REGEX}(?:${QUOTES.map((q) => RegExp.escape(q)).join('|')})(.+)${ESCAPE_REGEX}(?:${QUOTES.map((q) => RegExp.escape(q)).join('|')})\\s*$`)

/**
 * Create a Regex to find tokens
 * @returns The regular expression
 */
function createTokenRegex (): RegExp {
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
      ? `(?<=\\s)${escaped}(?=\\s)`
      : `(?<!(?<!\\\\)\\\\)${escaped}`
  })
  const inner = `(?:${pieces.join('|')})`

  // const lookasides = `(?:(?=${inner})|(?<=${inner}))`

  return new RegExp(inner, 'g')
}

const TOKEN_REGEX = createTokenRegex()

/**
 * Sanitize a token by removing whitespace and escapes
 * @param string The string to sanitize
 * @returns      The sanitized string
 */
function sanitize (string: string): string {
  // Remove whitespace (either by parsing whats in quotes or replacing it all)
  const trimmed = string.match(QUOTE_REGEX)?.[1] ?? string.replaceAll(/(?<!\\)\s/g, '')

  // Remove escapes
  return trimmed.replaceAll(/(?<!\\)\\/g, '')
}

/**
 * Take a string, sanitize it, and push it to an array if it has a length
 * @param array The array to push to
 * @param item  The item to sanitize and push
 */
function pushSanitized (array: string[], item: string): void {
  const sanitized = sanitize(item)
  if (sanitized) array.push(sanitized)
}

/**
 * Take a string and tokenize it for parsing
 * @param expression The expression to tokenize
 * @returns          An array of tokens
 */
export function tokenize (expression: string): string[] {
  const tokens: string[] = []
  const indices = expression.toUpperCase().matchAll(TOKEN_REGEX)

  let lastMatchEnd: number | null = null
  for (const match of indices) {
    pushSanitized(tokens, expression.slice(lastMatchEnd ?? 0, match.index))

    pushSanitized(tokens, match[0])
    lastMatchEnd = match.index + match[0].length
  }
  pushSanitized(tokens, expression.slice(lastMatchEnd ?? 0))

  return tokens
}

/**
 * Parse a Wizard expression into its object form
 * @param expression The Wizard expression
 * @returns          The object representation and a summary
 */
export function parse (expression: string): Expression {
  const tokens = tokenize(expression)
}
