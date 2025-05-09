import type { Knex } from 'knex'
import type { Expression } from './spec'

/**
 * Execute a Wizard expression as a SQL query\
 * This mutates the passed query
 * @param query      The Knex query to append conditions to
 * @param expression The Wizard expression
 */
export function executeAsKnex (query: Knex.QueryBuilder, expression: Expression): void {
  switch (expression.type) {
    case 'group': {
      let firstHappened = false
      for (const constituent of expression.constituents) {
        query[firstHappened ? expression.operation === 'AND' ? 'andWhere' : 'orWhere' : 'where']((clause) => executeAsKnex(clause, constituent))
        firstHappened = true
      }

      break
    }
    case 'condition':
      switch (expression.operation) {
        case 'EQUAL': query.where(expression.field, '=', expression.value); break
        case 'NOTEQUAL': query.where(expression.field, '!=', expression.value); break
        case 'GEQ': query.where(expression.field, '>=', expression.value); break
        case 'LEQ': query.where(expression.field, '<=', expression.value); break
        case 'GREATER': query.where(expression.field, '>', expression.value); break
        case 'LESS': query.where(expression.field, '<', expression.value); break
        case 'IN': query.whereIn(expression.field, expression.value); break
        case 'NOTIN': query.whereNotIn(expression.field, expression.value); break
        case 'MATCH': query.whereRaw('?? ~* ?', [expression.field, expression.value]); break
        case 'NOTMATCH': query.whereRaw('?? !~* ?', [expression.field, expression.value]); break
      }
  }
}
