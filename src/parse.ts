import { ParseError } from './errors'
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
  'NEQ': 'NOTEQUAL',
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
type Operation = (typeof OPERATION_ALIAS_DICTIONARY)[keyof typeof OPERATION_ALIAS_DICTIONARY]

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
} as const satisfies Record<Operation, 'junction' | 'comparison'>

type JunctionOperator = KeysWhereValue<typeof OPERATION_DICTIONARY, 'junction'>
type ComparisonOperator = KeysWhereValue<typeof OPERATION_DICTIONARY, 'comparison'>

/** A group of conditions joined by a junction operator */
export interface Group {
  type: 'group'
  /** The junction operator */
  operation: JunctionOperator
  /** The members of the group */
  constituents: Array<Group | Condition>
}
/** A query on a field */
export interface Condition {
  type: 'condition'
  /** The operation */
  operation: ComparisonOperator
  /** The name of the field */
  field: string
  /** The value being checked */
  value: string | number | boolean | Array<string | number>
}
export type Expression = Group | Condition
export interface AggregationValue {
  /** The value being checked */
  value: string
  /** The operator being used */
  operation: ComparisonOperator
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
const QUOTE_TOKEN_REGEX_STR = `${ESCAPE_REGEX}(?<quote>${QUOTES.map((q) => RegExp.escape(q)).join('|')})(?<quotecontent>.*?)${ESCAPE_REGEX}\\k<quote>`
const QUOTE_EDGE_REGEX = new RegExp(`^${QUOTE_TOKEN_REGEX_STR}$`)

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
  const inner = `(?:${QUOTE_TOKEN_REGEX_STR}|${pieces.join('|')})`

  // const lookasides = `(?:(?=${inner})|(?<=${inner}))`

  return new RegExp(inner, 'g')
}

const TOKEN_REGEX = createTokenRegex()

/**
 * Take a string, sanitize it, and push it to an array if it has a length
 * @param array The array to push to
 * @param item  The item to sanitize and push
 */
function pushSanitized (array: string[], item: string): void {
  const sanitized = item.trim()
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

    pushSanitized(tokens, match[0].match(QUOTE_EDGE_REGEX)
      ? expression.slice(match.index, match.index + match[0].length) // This isn't a real token and is a string; don't append its uppercase version
      : match[0])
    lastMatchEnd = match.index + match[0].length
  }
  pushSanitized(tokens, expression.slice(lastMatchEnd ?? 0))

  return tokens
}

/**
 * Parse a value as a number or a string depending on its parsability and whether its wrapped in quotes or not
 * @param token    The token
 * @param isQuoted Is the token quoted?
 * @returns        The parsed token
 */
function parseValue (token: string, isQuoted: boolean): number | string {
  const number = parseFloat(token)
  return isQuoted || isNaN(number) ? token : number
}

/**
 * Process a token to get its unquoted, escaped, and unescaped varients
 * @param token The token to process
 * @returns     An object containing the variants
 */
function processToken (token: string): {
  /** The token's quote contents, if surrounded by quotes */
  unquoted: string | undefined
  /** The token's resolved contents or quote contents, including escape backslashes */
  escaped: string
  /** The token's resolved contents, with the escape backslashes removed */
  unescaped: string
} {
  const unquoted = token.match(QUOTE_EDGE_REGEX)?.groups?.quotecontent
  const escaped = unquoted ?? token
  const unescaped = escaped.replaceAll(/(?<!\\)\\/g, '')

  return {
    unquoted,
    escaped,
    unescaped
  }
}

/**
 * Parse tokens into an object expression
 * @param                tokens  The tokens to parse into an object expression
 * @param                _offset THe token offset
 * @returns                      An expression
 * @throws  {ParseError}
 */
function _parse (tokens: string[], _offset: number): Expression | null {
  let field: Condition['field'] | undefined
  let comparisonOperation: Condition['operation'] | undefined
  let value: Condition['value'] | undefined
  let inConjunction = false

  let groupOperation: JunctionOperator | undefined
  const expressions: Expression[] = []

  function resolveCondition (token: number, noopIfFail?: boolean): void {
    let group: Expression[]
    if (inConjunction) {
      const prior = expressions.at(-1)
      if (!prior) throw new ParseError(token, 'Unexpected: Expression list empty when parser is meant to append to an AND group')
      if (prior.type !== 'group' || prior.operation !== 'AND') throw new ParseError(token, 'Unexpected: Last expression is not an AND group yet parser thinks it\'s appending to one')

      group = prior.constituents
    } else group = expressions

    if (field && comparisonOperation && value !== undefined) {
      group.push({
        type: 'condition',
        field,
        operation: comparisonOperation,
        value
      })
      inConjunction = false
    } else if (field && !comparisonOperation && value === undefined) {
      group.push({
        type: 'condition',
        field,
        operation: 'EQUAL',
        value: true
      })
      inConjunction = false
    } else if (field || comparisonOperation || value !== undefined) {
      if (noopIfFail) return
      else throw new ParseError(token, 'Failed to resolve condition; missing operand or operator')
    }

    field = undefined
    comparisonOperation = undefined
    value = undefined
  }

  for (let t = 0; t < tokens.length; ++t) {
    const token = tokens[t]!
    const {
      unquoted,
      unescaped
    } = processToken(token)

    if (token === ')') throw new ParseError(_offset + t, 'Unexpected closing parenthesis')
    if ([']', '}'].includes(token)) throw new ParseError(_offset + t, 'Unexpected closing bracket/brace')

    if (token === '(') {
      if (field || comparisonOperation || value) throw new ParseError(_offset + t, 'Tried to open a group during an operation')

      const closingIndex = tokens.indexOf(')')
      if (closingIndex === -1) throw new ParseError(_offset + t, 'Missing closing parenthesis for group')

      const subExpression = _parse(tokens.slice(t + 1, closingIndex), t + 1)
      if (subExpression) expressions.push(subExpression)

      t = closingIndex
      continue
    }

    const op = OPERATION_ALIAS_DICTIONARY[token as keyof typeof OPERATION_ALIAS_DICTIONARY] as Operation | undefined

    if (op && OPERATION_DICTIONARY[op] === 'junction') {
      resolveCondition(_offset + t, true)

      const prior = expressions.at(-1)
      if (!prior) throw new ParseError(_offset + t, 'Unexpected junction operator with no preceding expression')

      if (groupOperation && groupOperation !== op) {
        switch (groupOperation) {
          case 'AND': { // assume op = OR
            const futureSubgroup = _parse(tokens.slice(t + 1), _offset + t)
            if (futureSubgroup === null) throw new ParseError(_offset + t, 'Dangling junction operator')

            return { // End for loop here
              type: 'group',
              operation: 'OR',
              constituents: [
                {
                  type: 'group',
                  operation: 'AND',
                  constituents: expressions
                },
                futureSubgroup
              ]
            }
          }
          case 'OR': // assume op = AND
            inConjunction = true

            if (prior.type === 'group' && prior.operation === 'AND') continue

            expressions.splice(-1, 1)
            expressions.push({
              type: 'group',
              operation: 'AND',
              constituents: [
                prior
              ]
            })

            continue
        }
      }

      groupOperation = op as JunctionOperator

      continue
    }

    if (!field) {
      if (token === '!') {
        const nextToken = tokens[++t]
        if (!nextToken) throw new ParseError(_offset + t, 'Unexpected "!"')

        resolveCondition(_offset + t)

        field = processToken(nextToken).unescaped
        comparisonOperation = 'EQUAL'
        value = false

        resolveCondition(_offset + t)
      } else field = unescaped

      continue
    }

    if (!comparisonOperation || (op && OPERATION_DICTIONARY[op] === 'comparison')) {
      if (op && OPERATION_DICTIONARY[op] === 'comparison') comparisonOperation = op as ComparisonOperator
      else {
        comparisonOperation = 'EQUAL'
        value = true

        resolveCondition(_offset + t)
      }

      continue
    }

    if (!value) {
      if (token === '[' || token === '{') {
        const closingIndex = tokens.indexOf(token === '[' ? ']' : '}')
        if (closingIndex === -1) throw new ParseError(_offset + t, 'Missing closing bracket/brace for array value')

        value = []
        const arrayContents = tokens.slice(t + 1, closingIndex)

        let workingEntry = ''
        function resolveEntry (): void {
          const {
            unquoted: unquotedWorkingEntry,
            escaped: escapedWorkingEntry
          } = processToken(workingEntry)

          ;(value as Array<string | number>).push(parseValue(escapedWorkingEntry, unquotedWorkingEntry !== undefined))
          workingEntry = ''
        }

        for (let ct = 0; ct < arrayContents.length; ++ct) {
          const contentToken = arrayContents[ct]!

          if (contentToken === ',') {
            if (!workingEntry) throw new ParseError(_offset + t + ct, 'Unexpected blank entry in array')

            resolveEntry()
          } else workingEntry += contentToken
        }
        resolveEntry()

        t = closingIndex
      } else value = parseValue(unescaped, unquoted !== undefined)

      resolveCondition(_offset + t)
    }
  }

  try {
    resolveCondition(_offset + tokens.length)
  } catch {
    throw new ParseError(_offset + tokens.length, 'Reached end of expression with an incomplete condition')
  }

  if (inConjunction) throw new ParseError(_offset + tokens.length, 'Dangling junction operator')

  if (groupOperation) {
    return {
      type: 'group',
      operation: groupOperation,
      constituents: expressions
    }
  } else if (expressions.length > 1) throw new ParseError(_offset, 'Group possesses multiple conditions without disjunctive operators')
  else return expressions[0] ?? null
}

/**
 * Parse a Wizard expression into its object form
 * @param                        expression The Wizard expression
 * @returns                                 The object representation and a summary
 * @throws  {ParseError | Error}            A parsing error
 */
export function parse (expression: string): Expression | null {
  const tokens = tokenize(expression)

  return _parse(tokens, 0)
}
