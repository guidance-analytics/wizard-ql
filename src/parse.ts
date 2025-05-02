import { createTokenRegexString, createQuoteEdgeRegexString } from './regex' with { type: 'macro' }
import {
  type CheckedConditionSpread,
  type ComparisonOperation,
  type ConvertTypeRecord,
  type Expression,
  type JunctionOperation,
  type Operation,
  type Primitive,
  type Token,
  type TypeRecord,
  type UncheckedCondition,
  type UncheckedConditionSpread,
  COMPARISON_TYPE_DICTIONARY,
  OPERATION_ALIAS_DICTIONARY,
  OPERATION_PURPOSE_DICTIONARY
} from './spec'

import { ConstraintError, ParseError } from './errors'

const TOKEN_REGEX = new RegExp(createTokenRegexString(), 'g')
export const QUOTE_EDGE_REGEX = new RegExp(createQuoteEdgeRegexString())

/**
 * Take a string, sanitize it, and push it to an array if it has a length
 * @param array The array to push to
 * @param item  The item to sanitize and push
 * @param index The index of the token in the original string
 */
function pushSanitized (array: Token[], item: string, index: number): void {
  let trimmed = item.trimEnd()
  const pretrimLength = trimmed.length
  trimmed = trimmed.trimStart()
  const lengthDiff = trimmed.length - pretrimLength

  if (trimmed) array.push({ content: trimmed, index: index - lengthDiff })
}

/**
 * Take a string and tokenize it for parsing
 * @param expression The expression to tokenize
 * @returns          An array of tokens
 */
export function tokenize (expression: string): Token[] {
  const tokens: Token[] = []
  const indices = expression.toUpperCase().matchAll(TOKEN_REGEX)

  let lastMatchEnd: number | null = null
  for (const match of indices) {
    pushSanitized(tokens, expression.slice(lastMatchEnd ?? 0, match.index), lastMatchEnd === null ? 0 : lastMatchEnd)

    pushSanitized(
      tokens,
      match[0].match(QUOTE_EDGE_REGEX)
        ? expression.slice(match.index, match.index + match[0].length) // This isn't a real token and is a string; don't append its uppercase version
        : match[0],
      match.index
    )
    lastMatchEnd = match.index + match[0].length
  }
  pushSanitized(tokens, expression.slice(lastMatchEnd ?? 0), lastMatchEnd ?? 0)

  return tokens
}

/**
 * Parse a value as a number or a string depending on its parsability and whether its wrapped in quotes or not
 * @param token    The token
 * @param isQuoted Is the token quoted?
 * @returns        The parsed token
 */
function parseValue (token: string, isQuoted: boolean): boolean | number | string {
  const number = Number(token)
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
function getClosingIndex (tokens: Token[], start: number, opening: string, closing: string): number {
  let openingCount = 1

  for (let index = start + 1; index < tokens.length; ++index) {
    switch (tokens[index]!.content) {
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

export interface ExpressionConstraints<T extends TypeRecord> {
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
 * @param                     token       The token
 * @param                     index       The token index
 * @param                     condition   The condition to validate
 * @param                     constraints The constraints to check
 * @throws  {ConstraintError}
 * @returns                               The same reference to the condition
 */
function validateCondition<T extends TypeRecord> (token: Token | undefined, index: number, condition: Omit<UncheckedCondition, 'validated'>, constraints: ExpressionConstraints<T> | undefined): UncheckedConditionSpread | CheckedConditionSpread<ConvertTypeRecord<T>> {
  let validated = false
  const restriction = constraints?.restricted?.[condition.field]

  const values = Array.isArray(condition.value) ? condition.value : [condition.value]

  // Check if this field is allowed to be queried
  if (restriction === true) throw new ConstraintError(token, index, `Field "${condition.field}" is restricted`)
  else if (Array.isArray(restriction)) {
    for (const entry of restriction) {
      if (entry instanceof RegExp) {
        if (values.some((v) => v.toString().match(entry))) throw new ConstraintError(token, index, `Value for field "${condition.field}" violates constraint "${entry.toString()}"`)
      } else {
        if (values.includes(entry)) throw new ConstraintError(token, index, `Forbidden value "${entry}" for field "${condition.field}"`)
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
  if (!operationAllowed) throw new ConstraintError(token, index, `Value "${condition.value.toString()}" not allowed for operation "${condition.operation}" which only allows for "${operationType}" type`)

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

    if (!meets) throw new ConstraintError(token, index, `Value "${condition.value.toString()}" includes a type not permitted for field "${condition.field}". Allowed types: ${types.join(', ')}`)

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
function _parse<const T extends TypeRecord> (tokens: Token[], _offset: number, constraints?: ExpressionConstraints<T>): Expression<ConvertTypeRecord<T>> | null {
  type TypedExpression = Expression<ConvertTypeRecord<T>>
  let field: string | undefined
  let comparisonOperation: ComparisonOperation | undefined
  let value: Primitive | Primitive[] | undefined
  let inConjunction = false

  let groupOperation: JunctionOperation | undefined
  const expressions: TypedExpression[] = []

  /**
   * Get the expression group to push to (local or a subgroup for inConjunction)
   * @param                token The current token
   * @param                index The current token's index
   * @warn You probably need to set inConjunction to false after using this
   * @returns                    The group to push to
   * @throws  {ParseError}
   */
  function getExpressionGroup (token: Token | undefined, index: number): TypedExpression[] {
    if (inConjunction) {
      const prior = expressions.at(-1)
      if (!prior) throw new ParseError(token, index, 'Unexpected: Expression list empty when parser is meant to append to an AND group')
      if (prior.type !== 'group' || prior.operation !== 'AND') throw new ParseError(token, index, 'Unexpected: Last expression is not an AND group yet parser thinks it\'s appending to one')

      return prior.constituents
    } return expressions
  }

  /**
   * Resolve a condition from the defined variables
   * @param               token      The current token
   * @param               index      The current token's index
   * @param               noopIfFail Don't thow if unable to synthesize the condition
   * @throws {ParseError}
   */
  function resolveCondition (token: Token | undefined, index: number, noopIfFail?: boolean): void {
    if (constraints?.caseInsensitive) field = field?.toLowerCase()

    const group = getExpressionGroup(token, index)

    if (field && comparisonOperation && value !== undefined) {
      group.push(validateCondition(token, index, {
        type: 'condition',
        field,
        operation: comparisonOperation,
        value
      }, constraints))
      inConjunction = false
    } else if (field && !comparisonOperation && value === undefined) {
      group.push(validateCondition(token, index, {
        type: 'condition',
        field,
        operation: 'EQUAL',
        value: true
      }, constraints))
      inConjunction = false
    } else if (field || comparisonOperation || value !== undefined) {
      if (noopIfFail) return
      else throw new ParseError(token, index, 'Failed to resolve condition; missing operand or operator')
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
    } = processToken(token.content)

    if (token.content === ')') throw new ParseError(token, _offset + t, 'Unexpected closing parenthesis')
    if ([']', '}'].includes(token.content)) throw new ParseError(token, _offset + t, 'Unexpected closing bracket/brace')

    if (token.content === '(') {
      if (field || comparisonOperation || value) throw new ParseError(token, _offset + t, 'Tried to open a group during an operation')

      const closingIndex = getClosingIndex(tokens, t, '(', ')')
      if (closingIndex === -1) throw new ParseError(token, _offset + t, 'Missing closing parenthesis for group')

      const subExpression = _parse(tokens.slice(t + 1, closingIndex), t + 1, constraints)
      // Simplification
      if (subExpression) {
        if (subExpression.type === 'group' && subExpression.operation === groupOperation) expressions.push(...subExpression.constituents)
        else {
          const group = getExpressionGroup(token, _offset + t)
          group.push(subExpression)
          inConjunction = false
        }
      }

      t = closingIndex
      continue
    }

    const op = OPERATION_ALIAS_DICTIONARY[token.content as keyof typeof OPERATION_ALIAS_DICTIONARY] as Operation | undefined

    if (op && OPERATION_PURPOSE_DICTIONARY[op] === 'junction') {
      resolveCondition(token, _offset + t, true)

      const prior = expressions.at(-1)
      if (!prior) throw new ParseError(token, _offset + t, 'Unexpected junction operator with no preceding expression')

      if (groupOperation && groupOperation !== op) {
        switch (groupOperation) {
          case 'AND': { // assume op = OR
            const futureSubgroup = _parse(tokens.slice(t + 1), _offset + t, constraints)
            if (futureSubgroup === null) throw new ParseError(token, _offset + t, 'Dangling junction operator')

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

    if (token.content === '!') {
      const nextToken = tokens[t + 1]

      if (nextToken?.content === '(') {
        resolveCondition(token, _offset + t)

        const closingIndex = getClosingIndex(tokens, t + 1, '(', ')')
        if (closingIndex === -1) throw new ParseError(token, _offset + t, 'Missing closing parenthesis for group')

        const futureSubExpression = _parse(tokens.slice(t + 2, closingIndex), t + 2, constraints)
        if (futureSubExpression) {
          complementExpression(futureSubExpression)

          // Simplification
          if (futureSubExpression.type === 'group' && futureSubExpression.operation === groupOperation) expressions.push(...futureSubExpression.constituents)
          else {
            const group = getExpressionGroup(token, _offset + t)
            group.push(futureSubExpression)
            inConjunction = false
          }
        }

        t = closingIndex

        continue
      }
    }

    if (!field) {
      if (token.content === '!') {
        const nextToken = tokens[++t]
        if (!nextToken) throw new ParseError(token, _offset + t - 1, 'Unexpected "!"')

        resolveCondition(nextToken, _offset + t)

        field = processToken(nextToken.content).unescaped
        comparisonOperation = 'EQUAL'
        value = false

        resolveCondition(nextToken, _offset + t)
      } else field = unescaped

      continue
    }

    if (!comparisonOperation || (op && OPERATION_PURPOSE_DICTIONARY[op] === 'comparison')) {
      if (op && OPERATION_PURPOSE_DICTIONARY[op] === 'comparison') comparisonOperation = op as ComparisonOperation
      else {
        comparisonOperation = 'EQUAL'
        value = true

        resolveCondition(token, _offset + t)
      }

      continue
    }

    if (!value) {
      if (['[', '{'].includes(token.content)) {
        const closingIndex = getClosingIndex(tokens, t, token.content, token.content === '[' ? ']' : '}')
        if (closingIndex === -1) throw new ParseError(token, _offset + t, 'Missing closing bracket/brace for array value')

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

          if (contentToken.content === ',') {
            if (!workingEntry) throw new ParseError(contentToken, _offset + t + ct, 'Unexpected blank entry in array')

            resolveEntry()
          } else workingEntry += contentToken.content
        }
        resolveEntry()

        if (!value.length) {
          const syntheticToken: Token = {
            content: tokens.slice(t, closingIndex + 1).reduce((a, t) => a + t.content, ''),
            index: token.index
          }

          throw new ParseError(syntheticToken, _offset + t, 'Empty array provided as value')
        }

        t = closingIndex
      } else value = parseValue(unescaped, unquoted !== undefined)

      resolveCondition(token, _offset + t)
    }
  }

  try {
    resolveCondition(undefined, _offset + tokens.length - 1)
  } catch (err) {
    if (err instanceof ParseError) throw new ParseError(tokens.at(-1), _offset + tokens.length - 1, `Reached end of expression with an incomplete condition (${err.message})`)
    else throw err
  }

  if (inConjunction) throw new ParseError(tokens.at(-1), _offset + tokens.length - 1, 'Dangling junction operator')

  if (groupOperation) {
    if (expressions.length === 1) throw new ParseError(tokens.at(-1), _offset + tokens.length - 1, 'Dangling junction operator')

    return {
      type: 'group',
      operation: groupOperation,
      constituents: expressions
    }
  } else if (expressions.length > 1) throw new ParseError(undefined, _offset, 'Group possesses multiple conditions without disjunctive operators')
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
export function parse<const T extends TypeRecord> (expression: string | string[] | Token[], constraints?: ExpressionConstraints<T>): Expression<ConvertTypeRecord<T>> | null {
  let tokens: Token[]

  if (Array.isArray(expression)) {
    tokens = []

    let type: 'string' | 'object' | undefined
    for (let t = 0; t < expression.length; ++t) {
      const token = expression[t]!

      if (!type) type = typeof token as 'object' | 'string'

      // eslint-disable-next-line valid-typeof
      if (typeof token !== type) console.warn('WizardQL: parse was called with a mixed array of string tokens and token objects')

      tokens.push(typeof token === 'string' ? { content: token, index: type === 'string' ? t : -1 } : token)
    }
  } else tokens = tokenize(expression)

  return _parse(tokens, 0, constraints)
}
