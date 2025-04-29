import type { ComparisonOperator, Condition, Expression } from './parse'

export interface AggregationValue {
  /** The value being checked */
  value: Condition['value']
  /** The operator being used */
  operation: ComparisonOperator
  /** Is this an exclusionary operator? (Ex: NOT, NOTIN) */
  exclusionary: boolean
}

/**
 * (Get an array entry from a map or insert one) and return it
 * @param map The map
 * @param key The key the access
 * @returns   The entry array
 */
function getOrPutArrayInMap<T, U> (map: Map<T, U[]>, key: T): U[] {
  const existingEntry = map.get(key)
  if (existingEntry) return existingEntry
  else {
    const arr: U[] = []
    map.set(key, arr)
    return arr
  }
}

/**
 * Summarize a parsed expression by aggregating its queries by field
 * @param expressions The expression or expressions to aggregate
 * @returns           The aggregation as a map, mapping field name to queries
 */
export function summarize (expressions: Expression | Expression[]): Map<string, AggregationValue[]> {
  const array = Array.isArray(expressions) ? expressions : [expressions]
  const summary = new Map<string, AggregationValue[]>()

  for (const expression of array) {
    if (expression.type === 'group') {
      const constituents = summarize(expression.constituents)

      for (const [field, values] of constituents.entries()) {
        const collection = getOrPutArrayInMap(summary, field)

        collection.push(...values)
      }
    } else {
      const collection = getOrPutArrayInMap(summary, expression.field)

      collection.push({
        operation: expression.operation,
        value: expression.value,
        exclusionary: ['NOTEQUAL', 'LESS', 'GREATER', 'NOTIN'].includes(expression.operation)
      })
    }
  }

  return summary
}
