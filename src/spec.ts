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
  'EQ': 'EQUAL',
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

export interface Token {
  /** The text content of the token */
  content: string
  /** The index in the original expression this token originates from */
  index: number
}

export type Operation = (typeof OPERATION_ALIAS_DICTIONARY)[keyof typeof OPERATION_ALIAS_DICTIONARY]

export const ALIASES = Object.keys(OPERATION_ALIAS_DICTIONARY)

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

type KeysWhereValue<T, V> = Exclude<{
  [K in keyof T]: T[K] extends V ? K : never
}[keyof T], never>

export type JunctionOperation = KeysWhereValue<typeof OPERATION_PURPOSE_DICTIONARY, 'junction'>
export type ComparisonOperation = KeysWhereValue<typeof OPERATION_PURPOSE_DICTIONARY, 'comparison'>

type ComparisonValueType = 'primitive' | 'boolean' | 'string' | 'number' | 'date' | 'numeric' | 'array'
/** All comparison operations and their types */
export const COMPARISON_TYPE_DICTIONARY = {
  EQUAL: 'primitive',
  NOTEQUAL: 'primitive',
  GEQ: 'numeric',
  GREATER: 'numeric',
  LEQ: 'numeric',
  LESS: 'numeric',
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
  date: Date
  numeric: number | Date
  array: Primitive[]
}[typeof COMPARISON_TYPE_DICTIONARY[T]]

export type FieldType = 'boolean' | 'string' | 'number' | 'date'
export type TypeRecord = Record<string, FieldType | FieldType[]>

/** Convert a field type string to a language server type */
export type FieldTypeToTSType<T extends FieldType> = {
  boolean: boolean
  string: string
  number: number
  date: Date
}[T]
/** Primitive values that can be used in comparisons */
export type Primitive = FieldTypeToTSType<FieldType>
/** Convert input type record to language server type record */
export type ConvertTypeRecord<T extends TypeRecord> = {
  [K in keyof T]: (T[K] extends FieldType[] ? FieldTypeToTSType<T[K][number]> : T[K] extends FieldType ? FieldTypeToTSType<T[K]> : Primitive) & Primitive
}

/**
 * A group of conditions joined by a junction operator
 * @template R A record mapping field names to values
 */
export interface Group<R extends Record<string, Primitive> = Record<string, Primitive>, V extends boolean = false> {
  type: 'group'
  /** The junction operator */
  operation: JunctionOperation
  /** The members of the group */
  constituents: Array<Expression<R, V>>
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
export type CheckedConditionSpread<R extends Record<string, Primitive>> = {
  [K in keyof R]: {
    [O in keyof ReverseAggregatedTypes]: Condition<R, K, ReverseAggregatedTypes[O]>
  }[keyof ReverseAggregatedTypes]
}[keyof R]
/** Create a union of conditions that are operation type validated */
export type UncheckedConditionSpread = {
  [O in keyof ReverseAggregatedTypes]: UncheckedCondition<ReverseAggregatedTypes[O]>
}[keyof ReverseAggregatedTypes]

export type Expression<R extends Record<string, Primitive> = Record<string, Primitive>, V extends boolean = false> =
  Group<R, V> | (V extends true
    ? CheckedConditionSpread<R>
    : CheckedConditionSpread<R> | UncheckedConditionSpread)
