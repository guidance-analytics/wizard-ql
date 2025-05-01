import { ConstraintError, ParseError } from './errors'
import './polyfill/escape'

/* eslint-disable @stylistic/quote-props */
/** All available operation aliases (alias -> operation) */
export const OPERATION_ALIAS_DICTIONARY = {
// NOTE: Longer tokens that encompass others must be first so that they are matched first in the Regex
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

  'NOTIN': 'NOTIN',
  '!:': 'NOTIN',

  'IN': 'IN',
  ':': 'IN',

  'NOTMATCHES': 'NOTMATCH',
  'NOTMATCH': 'NOTMATCH',
  '!~': 'NOTMATCH',

  'MATCHES': 'MATCH',
  'MATCH': 'MATCH',
  '~': 'MATCH'
} as const
/* eslint-enable @stylistic/quote-props */

export type Operation = (typeof OPERATION_ALIAS_DICTIONARY)[keyof typeof OPERATION_ALIAS_DICTIONARY]

/** All base operations and their type */
export const OPERATION_PURPOSE_DICTIONARY = {
  AND: 'junction',
  OR: 'junction',
  EQUAL: 'comparison',
  NOTEQUAL: 'comparison',
  LESS: 'comparison',
  GREATER: 'comparison',
  GEQ: 'comparison',
  LEQ: 'comparison',
  IN: 'comparison',
  NOTIN: 'comparison',
  MATCH: 'comparison',
  NOTMATCH: 'comparison'
} as const satisfies Record<Operation, 'junction' | 'comparison'>

export type JunctionOperation = KeysWhereValue<typeof OPERATION_PURPOSE_DICTIONARY, 'junction'>
export type ComparisonOperation = KeysWhereValue<typeof OPERATION_PURPOSE_DICTIONARY, 'comparison'>

type ComparisonValueType = 'primitive' | 'boolean' | 'string' | 'number' | 'array'
/** All comparison operations and their types */
export const COMPARISON_TYPE_DICTIONARY = {
  EQUAL: 'primitive',
  NOTEQUAL: 'primitive',
  GEQ: 'number',
  GREATER: 'number',
  LEQ: 'number',
  LESS: 'number',
  IN: 'array',
  NOTIN: 'array',
  MATCH: 'string',
  NOTMATCH: 'string'
} as const satisfies Record<ComparisonOperation, ComparisonValueType>
/** Convert an operation's comparison type to a language server type */
export type ComparisonTypeToTSType<T extends keyof typeof COMPARISON_TYPE_DICTIONARY> = {
  primitive: Primitive
  boolean: boolean
  string: string
  number: number
  array: Primitive[]
}[typeof COMPARISON_TYPE_DICTIONARY[T]]

type FieldType = 'boolean' | 'string' | 'number'
type TypeRecord = Record<string, FieldType | FieldType[]>

/** Convert a field type string to a language server type */
type FieldTypeToTSType<T extends FieldType> = {
  boolean: boolean
  string: string
  number: number
}[T]
/** Primitive values that can be used in comparisons */
export type Primitive = FieldTypeToTSType<FieldType>
/** Convert input type record to language server type record */
type ConvertTypeRecord<T extends TypeRecord> = {
  [K in keyof T]: (T[K] extends FieldType[] ? FieldTypeToTSType<T[K][number]> : T[K] extends FieldType ? FieldTypeToTSType<T[K]> : Primitive) & Primitive
}

/**
 * A group of conditions joined by a junction operator
 * @template R A record mapping field names to values
 */
export interface Group<R extends Record<string, Primitive> = Record<string, Primitive>> {
  type: 'group'
  /** The junction operator */
  operation: JunctionOperation
  /** The members of the group */
  constituents: Array<Expression<R>>
}
/**
 * A query on a field, validated by type constraints
 * @template R A record mapping field names to values
 * @template F The name of the field being queried
 */
export interface Condition<R extends Record<string, Primitive>, F extends keyof R, O extends ComparisonOperation> {
  type: 'condition'
  /** The operation */
  operation: O
  /** The name of the field */
  field: F
  /** The value being checked */
  value: typeof COMPARISON_TYPE_DICTIONARY[O] extends 'array' ? Array<R[F]> : R[F] & ComparisonTypeToTSType<O>
  /** Was this condition validated by the constraints or is its type unknown? */
  validated: true
}
/**
 * A query on a field
 */
export interface UncheckedCondition<O extends ComparisonOperation = ComparisonOperation> {
  type: 'condition'
  /** The operation */
  operation: O
  /** The name of the field */
  field: string
  /** The value being checked */
  value: ComparisonTypeToTSType<O>
  /** Was this condition validated by the constraints or is its type unknown? */
  validated: false
}
/**
 * Reverse the keys and values of a type and aggregate by common value
 */
type ReverseAggregate<T extends Record<any, any>> = {
  [V in T[keyof T]]: {
    [K in keyof T]: T[K] extends V ? K : never
  }[keyof T]
}
type ReverseAggregatedTypes = ReverseAggregate<typeof COMPARISON_TYPE_DICTIONARY>
/** Create a union of conditions; an intersection of the operation type validation and constraint type validation */
type CheckedConditionSpread<R extends Record<string, Primitive>> = {
  [K in keyof R]: {
    [O in keyof ReverseAggregatedTypes]: Condition<R, K, ReverseAggregatedTypes[O]>
  }[keyof ReverseAggregatedTypes]
}[keyof R]
/** Create a union of conditions that are operation type validated */
type UncheckedConditionSpread = {
  [O in keyof ReverseAggregatedTypes]: UncheckedCondition<ReverseAggregatedTypes[O]>
}[keyof ReverseAggregatedTypes]

export type Expression<R extends Record<string, Primitive> = Record<string, Primitive>> = Group<R> | CheckedConditionSpread<R> | UncheckedConditionSpread

const ALIASES = Object.keys(OPERATION_ALIAS_DICTIONARY)
export const ESCAPE_REGEX = '(?<!(?<!\\\\)\\\\)'
const QUOTES = ['\'', '"', '`']
const QUOTE_TOKEN_REGEX_STR = `${ESCAPE_REGEX}(?<quote>${QUOTES.map((q) => RegExp.escape(q)).join('|')})(?<quotecontent>.*?)${ESCAPE_REGEX}\\k<quote>`
export const QUOTE_EDGE_REGEX = new RegExp(`^${QUOTE_TOKEN_REGEX_STR}$`)

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
      ? `(?<=\\s|^)${escaped}(?=\\s|$)`
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
function parseValue (token: string, isQuoted: boolean): boolean | number | string {
  const number = parseFloat(token)
  return isQuoted || isNaN(number) ? token === 'true' ? true : token === 'false' ? false : token : number
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
 * Get an opening closure's closing index
 * @param tokens  The token array
 * @param start   The index of the opening closure
 * @param opening The token to consider as opening
 * @param closing The token to consider as closing
 * @returns       The index of the closing token or -1 if not found
 */
function getClosingIndex (tokens: string[], start: number, opening: string, closing: string): number {
  let openingCount = 1

  for (let index = start + 1; index < tokens.length; ++index) {
    switch (tokens[index]!) {
      case opening: ++openingCount; break
      case closing: --openingCount; break
    }

    if (openingCount === 0) return index
  }

  return -1
}

/**
 * Apply De Morgan's Law to an expression and complement it
 * (Mutating operation)
 * @param expression The expression
 */
function complementExpression<R extends Record<string, Primitive>> (expression: Expression<R>): void {
  switch (expression.type) {
    case 'group':
      switch (expression.operation) {
        case 'AND': expression.operation = 'OR'; break
        case 'OR': expression.operation = 'AND'; break
      }

      expression.constituents.forEach(complementExpression)

      break
    case 'condition':
      switch (expression.operation) {
        case 'EQUAL': expression.operation = 'NOTEQUAL'; break
        case 'NOTEQUAL': expression.operation = 'EQUAL'; break
        case 'GEQ': expression.operation = 'LESS'; break
        case 'LESS': expression.operation = 'GEQ'; break
        case 'LEQ': expression.operation = 'GREATER'; break
        case 'GREATER': expression.operation = 'LEQ'; break
        case 'IN': expression.operation = 'NOTIN'; break
        case 'NOTIN': expression.operation = 'IN'; break
        case 'MATCH': expression.operation = 'NOTMATCH'; break
        case 'NOTMATCH': expression.operation = 'MATCH'; break
      }

      break
  }
}

interface ExpressionConstraints<T extends TypeRecord> {
  /**
   * Restricted fields.
   * Restrict an entire field by setting it to true.
   * Restrict a collection of values from a field by passing an array of restricted values.
   * If the field query is of array type, it will check all entries of the array.
   * @warn If 42 (the number) is prohibited, "42" the string will still be allowed
   */
  restricted?: Partial<Record<keyof T | (string & {}), boolean | Array<boolean | string | number | RegExp>>>

  /**
   * Restriction checks and type checks are case insensitive
   * @note If this is enabled, the keys in the restricted record and type record must be all lowercase
   * @note Future, if enabled, all field will be returned as lowercase
   */
  caseInsensitive?: boolean

  /**
   * The types of fields
   * Either provide the field type singularly or permit multiple types with an array of field types
   */
  types?: T
}

/**
 * Validate that a condition meets constraints
 * This operation mutates the condition to apply the validated field
 * @template T A type record, mapping field names to their types
 * @param                     token       The token index
 * @param                     condition   The condition to validate
 * @param                     constraints The constraints to check
 * @throws  {ConstraintError}
 * @returns                               The same reference to the condition
 */
function validateCondition<T extends TypeRecord> (token: number, condition: Omit<UncheckedCondition, 'validated'>, constraints: ExpressionConstraints<T> | undefined): UncheckedConditionSpread | CheckedConditionSpread<ConvertTypeRecord<T>> {
  let validated = false
  const restriction = constraints?.restricted?.[condition.field]

  const values = Array.isArray(condition.value) ? condition.value : [condition.value]

  // Check if this field is allowed to be queried
  if (restriction === true) throw new ConstraintError(token, `Field "${condition.field}" is restricted`)
  else if (Array.isArray(restriction)) {
    for (const entry of restriction) {
      if (entry instanceof RegExp) {
        if (values.some((v) => v.toString().match(entry))) throw new ConstraintError(token, `Value for field "${condition.field}" violates constraint "${entry.toString()}"`)
      } else {
        if (values.includes(entry)) throw new ConstraintError(token, `Forbidden value "${entry}" for field "${condition.field}"`)
      }
    }

    validated = true
  }

  // Check if the value matches the operation's expected type
  const operationType = COMPARISON_TYPE_DICTIONARY[condition.operation]
  let operationAllowed: boolean
  switch (operationType) {
    case 'primitive': operationAllowed = !Array.isArray(condition.value); break
    case 'string': operationAllowed = typeof condition.value === 'string'; break
    case 'number': operationAllowed = typeof condition.value === 'number'; break
    case 'array': operationAllowed = Array.isArray(condition.value); break
  }
  if (!operationAllowed) throw new ConstraintError(token, `Value "${condition.value.toString()}" not allowed for operation "${condition.operation}" which only allows for "${operationType}" type`)

  // Check if the value matches the constrained type
  const type = constraints?.types?.[condition.field]
  if (type) {
    const types = Array.isArray(type) ? type : [type]

    const meets = values.every((v) => types.some((t) => {
      switch (t) { // Don't do direct string comparison to leave possibility for custom non-JS types
        case 'boolean': return typeof v === 'boolean'
        case 'number': return typeof v === 'number'
        case 'string': return typeof v === 'string'
      }

      return false
    }))

    if (!meets) throw new ConstraintError(token, `Value "${condition.value.toString()}" includes a type not permitted for field "${condition.field}". Allowed types: ${types.join(', ')}`)

    validated = true
  }

  const edit = condition as UncheckedConditionSpread | CheckedConditionSpread<ConvertTypeRecord<T>>
  edit.validated = validated
  return edit
}

/**
 * Parse tokens into an object expression
 * @template T A type record, mapping field names to their types
 * @param                                  tokens      The tokens to parse into an object expression
 * @param                                  _offset     THe token offset
 * @param                                  constraints Constraints to add on parsing such as forced types or restricted columns
 * @returns                                            An expression
 * @throws  {ParseError | ConstraintError}
 */
function _parse<const T extends TypeRecord> (tokens: string[], _offset: number, constraints?: ExpressionConstraints<T>): Expression<ConvertTypeRecord<T>> | null {
  type TypedExpression = Expression<ConvertTypeRecord<T>>
  let field: string | undefined
  let comparisonOperation: ComparisonOperation | undefined
  let value: Primitive | Primitive[] | undefined
  let inConjunction = false

  let groupOperation: JunctionOperation | undefined
  const expressions: TypedExpression[] = []

  /**
   * Resolve a condition from the defined variables
   * @param               token      The current token position
   * @param               noopIfFail Don't thow if unable to synthesize the condition
   * @throws {ParseError}
   */
  function resolveCondition (token: number, noopIfFail?: boolean): void {
    if (constraints?.caseInsensitive) field = field?.toLowerCase()

    let group: TypedExpression[]
    if (inConjunction) {
      const prior = expressions.at(-1)
      if (!prior) throw new ParseError(token, 'Unexpected: Expression list empty when parser is meant to append to an AND group')
      if (prior.type !== 'group' || prior.operation !== 'AND') throw new ParseError(token, 'Unexpected: Last expression is not an AND group yet parser thinks it\'s appending to one')

      group = prior.constituents
    } else group = expressions

    if (field && comparisonOperation && value !== undefined) {
      group.push(validateCondition(token, {
        type: 'condition',
        field,
        operation: comparisonOperation,
        value
      }, constraints))
      inConjunction = false
    } else if (field && !comparisonOperation && value === undefined) {
      group.push(validateCondition(token, {
        type: 'condition',
        field,
        operation: 'EQUAL',
        value: true
      }, constraints))
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

      const closingIndex = getClosingIndex(tokens, t, '(', ')')
      if (closingIndex === -1) throw new ParseError(_offset + t, 'Missing closing parenthesis for group')

      const subExpression = _parse(tokens.slice(t + 1, closingIndex), t + 1, constraints)
      // Simplification
      if (subExpression) {
        if (subExpression.type === 'group' && subExpression.operation === groupOperation) expressions.push(...subExpression.constituents)
        else expressions.push(subExpression)
      }

      t = closingIndex
      continue
    }

    const op = OPERATION_ALIAS_DICTIONARY[token as keyof typeof OPERATION_ALIAS_DICTIONARY] as Operation | undefined

    if (op && OPERATION_PURPOSE_DICTIONARY[op] === 'junction') {
      resolveCondition(_offset + t, true)

      const prior = expressions.at(-1)
      if (!prior) throw new ParseError(_offset + t, 'Unexpected junction operator with no preceding expression')

      if (groupOperation && groupOperation !== op) {
        switch (groupOperation) {
          case 'AND': { // assume op = OR
            const futureSubgroup = _parse(tokens.slice(t + 1), _offset + t, constraints)
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

      groupOperation = op as JunctionOperation
      // Simplification
      if (expressions.length === 1 && expressions[0]?.type === 'group' && expressions[0].operation === groupOperation) {
        const exp = expressions[0]
        expressions.splice(0, 1)

        expressions.push(...exp.constituents)
      }

      continue
    }

    if (token === '!') {
      const nextToken = tokens[t + 1]

      if (nextToken === '(') {
        resolveCondition(_offset + t)

        const closingIndex = getClosingIndex(tokens, t + 1, '(', ')')
        if (closingIndex === -1) throw new ParseError(_offset + t, 'Missing closing parenthesis for group')

        const futureSubExpression = _parse(tokens.slice(t + 2, closingIndex), t + 2, constraints)
        if (futureSubExpression) {
          complementExpression(futureSubExpression)

          // Simplification
          if (futureSubExpression.type === 'group' && futureSubExpression.operation === groupOperation) expressions.push(...futureSubExpression.constituents)
          else expressions.push(futureSubExpression)
        }

        t = closingIndex

        continue
      }
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

    if (!comparisonOperation || (op && OPERATION_PURPOSE_DICTIONARY[op] === 'comparison')) {
      if (op && OPERATION_PURPOSE_DICTIONARY[op] === 'comparison') comparisonOperation = op as ComparisonOperation
      else {
        comparisonOperation = 'EQUAL'
        value = true

        resolveCondition(_offset + t)
      }

      continue
    }

    if (!value) {
      if (['[', '{'].includes(token)) {
        const closingIndex = getClosingIndex(tokens, t, token, token === '[' ? ']' : '}')
        if (closingIndex === -1) throw new ParseError(_offset + t, 'Missing closing bracket/brace for array value')

        value = []
        const arrayContents = tokens.slice(t + 1, closingIndex)

        let workingEntry = ''
        function resolveEntry (): void {
          const {
            unquoted: unquotedWorkingEntry,
            unescaped: unescapedWorkingEntry
          } = processToken(workingEntry)

          if (workingEntry) {
            (value as Primitive[]).push(parseValue(unescapedWorkingEntry, unquotedWorkingEntry !== undefined))
            workingEntry = ''
          }
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

        if (!value.length) throw new ParseError(_offset + t, 'Empty array provided as value')
      } else value = parseValue(unescaped, unquoted !== undefined)

      resolveCondition(_offset + t)
    }
  }

  try {
    resolveCondition(_offset + tokens.length - 1)
  } catch (err) {
    if (err instanceof ParseError) throw new ParseError(_offset + tokens.length - 1, 'Reached end of expression with an incomplete condition')
    else throw err
  }

  if (inConjunction) throw new ParseError(_offset + tokens.length - 1, 'Dangling junction operator')

  if (groupOperation) {
    if (expressions.length === 1) throw new ParseError(_offset + tokens.length - 1, 'Dangling junction operator')

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
 * @template T A type record, mapping field names to their types
 * @param                                  expression  The Wizard expression as a string or as an array of tokens
 * @param                                  constraints Constraints to add on parsing such as forced types or restricted columns
 * @returns                                            The object representation
 * @throws  {ParseError | ConstraintError}
 */
export function parse<const T extends TypeRecord> (expression: string | string[], constraints?: ExpressionConstraints<T>): Expression<ConvertTypeRecord<T>> | null {
  const tokens = Array.isArray(expression) ? expression : tokenize(expression)

  return _parse(tokens, 0, constraints)
}
