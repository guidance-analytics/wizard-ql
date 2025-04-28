/* eslint-disable @stylistic/quote-props */
// NOTE: Longer tokens that encompass others must be first so that they are matched first in the Regex
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

export interface Group {
  type: 'group'
  operation: JUNCTION_OPERATOR
  constituents: Array<Group | Condition>
}

export interface Condition {
  type: 'condition'
  operation: COMPARISON_OPERATOR
  field: string
  value: string | string[] | number | boolean
}

export type Expression = Group | Condition

const ALIASES = Object.keys(OPERATION_ALIAS_DICTIONARY)
function createTokenRegex (): RegExp {
  const pieces = ALIASES.concat(['(', ')', '!']).map((alias) => {
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

function sanitize (string: string): string {
  return string
    .replaceAll(/(?<!\\)\s/g, '') // Remove whitespace
    .replaceAll('\\', '') // Remove escapes
}

function pushSanitized (array: string[], item: string): void {
  const sanitized = sanitize(item)
  if (sanitized) array.push(sanitized)
}

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

export function parse (expression: string): Expression {
  const tokens = tokenize(expression)
}
