// or/and/&/| work
// strings can use quotes or be implicit
// boolean values can be implicit (flagged -> flagged = true, !flagged -> flagged = false)

// operations can be their symbols or operation names
// An expression is a piece of a query (group/condition)
// A group is a series of conditions joined by junction operators (AND/OR)
// A group is implicit when using junction operators or can be explicitly denoted with parenthesis
// A = 1 & B != 2 -> (A = 1 & B != 2)

// Juction Operations:
// AND: &
// OR: |

// Value Operations:
// EQUAL/EQ: =
// NOTEQUAL/NEQ: !=
// LESS/LESSTHAN: <
// GREATER/GREATERTHAN: >
// LEQ: <=
// GEQ: >=
// IN: :
// NOTIN: !:

interface Group {
  type: 'group'
  operation: 'AND' | 'OR'
  constituents: Array<Group | Condition>
}

interface Condition {
  type: 'condition'
  operation: 'EQUAL' | 'NOTEQUAL' | 'LESS' | 'GREATER' | 'LEQ' | 'GEQ' | 'IN' | 'NOTIN'
  field: string
  value: string | string[] | number | boolean
}

type Expression = Group | Condition

const exampleQuery = '(MSN15 = compliant or ACRAD16 > 24) & flagged'

const exampleObject: Group = {
  type: 'group',
  operation: 'AND',
  constituents: [
    {
      type: 'group',
      operation: 'OR',
      constituents: [
        {
          type: 'condition',
          field: 'MSN15',
          operation: 'EQUAL',
          value: 'compliant'
        },
        {
          type: 'condition',
          field: 'ACRAD16',
          operation: 'EQUAL',
          value: 24
        }
      ]
    },
    {
      type: 'condition',
      operation: 'EQUAL',
      field: 'flagged',
      value: true
    }
  ]
}
