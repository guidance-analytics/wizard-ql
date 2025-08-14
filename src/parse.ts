import { createTokenRegexString, createQuoteRegexString } from './regex' with { type: 'macro' } // eslint-disable-line import-x/no-duplicates
import { ESCAPE_REGEX } from './regex' // eslint-disable-line import-x/no-duplicates
import {
  type ComparisonOperation,
  type ConvertTypeRecord,
  type Expression,
  type FieldType,
  type Group,
  type JunctionOperation,
  type Operation,
  type Primitive,
  type Token,
  type TypeRecord,
  type UncheckedCondition,
  BRACKETS,
  PARENS,
  COMPARISON_TYPE_DICTIONARY,
  OPERATION_ALIAS_DICTIONARY,
  OPERATION_PURPOSE_DICTIONARY,
  TYPE_PRIORITY,
  NEGATORS,
  ARRAY_DELIMITERS
} from './spec'

import { ConstraintError, ParseError } from './errors'

export const TOKEN_REGEX = new RegExp(createTokenRegexString(), 'g')
export const QUOTE_REGEX = new RegExp(createQuoteRegexString())
export const QUOTE_EDGE_REGEX = new RegExp(`^${createQuoteRegexString()}$`)

interface Context {
  startToken: Token | undefined
  startIndex: number | undefined
  endToken?: Token | undefined
  endIndex?: number | undefined
}

/**
 * Take a string, sanitize it, and push it to an array if it has a length
 * @param array The array to push to
 * @param item  The item to sanitize and push
 * @param index The index of the token in the original string
 * @returns     The token, if pushed
 */
function pushSanitized (array: Token[], item: string, index: number): Token | undefined {
  let trimmed = item.trimEnd()
  const pretrimLength = trimmed.length
  trimmed = trimmed.trimStart()
  const lengthDiff = trimmed.length - pretrimLength

  if (trimmed) {
    const token = { content: trimmed, index: index - lengthDiff }
    array.push(token)
    return token
  }
}

/**
 * Take a string and tokenize it for parsing with a specific pattern
 * @param expression The expression to tokenize
 * @param pattern    The tokenization pattern
 * @returns          An array of tokens
 */
function _tokenize (expression: string, pattern: RegExp): Token[] {
  const tokens: Token[] = []
  const matches = expression.toUpperCase().matchAll(pattern)

  let lastMatchEnd: number | null = null
  for (const match of matches) {
    pushSanitized(tokens, expression.slice(lastMatchEnd ?? 0, match.index), lastMatchEnd === null ? 0 : lastMatchEnd)

    if (BRACKETS.some(([o]) => match[0] === o)) {
      const startToken = {
        content: match[0],
        index: match.index
      }
      tokens.push(startToken)

      let subopenings = 0
      let endToken: Token | undefined
      for (const submatch of matches) {
        if (
          (match[0] === submatch[0]) ||
          (match[0] === submatch[0])
        ) ++subopenings

        if (
          BRACKETS.some(([o, c]) => match[0] === o && submatch[0] === c)
        ) {
          if (subopenings) --subopenings
          else {
            endToken = {
              content: submatch[0],
              index: submatch.index
            }

            break
          }
        }
      }

      const subtokens = endToken
        ? _tokenize(expression.slice(startToken.index + startToken.content.length, endToken.index), new RegExp(`${createQuoteRegexString()}|${ESCAPE_REGEX},`, 'g'))
        : _tokenize(expression.slice(startToken.index + startToken.content.length), TOKEN_REGEX)

      for (const subtoken of subtokens) subtoken.index += match.index + 1
      tokens.push(...subtokens)
      if (endToken) {
        tokens.push(endToken)
        lastMatchEnd = endToken.index + endToken.content.length
      } else {
        // Assume we reached the end of the matches in the subiteration
        lastMatchEnd = expression.length
        break
      }

      continue
    } else {
      pushSanitized(
        tokens,
        match.groups?.quotecontent !== undefined
          ? expression.slice(match.index, match.index + match[0].length) // This isn't a real token and is a string; don't append its uppercase version
          : match[0],
        match.index
      )
    }

    lastMatchEnd = match.index + match[0].length
  }
  pushSanitized(tokens, expression.slice(lastMatchEnd ?? 0), lastMatchEnd ?? 0)

  return tokens
}

/**
 * Take a string and tokenize it for parsing
 * @param expression The expression to tokenize
 * @returns          An array of tokens
 */
export function tokenize (expression: string): Token[] {
  return _tokenize(expression, TOKEN_REGEX)
}

/**
 * Process a token to get its unquoted, escaped, and unescaped varients\
 * Order: unquote -> escaped -> unescaped
 * @param token The token to process
 * @returns     An object containing the variants
 */
function processToken (token: string): {
  /** The raw token */
  raw: string
  /** The token's quote contents, if surrounded by quotes */
  unquoted: string | undefined
  /** The token's resolved contents or quote contents, including escape backslashes */
  escaped: string
  /** The token's resolved contents, with the escape backslashes removed */
  unescaped: string
} {
  const unquoted = token.match(QUOTE_EDGE_REGEX)?.groups?.quotecontent
  const escaped = unquoted ?? token
  const unescaped = escaped.replaceAll(new RegExp(`(?<!${ESCAPE_REGEX}\\\\)\\\\`, 'g'), '')

  return {
    raw: token,
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
 * Apply De Morgan's Law to an expression and complement it\
 * (Mutating operation)
 * @param expression The expression
 */
function complementExpression<R extends Record<string, unknown>> (expression: Expression<R>): void {
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

export interface ExpressionConstraints<T extends TypeRecord, V extends boolean> {
  /**
   * Restricted fields.\
   * Restrict an entire field by setting it to true.\
   * Restrict an exact value by providing a string.\
   * Restrict a pattern by providing a Regex expression.\
   * By default allow any value and restrict a collection of values by passing ['deny', VALUES[]]\
   * By default restrict any value and allow a collection of values by passing ['allow', VALUES[]]\
   * If the query value is of array type, it will check all entries of the array and ensure they're all allowed.\
   * This check runs before type coercion so the value checked will always be a string. However, quotes and escapes WILL be removed
   */
  restricted?: Partial<Record<keyof T | (string & {}), boolean | ['allow' | 'deny', Array<string | RegExp>]>>

  /**
   * The types of fields\
   * Either provide the field type singularly or permit multiple types with an array of field types\
   * A field with type 'date' will parse the value into a Date object if possible (Wizard will not attempt to do this otherwise)\
   * Type coercion priority: boolean -> date -> number -> string
   */
  types?: T

  /**
   * Field names in restriction checks and type checks are case insensitive
   * @note If enabled, all fields will be returned as their casing denoted by the types or restricted record
   * @warn Mismatching casing between the restricted record and the type record will prioritize the restricted record
   */
  caseInsensitive?: boolean

  /**
   * Disallow fields that are not present in the "restricted" record or the "types" record
   */
  disallowUnvalidated?: V

  /**
   * A callback that determines how dates are interpreted\
   * By default, uses `new Date()`
   */
  dateInterpreter?: (v: string | number) => Date
}

/**
 * Coerce a string into the appropriate type for the operation based on the field type and operator
 * @param           processedToken  The value to coerce (already processed)
 * @param           fieldTypes      The supported field types
 * @param           operatorTypes   The supported operator types
 * @param           dateInterpreter The date interpreter function
 * @returns                         The coerced type
 * @throws  {Error}                 Message is 'operator' if the operator type cannot be coerced and 'field' if the field type cannot be coerced
 */
function coerceType (processedToken: ReturnType<typeof processToken>, fieldTypes: FieldType[], operatorTypes: FieldType[], dateInterpreter: (v: string | number) => Date): Primitive {
  const { raw, unescaped } = processedToken

  let operatorHits = 0
  let fieldHits = 0
  for (const type of TYPE_PRIORITY) {
    const operatorHit = operatorTypes.includes(type)
    const fieldHit = fieldTypes.includes(type)
    if (operatorHit) ++operatorHits
    if (fieldHit) ++fieldHits
    if (!operatorHit || !fieldHit) continue

    switch (type) {
      case 'boolean':
        if (raw === 'true') return true
        else if (raw === 'false') return false

        break
      case 'number': {
        const num = Number(raw)
        if (isNaN(num)) break

        return num
      }
      case 'string': return unescaped
      case 'date': {
        const num = Number(raw)
        const date = dateInterpreter(isNaN(num) ? unescaped : num)
        if (isNaN(+date)) break

        return date
      }
    }

    if (operatorTypes.includes(type)) --operatorHits
    if (fieldTypes.includes(type)) --fieldHits
  }

  if (!operatorHits) throw new Error('operator')
  if (!fieldHits) throw new Error('field')
  throw new Error('operator')
}

/**
 * Validate that a condition meets constraints
 * @warn This operation mutates the condition to apply the validated field and perform type coercion
 * @template T A type record, mapping field names to their types
 * @param                     condition       The condition to validate
 * @param                     constraints     The constraints to check
 * @param                     valueIsImplicit Was this value implicitly inferred? If so, don't attempt stringification
 * @param                     ctx             Error Context
 * @throws  {ConstraintError}
 * @returns                                   The same reference to the condition
 */
function validateCondition<const T extends TypeRecord, const V extends boolean> (condition: Omit<UncheckedCondition, 'validated' | 'value'> & { value: string | string[] }, constraints: ExpressionConstraints<T, V> | undefined, valueIsImplicit?: boolean, ctx?: Context): Exclude<Expression<ConvertTypeRecord<T>, V>, Group<ConvertTypeRecord<T>, V>> {
  let validated = false
  condition.field = processToken(condition.field).unescaped
  const field = constraints?.caseInsensitive
    ? [...Object.keys(constraints.types ?? {}), ...Object.keys(constraints.restricted ?? {})].find((k) => k.toLowerCase() === condition.field.toLowerCase()) ?? condition.field
    : condition.field
  const restriction = constraints?.restricted?.[field]
  const type = constraints?.types?.[field]

  if (constraints?.disallowUnvalidated && restriction === undefined && type === undefined) throw new ConstraintError(`Unknown field "${condition.field}"`, ctx?.startToken, ctx?.startIndex, ctx?.endToken, ctx?.endIndex)

  const operationType = COMPARISON_TYPE_DICTIONARY[condition.operation]
  const types = type && (Array.isArray(type) ? type : [type])

  const processedValues = (Array.isArray(condition.value) ? condition.value : [condition.value]).map((v) => processToken(v))

  // Check if this field is allowed to be queried
  if (restriction === true) throw new ConstraintError(`Field "${condition.field}" is restricted`, ctx?.startToken, ctx?.startIndex, ctx?.endToken, ctx?.endIndex)
  else if (Array.isArray(restriction)) {
    const [philosophy, checks] = restriction

    if (philosophy === 'deny') {
      for (const check of checks) {
        if (check instanceof RegExp) {
          if (processedValues.some(({ unescaped }) => check.test(unescaped))) {
            throw new ConstraintError(
              `Value for field "${condition.field}" violates prohibitive pattern constraint "${check.toString()}". Prohibited values/patterns: Allowed values/patterns: ${checks.join(', ')}`,
              ctx?.startToken,
              ctx?.startIndex,
              ctx?.endToken,
              ctx?.endIndex
            )
          }
        } else {
          if (processedValues.some(({ unescaped }) => unescaped === check)) {
            throw new ConstraintError(
              `Forbidden value "${check}" for field "${condition.field}". Prohibited values/patterns: ${checks.join(', ')}`,
              ctx?.startToken,
              ctx?.startIndex,
              ctx?.endToken,
              ctx?.endIndex
            )
          }
        }
      }
    } else {
      for (const { unescaped } of processedValues) {
        if (!checks.some((c) => c instanceof RegExp ? c.test(unescaped) : c === unescaped)) {
          throw new ConstraintError(
            `Value for field "${condition.field}" does not meet any allowed value/pattern. Allowed values/patterns: ${checks.join(', ')}`,
            ctx?.startToken,
            ctx?.startIndex,
            ctx?.endToken,
            ctx?.endIndex
          )
        }
      }
    }

    validated = true
  }

  if (operationType === 'array' && !Array.isArray(condition.value)) throw new ConstraintError(`Value "${condition.value.toString()}" is not permitted for "${condition.operation}" which expects an array`, ctx?.startToken, ctx?.startIndex, ctx?.endToken, ctx?.endIndex)
  else if (operationType !== 'array' && Array.isArray(condition.value)) throw new ConstraintError(`Value "${condition.value.toString()}" is not permitted for "${condition.operation}" which expects a non-array value`, ctx?.startToken, ctx?.startIndex, ctx?.endToken, ctx?.endIndex)

  const dateInterpreter = constraints?.dateInterpreter ?? ((v: string | number) => new Date(v))

  // Employ type coercion and see if the type works
  // Mutate
  for (let i = 0; i < processedValues.length; ++i) {
    const v = processedValues[i]!

    let opTypes: FieldType[]
    if (valueIsImplicit) opTypes = ['boolean']
    else {
      switch (operationType) {
        case 'primitive':
        case 'array':
          opTypes = ['boolean', 'number', 'string']
          if (types?.includes('date')) opTypes.push('date')
          break
        case 'numeric':
          opTypes = ['number']
          if (types?.includes('date')) opTypes.push('date')
          break
        case 'string': opTypes = ['string']; break
      }
    }

    try {
      const value = coerceType(v, types ?? opTypes, opTypes, dateInterpreter)
      if (Array.isArray(condition.value)) (condition.value[i] as Primitive) = value
      else (condition.value as Primitive) = value
    } catch (err) {
      switch ((err as Error).message) {
        case 'operator': throw new ConstraintError(`Value "${condition.value.toString()}" not allowed for operation "${condition.operation}" which only allows for "${operationType}" type`, ctx?.startToken, ctx?.startIndex, ctx?.endToken, ctx?.endIndex)
        case 'field': throw new ConstraintError(`Value "${condition.value.toString()}" includes a type not permitted for field "${condition.field}". Allowed types: ${(types ?? opTypes).join(', ')}`, ctx?.startToken, ctx?.startIndex, ctx?.endToken, ctx?.endIndex)
      }
    }
  }
  if (types) validated = true

  // Mutate
  const edit = condition as ReturnType<typeof validateCondition<T, V>>
  edit.field = field
  edit.validated = validated
  return edit
}

/**
 * Parse tokens into an object expression
 * @template T A type record, mapping field names to their types
 * @param                                  tokens      The tokens to parse into an object expression
 * @param                                  _offset     The token offset
 * @param                                  constraints Constraints to add on parsing such as forced types or restricted columns
 * @returns                                            An expression
 * @throws  {ParseError | ConstraintError}
 */
function _parse<const T extends TypeRecord, const V extends boolean> (tokens: Token[], _offset: number, constraints?: ExpressionConstraints<T, V>): Expression<ConvertTypeRecord<T>, V> | null {
  type TypedExpression = Expression<ConvertTypeRecord<T>, V>
  let field: {
    content: string
    token: Token
    index: number
  } | undefined
  let comparisonOperation: {
    content: ComparisonOperation
    token?: Token
    index?: number
  } | undefined
  let value: {
    content: string | string[]
    token?: Token
    index?: number
    implicit?: boolean
  } | undefined
  let inConjunction = false

  let groupOperation: JunctionOperation | undefined
  let expectingExpression = true
  const expressions: TypedExpression[] = []

  /**
   * Get the expression group to push to (local or a subgroup for inConjunction)
   * @warn You probably need to set inConjunction to false after using this
   * @param                       ctx Error context
   * @returns                         The group to push to
   * @throws  {ParseError<false>}
   */
  function getExpressionGroup (ctx?: Context): TypedExpression[] {
    if (inConjunction) {
      const prior = expressions.at(-1)
      if (!prior) throw new ParseError('Unexpected: Expression list empty when parser is meant to append to an AND group', ctx?.startToken, ctx?.startIndex, ctx?.endToken, ctx?.endIndex)
      if (prior.type !== 'group' || prior.operation !== 'AND') throw new ParseError('Unexpected: Last expression is not an AND group yet parser thinks it\'s appending to one', ctx?.startToken, ctx?.startIndex, ctx?.endToken, ctx?.endIndex)

      return prior.constituents
    } return expressions
  }

  /**
   * Resolve a condition from the defined variables
   * @throws {ParseError<false> | ConstraintError}
   */
  function resolveCondition (ctx?: Context): void {
    const baseCtx = {
      startToken: field?.token ?? comparisonOperation?.token ?? value?.token,
      startIndex: field?.index ?? comparisonOperation?.index ?? value?.index,
      endToken: value?.token ?? comparisonOperation?.token ?? field?.token,
      endIndex: value?.index ?? comparisonOperation?.index ?? field?.index
    }
    if (!ctx) ctx = baseCtx

    const group = getExpressionGroup(ctx)

    if (field && comparisonOperation && value) {
      if (!expectingExpression) throw new ParseError('Unexpected expression resolution before junctive operator', ctx.startToken, ctx.startIndex, ctx.endToken, ctx.endIndex)

      group.push(validateCondition({
        type: 'condition',
        field: field.content,
        operation: comparisonOperation.content,
        value: value.content
      }, constraints, value.implicit, baseCtx))
      inConjunction = false
      expectingExpression = false
    } else if (field && !comparisonOperation && !value) {
      if (!expectingExpression) throw new ParseError('Unexpected expression resolution before junctive operator', ctx.startToken, ctx.startIndex, ctx.endToken, ctx.endIndex)

      group.push(validateCondition({
        type: 'condition',
        field: field.content,
        operation: 'EQUAL',
        value: 'true'
      }, constraints, true, baseCtx))
      inConjunction = false
      expectingExpression = false
    } else if (field || comparisonOperation || value !== undefined) throw new ParseError('Failed to resolve condition; missing operand or operator', ctx.startToken, ctx.startIndex, ctx.endToken, ctx.endIndex)

    field = undefined
    comparisonOperation = undefined
    value = undefined
  }

  for (let t = 0; t < tokens.length; ++t) {
    const token = tokens[t]!

    if (PARENS.some(([, c]) => token.content === c)) throw new ParseError('Unexpected closing parenthesis', token, _offset + t)
    if (BRACKETS.some(([, c]) => token.content === c)) throw new ParseError('Unexpected closing bracket/brace', token, _offset + t)

    const paren = PARENS.find(([o]) => token.content === o)
    if (paren) {
      if (field || comparisonOperation || value) throw new ParseError('Tried to open a group during an operation', token, _offset + t)

      const closingIndex = getClosingIndex(tokens, t, paren[0], paren[1])
      if (closingIndex === -1) throw new ParseError('Missing closing parenthesis for group', token, _offset + t)
      ++t

      const subExpression = _parse(tokens.slice(t, closingIndex), _offset + t, constraints)
      // Simplification
      if (subExpression) {
        if (subExpression.type === 'group' && subExpression.operation === groupOperation) expressions.push(...subExpression.constituents)
        else {
          const group = getExpressionGroup({ startToken: token, startIndex: _offset + t })
          group.push(subExpression)
          inConjunction = false
        }
      }

      t = closingIndex
      continue
    }

    const op = OPERATION_ALIAS_DICTIONARY[token.content as keyof typeof OPERATION_ALIAS_DICTIONARY] as Operation | undefined

    if (op && OPERATION_PURPOSE_DICTIONARY[op] === 'junction') {
      resolveCondition({
        startToken: field?.token ?? token,
        startIndex: field?.index ?? _offset + t,
        endToken: token,
        endIndex: _offset + t
      })

      const prior = expressions.at(-1)
      if (!prior) throw new ParseError('Unexpected junction operator with no preceding expression', token, _offset + t)

      expectingExpression = true
      if (groupOperation && groupOperation !== op) {
        if (expressions.length < 2) throw new ParseError('Unexpected junction operator with no preceding expression', token, _offset + t)

        switch (groupOperation) {
          case 'AND': { // assume op = OR
            const futureSubgroup = _parse(tokens.slice(t + 1), _offset + t, constraints)
            if (futureSubgroup === null) throw new ParseError('Dangling junction operator', token, _offset + t)

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

    if (NEGATORS.includes(token.content)) {
      const nextToken = tokens[t + 1]

      const nextParen = PARENS.find(([o]) => nextToken?.content === o)
      if (nextParen) {
        resolveCondition({
          startToken: (field?.token ?? token),
          startIndex: field?.index ?? _offset + t,
          endToken: (value?.token ?? comparisonOperation?.token ?? field?.token),
          endIndex: (value?.index ?? comparisonOperation?.index ?? field?.index)!
        })

        ++t

        const closingIndex = getClosingIndex(tokens, t, nextParen[0], nextParen[1])
        if (closingIndex === -1) throw new ParseError('Missing closing parenthesis for group', token, _offset + t)

        ++t

        const futureSubExpression = _parse(tokens.slice(t, closingIndex), _offset + t, constraints)
        if (futureSubExpression) {
          complementExpression(futureSubExpression)

          // Simplification
          if (futureSubExpression.type === 'group' && futureSubExpression.operation === groupOperation) expressions.push(...futureSubExpression.constituents)
          else {
            const group = getExpressionGroup({
              startToken: token,
              startIndex: _offset + t,
              endToken: tokens[closingIndex],
              endIndex: closingIndex
            })
            group.push(futureSubExpression)
            inConjunction = false
          }
        }

        t = closingIndex

        continue
      }
    }

    if (!comparisonOperation || (op && OPERATION_PURPOSE_DICTIONARY[op] === 'comparison')) {
      if (op && OPERATION_PURPOSE_DICTIONARY[op] === 'comparison') {
        if (comparisonOperation || !field) throw new ParseError('Unexpected comparison operator', field?.token ?? token, field?.index ?? _offset + t, token, _offset + t)

        comparisonOperation = {
          content: op as ComparisonOperation,
          token,
          index: _offset + t
        }

        continue
      } else if (field) throw new ParseError('Expected a comparison operator', field.token, field.index, token, _offset + t)
    }

    if (!field) {
      if (NEGATORS.includes(token.content)) {
        const nextToken = tokens[t + 1]
        if (!nextToken) throw new ParseError('Unexpected "!"', token, _offset + t)

        resolveCondition({
          startToken: token,
          startIndex: _offset + t,
          endToken: nextToken,
          endIndex: _offset + t + 1
        })

        ++t

        field = {
          content: nextToken.content,
          token,
          index: _offset + t
        }
        comparisonOperation = {
          content: 'EQUAL'
        }
        value = {
          content: 'false',
          implicit: true
        }

        resolveCondition({
          startToken: field.token,
          startIndex: field.index,
          endToken: nextToken,
          endIndex: _offset + t
        })
      } else {
        field = {
          content: token.content,
          token,
          index: _offset + t
        }
      }

      continue
    }

    if (!value) {
      const bracket = BRACKETS.find(([o]) => token.content === o)
      if (bracket) {
        const closingIndex = getClosingIndex(tokens, t, bracket[0], bracket[1])
        if (closingIndex === -1) throw new ParseError('Missing closing bracket/brace for array value', token, _offset + t)

        ++t

        const arr: string[] = []
        value = {
          content: arr,
          token: tokens[closingIndex],
          index: closingIndex
        }
        const arrayContents = tokens.slice(t, closingIndex)

        let workingEntry = ''
        let firstEntryToken: Token | undefined
        let firstEntryTokenIndex: number | undefined
        let lastEntryToken: Token | undefined
        let lastEntryTokenIndex: number | undefined

        function resolveEntry (subtoken: Token, subindex: number): void {
          if (workingEntry) {
            const subquotes = workingEntry.match(QUOTE_REGEX)
            if (subquotes && (subquotes.index !== 0 || subquotes[0].length !== workingEntry.length)) throw new ParseError('Quotes must surround entire values in arrays', firstEntryToken ?? subtoken, firstEntryTokenIndex ?? subindex, lastEntryToken ?? subtoken, lastEntryTokenIndex ?? subindex)

            arr.push(workingEntry)
            workingEntry = ''
            firstEntryToken = undefined
            firstEntryTokenIndex = undefined
            lastEntryToken = undefined
            lastEntryTokenIndex = undefined
          }
        }

        for (let ct = 0; ct < arrayContents.length; ++ct) {
          const contentToken = arrayContents[ct]!

          if (ARRAY_DELIMITERS.includes(contentToken.content)) {
            if (!workingEntry) throw new ParseError('Unexpected blank entry in array', contentToken, _offset + t + ct)

            resolveEntry(contentToken, _offset + t + ct)
          } else {
            lastEntryToken = contentToken
            lastEntryTokenIndex = _offset + t + ct
            if (!firstEntryToken) firstEntryToken = lastEntryToken
            if (!firstEntryTokenIndex) firstEntryTokenIndex = lastEntryTokenIndex
            workingEntry += contentToken.content
          }
        }
        resolveEntry(arrayContents.at(-1)!, _offset + t + arrayContents.length - 1)

        if (!arr.length) {
          throw new ParseError('Empty array provided as value', token, _offset + t - 1, tokens[closingIndex], _offset + closingIndex)
        }

        t = closingIndex
      } else {
        value = {
          content: token.content,
          token,
          index: _offset + t
        }
      }

      resolveCondition({
        startToken: field.token,
        startIndex: field.index,
        endToken: value.token ?? comparisonOperation?.token ?? field.token,
        endIndex: value.index ?? comparisonOperation?.index ?? field.index
      })
    }
  }

  resolveCondition({
    startToken: field?.token,
    startIndex: field?.index,
    endToken: value?.token ?? comparisonOperation?.token ?? field?.token,
    endIndex: value?.index ?? comparisonOperation?.index ?? field?.index
  })

  if (inConjunction) throw new ParseError('Dangling junction operator', tokens.at(-1), _offset + tokens.length - 1)

  if (groupOperation) {
    if (expressions.length === 1) throw new ParseError('Dangling junction operator', tokens.at(-1), _offset + tokens.length - 1)

    return {
      type: 'group',
      operation: groupOperation,
      constituents: expressions
    }
  } else if (expressions.length > 1) throw new ParseError('Group possesses multiple conditions without disjunctive operators', tokens[0], _offset)
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
export function parse<
  const T extends TypeRecord = {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
  const V extends boolean = false
> (
  expression: string | string[] | Token[],
  constraints?: ExpressionConstraints<T, V>
): Expression<ConvertTypeRecord<T>, V> | null {
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
