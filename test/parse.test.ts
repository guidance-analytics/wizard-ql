import { test, expect } from 'bun:test'

import { type ComparisonOperation, OPERATION_ALIAS_DICTIONARY } from '../src/spec'
import { tokenize, parse } from '../src/parse'
import { ConstraintError, ParseError } from '../src/errors'

test('tokenization', () => {
  const strings = {
    '(field = string or other\\ field > 24) & boolean_field\\!': ['(', 'field', '=', 'string', 'OR', 'other\\ field', '>', '24', ')', '&', 'boolean_field\\!'],
    '!(test = foo oR bar <= baz) ^ !boolean\\ field': ['!', '(', 'test', '=', 'foo', 'OR', 'bar', '<=', 'baz', ')', '^', '!', 'boolean\\ field'],
    '': [],
    'field\\==value': ['field\\=', '=', 'value'],
    'field\\= equals value': ['field\\=', 'EQUALS', 'value'],
    'field\\\\= value': ['field\\\\', '=', 'value'],
    '\'field WITH spaces\' isnt        "value with  spaces"': ['\'field WITH spaces\'', 'ISNT', '"value with  spaces"'],
    'array_field : [value1\\ spaced , "value2"]': ['array_field', ':', '[', 'value1\\ spaced', ',', '"value2"', ']'],
    '1 NOtIN 2,3': ['1', 'NOTIN', '2', ',', '3'],
    '"field" = "\'value  "': ['"field"', '=', '"\'value  "'],
    '"field" = va\\"lue\\"': ['"field"', '=', 'va\\"lue\\"']
  }

  for (const string in strings) {
    expect(tokenize(string).map((t) => t.content), string).toEqual(strings[string as keyof typeof strings])
  }

  for (const operation in OPERATION_ALIAS_DICTIONARY) {
    const string = `field ${operation.toLowerCase()} value`

    expect(tokenize(string).map((t) => t.content), string).toEqual(['field', operation, 'value'])
  }

  expect(tokenize('one\\ token').map((t) => t.content), 'one\\ token').toEqual(['one\\ token'])

  expect(tokenize('foo = bar or (field : [1, 2])'), 'indices').toEqual([
    {
      content: 'foo',
      index: 0
    },
    {
      content: '=',
      index: 4
    },
    {
      content: 'bar',
      index: 6
    },
    {
      content: 'OR',
      index: 10
    },
    {
      content: '(',
      index: 13
    },
    {
      content: 'field',
      index: 14
    },
    {
      content: ':',
      index: 20
    },
    {
      content: '[',
      index: 22
    },
    {
      content: '1',
      index: 23
    },
    {
      content: ',',
      index: 24
    },
    {
      content: '2',
      index: 26
    },
    {
      content: ']',
      index: 27
    },
    {
      content: ')',
      index: 28
    }
  ])
})

test('basic query', () => {
  expect(parse('field = value'), 'string query').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'EQUAL',
    value: 'value',
    validated: false
  })

  expect(parse('field : [foo bar , "baz", ` foobar `]'), 'array query').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'IN',
    value: ['foo bar', 'baz', ' foobar '],
    validated: false
  })

  expect(parse('field < 8'), 'numbers').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'LESS',
    value: 8,
    validated: false
  })

  expect(parse('field matches ".*substr.*"'), 'regex').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'MATCH',
    value: '.*substr.*',
    validated: false
  })
  expect(parse('field !~ "f{3}"'), 'notregex').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'NOTMATCH',
    value: 'f{3}',
    validated: false
  })
})

test('implicit boolean', () => {
  expect(parse('field'), 'standalone').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'EQUAL',
    value: true,
    validated: false
  })

  expect(parse('field & foo = bar'), 'with junction').toEqual({
    type: 'group',
    operation: 'AND',
    constituents: [
      {
        type: 'condition',
        field: 'field',
        operation: 'EQUAL',
        value: true,
        validated: false
      },
      {
        type: 'condition',
        field: 'foo',
        operation: 'EQUAL',
        value: 'bar',
        validated: false
      }
    ]
  })

  expect(parse('!foo'), 'negative').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'EQUAL',
    value: false,
    validated: false
  })
})

test('escaped parsing', () => {
  expect(parse('field neq \'2\''), 'numeric as string').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'NOTEQUAL',
    value: '2',
    validated: false
  })

  expect(parse('"field 1" = foo\\ bar'), 'quoted field escaped value').toEqual({
    type: 'condition',
    field: 'field 1',
    operation: 'EQUAL',
    value: 'foo bar',
    validated: false
  })

  expect(parse('field\\ 1 = \'foo bar\''), 'escaped field quoted value').toEqual({
    type: 'condition',
    field: 'field 1',
    operation: 'EQUAL',
    value: 'foo bar',
    validated: false
  })

  expect(parse('field1 = \\"value spaced\\"'), 'escaped quotes field').toEqual({
    type: 'condition',
    field: 'field1',
    operation: 'EQUAL',
    value: '"value spaced"',
    validated: false
  })

  expect(parse('\'field\' = "\\"value\\" \\"spaced\\""'), 'escaped inner quotes field').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'EQUAL',
    value: '"value" "spaced"',
    validated: false
  })

  expect(parse('field !: ["entry, 1", entry 2, \'\\\'entry 3\\\'\']'), 'array entries').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'NOTIN',
    value: ['entry, 1', 'entry 2', '\'entry 3\''],
    validated: false
  })

  expect(parse('field : [\\\\\\\\"string", "string\\\\\\"]'), 'excessive escaping').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'IN',
    value: ['\\\\"string"', '"string\\"'],
    validated: false
  })
})

test('invalid operands', () => {
  expect(() => parse('"1" "2" "3"'), 'no comparison').toThrow(ParseError)
  expect(() => parse('1 = "2 3" "4 5"'), 'too many operands').toThrow(ParseError)
  expect(() => parse('field in []'), 'no array entries').toThrow(ParseError)
  expect(() => parse('field in []'), 'no array entries').toThrow('Token #2 -> #3 (char 9 -> 10 "[" -> "]"): Empty array provided as value')
  expect(() => parse('[entry] = bar'), 'array as field').toThrow(ParseError)
})

test('unclosed closures', () => {
  expect(() => parse('(foo'), 'parenthesis').toThrow(ParseError)
  expect(() => parse('(foo'), 'parenthesis').toThrow('Token #0 (char 0 "("): Missing closing parenthesis for group')
  expect(() => parse('foo : [1'), 'bracket').toThrow(ParseError)
  expect(() => parse('foo : [1'), 'bracket').toThrow('Token #2 (char 6 "["): Missing closing bracket/brace for array value')
  expect(() => parse('foo : {1'), 'brace').toThrow(ParseError)
  expect(() => parse('foo : {1'), 'brace').toThrow('Token #2 (char 6 "{"): Missing closing bracket/brace for array value')

  expect(() => parse(')test'), 'unopened parenthesis').toThrow(ParseError)
  expect(() => parse(')test'), 'unopened parenthesis').toThrow('Token #0 (char 0 ")"): Unexpected closing parenthesis')
  expect(() => parse('field = ]test'), 'unopened bracket').toThrow(ParseError)
  expect(() => parse('field = ]test'), 'unopened bracket').toThrow('Token #2 (char 8 "]"): Unexpected closing bracket/brace')
})

test('closure hell', () => {
  expect(parse('(((foo)) | (bar)) & (baz)')).toEqual({
    type: 'group',
    operation: 'AND',
    constituents: [
      {
        type: 'group',
        operation: 'OR',
        constituents: [
          {
            type: 'condition',
            field: 'foo',
            operation: 'EQUAL',
            value: true,
            validated: false
          },
          {
            type: 'condition',
            field: 'bar',
            operation: 'EQUAL',
            value: true,
            validated: false
          }
        ]
      },
      {
        type: 'condition',
        field: 'baz',
        operation: 'EQUAL',
        value: true,
        validated: false
      }
    ]
  })
})

test('groups', () => {
  expect(parse('(field1 = value1 & field 2 < 2)'), 'AND group').toEqual({
    type: 'group',
    operation: 'AND',
    constituents: [
      {
        type: 'condition',
        field: 'field1',
        operation: 'EQUAL',
        value: 'value1',
        validated: false
      },
      {
        type: 'condition',
        field: 'field 2',
        operation: 'LESS',
        value: 2,
        validated: false
      }
    ]
  })

  expect(parse('field1 = value1 or field 2 > 2'), 'implicit OR group').toEqual({
    type: 'group',
    operation: 'OR',
    constituents: [
      {
        type: 'condition',
        field: 'field1',
        operation: 'EQUAL',
        value: 'value1',
        validated: false
      },
      {
        type: 'condition',
        field: 'field 2',
        operation: 'GREATER',
        value: 2,
        validated: false
      }
    ]
  })

  expect(parse('field1 = value1 or (field 2 : [value 2] && field_3 = value 3)'), 'complex group').toEqual({
    type: 'group',
    operation: 'OR',
    constituents: [
      {
        type: 'condition',
        field: 'field1',
        operation: 'EQUAL',
        value: 'value1',
        validated: false
      },
      {
        type: 'group',
        operation: 'AND',
        constituents: [
          {
            type: 'condition',
            field: 'field 2',
            operation: 'IN',
            value: ['value 2'],
            validated: false
          },
          {
            type: 'condition',
            field: 'field_3',
            operation: 'EQUAL',
            value: 'value 3',
            validated: false
          }
        ]
      }
    ]
  })

  expect(parse('boolean & field = value and number < 3 and array in [1, "2", 3]'), 'big and').toEqual({
    type: 'group',
    operation: 'AND',
    constituents: [
      {
        type: 'condition',
        field: 'boolean',
        operation: 'EQUAL',
        value: true,
        validated: false
      },
      {
        type: 'condition',
        field: 'field',
        operation: 'EQUAL',
        value: 'value',
        validated: false
      },
      {
        type: 'condition',
        field: 'number',
        operation: 'LESS',
        value: 3,
        validated: false
      },
      {
        type: 'condition',
        field: 'array',
        operation: 'IN',
        value: [1, '2', 3],
        validated: false
      }
    ]
  })

  expect(parse('((a and (b) and (c and d)))'), 'simplification').toEqual({
    type: 'group',
    operation: 'AND',
    constituents: [
      {
        type: 'condition',
        field: 'a',
        operation: 'EQUAL',
        value: true,
        validated: false
      },
      {
        type: 'condition',
        field: 'b',
        operation: 'EQUAL',
        value: true,
        validated: false
      },
      {
        type: 'condition',
        field: 'c',
        operation: 'EQUAL',
        value: true,
        validated: false
      },
      {
        type: 'condition',
        field: 'd',
        operation: 'EQUAL',
        value: true,
        validated: false
      }
    ]
  })
})

test('basic parsing errors', () => {
  expect(() => parse('operation = ='), 'double equal').toThrow(ParseError)
  expect(() => parse('operation = \\='), 'double equal with escape doesnt throw').not.toThrow()
  expect(() => parse('operation = "="'), 'double equal with quotes doesnt throw').not.toThrow()
  expect(() => parse('"field" "unknown" = foo'), 'two tokens for field').toThrow(ParseError)
})

test('group disjunction', () => {
  expect(parse('field1 & field2 or !field3'), 'and -> or').toEqual({
    type: 'group',
    operation: 'OR',
    constituents: [
      {
        type: 'group',
        operation: 'AND',
        constituents: [
          {
            type: 'condition',
            field: 'field1',
            operation: 'EQUAL',
            value: true,
            validated: false
          },
          {
            type: 'condition',
            field: 'field2',
            operation: 'EQUAL',
            value: true,
            validated: false
          }
        ]
      },
      {
        type: 'condition',
        field: 'field3',
        operation: 'EQUAL',
        value: false,
        validated: false
      }
    ]
  })

  expect(parse('vfield1 | field2 and !field3'), 'or -> and').toEqual({
    type: 'group',
    operation: 'OR',
    constituents: [
      {
        type: 'condition',
        field: 'vfield1',
        operation: 'EQUAL',
        value: true,
        validated: false
      },
      {
        type: 'group',
        operation: 'AND',
        constituents: [
          {
            type: 'condition',
            field: 'field2',
            operation: 'EQUAL',
            value: true,
            validated: false
          },
          {
            type: 'condition',
            field: 'field3',
            operation: 'EQUAL',
            value: false,
            validated: false
          }
        ]
      }
    ]
  })
})

test('dangling junctions', () => {
  expect(() => parse('^ foo')).toThrow('Token #0 (char 0 "^"): Unexpected junction operator with no preceding expression')
  expect(() => parse('foo^')).toThrow('Token #1 (char 3 "^"): Dangling junction operator')
  expect(() => parse('V foo')).toThrow('Token #0 (char 0 "V"): Unexpected junction operator with no preceding expression')
  expect(() => parse('foo or')).toThrow('Token #1 (char 4 "OR"): Dangling junction operator')
})

test('NOT on group', () => {
  expect(parse('foo and !(bar and baz)'), 'demorgans and').toEqual({
    type: 'group',
    operation: 'AND',
    constituents: [
      {
        type: 'condition',
        operation: 'EQUAL',
        field: 'foo',
        value: true,
        validated: false
      },
      {
        type: 'group',
        operation: 'OR',
        constituents: [
          {
            type: 'condition',
            field: 'bar',
            operation: 'NOTEQUAL',
            value: true,
            validated: false
          },
          {
            type: 'condition',
            field: 'baz',
            operation: 'NOTEQUAL',
            value: true,
            validated: false
          }
        ]
      }
    ]
  })

  expect(parse('foo or !(bar or baz)'), 'demorgans or').toEqual({
    type: 'group',
    operation: 'OR',
    constituents: [
      {
        type: 'condition',
        operation: 'EQUAL',
        field: 'foo',
        value: true,
        validated: false
      },
      {
        type: 'group',
        operation: 'AND',
        constituents: [
          {
            type: 'condition',
            field: 'bar',
            operation: 'NOTEQUAL',
            value: true,
            validated: false
          },
          {
            type: 'condition',
            field: 'baz',
            operation: 'NOTEQUAL',
            value: true,
            validated: false
          }
        ]
      }
    ]
  })

  expect(parse('foo or !(bar and (baz or !foobar))'), 'group merging').toEqual({
    type: 'group',
    operation: 'OR',
    constituents: [
      {
        type: 'condition',
        field: 'foo',
        operation: 'EQUAL',
        value: true,
        validated: false
      },
      {
        type: 'condition',
        field: 'bar',
        operation: 'NOTEQUAL',
        value: true,
        validated: false
      },
      {
        type: 'group',
        operation: 'AND',
        constituents: [
          {
            type: 'condition',
            field: 'baz',
            operation: 'NOTEQUAL',
            value: true,
            validated: false
          },
          {
            type: 'condition',
            field: 'foobar',
            operation: 'NOTEQUAL',
            value: false,
            validated: false
          }
        ]
      }
    ]
  })

  expect(() => parse('!foo OR bar = value & !(field)')).not.toThrow()
  expect(() => parse('!foo OR bar = value & !(field)')).not.toThrow()
})

test('complement operators', () => {
  expect(parse('!(foo = string)'), 'equal').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'NOTEQUAL',
    value: 'string',
    validated: false
  })
  expect(parse('!(foo = string)'), 'notequal').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'NOTEQUAL',
    value: 'string',
    validated: false
  })
  expect(parse('!(foo >= 2)'), 'geq').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'LESS',
    value: 2,
    validated: false
  })
  expect(parse('!(foo <= 2)'), 'leq').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'GREATER',
    value: 2,
    validated: false
  })
  expect(parse('!(foo < 2)'), 'less').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'GEQ',
    value: 2,
    validated: false
  })
  expect(parse('!(foo > 2)'), 'equal').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'LEQ',
    value: 2,
    validated: false
  })
  expect(parse('!(foo notin [1])'), 'notin').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'IN',
    value: [1],
    validated: false
  })
  expect(parse('!(foo ~ expression?)'), 'matches').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'NOTMATCH',
    value: 'expression?',
    validated: false
  })

  expect(parse('!(foo notmatches expression?)'), 'notmatches').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'MATCH',
    value: 'expression?',
    validated: false
  })
})

test('operation constraints', () => {
  const tests: Array<[ComparisonOperation, string]> = [
    ['EQUAL', '[entry]'],
    ['NOTEQUAL', '[entry1, entry2]'],
    ['GEQ', 'string'],
    ['GREATER', 'true'],
    ['LEQ', 'foo'],
    ['LESS', 'false'],
    ['IN', 'string'],
    ['NOTIN', '42'],
    ['MATCH', '[1, 2]'],
    ['NOTMATCH', '12']
  ]

  for (const [op, value] of tests) expect(() => parse(`field ${op} ${value}`), op).toThrow(ConstraintError)
})

test('type constraints', () => {
  expect(() => parse('foo = string', {
    types: {
      foo: 'string'
    }
  }), 'allowed single value').not.toThrow()
  expect(parse('foo = string', {
    types: {
      foo: 'string'
    }
  }), 'validated field set').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'EQUAL',
    value: 'string',
    validated: true
  })
  expect(() => parse('foo = 42', {
    types: {
      foo: 'string'
    }
  }), 'prohibited single value').toThrow(ConstraintError)
  expect(() => parse('foo in [string, 10, entry, 8]', {
    types: {
      foo: ['string', 'number']
    }
  }), 'allowed mixed multiple values').not.toThrow()
  expect(() => parse('foo = bar', {
    types: {
      foo: ['string', 'number']
    }
  }), 'allowed mixed single value').not.toThrow()
  expect(() => parse('foo in [string, 10, true, 8]', {
    types: {
      foo: ['string', 'number']
    }
  }), 'prohibited mixed multiple values').toThrow(ConstraintError)
  expect(() => parse('foo', {
    types: {
      foo: ['string', 'number']
    }
  }), 'prohibited mixed single value').toThrow(ConstraintError)

  expect(() => parse('bar and fIeLD in [1, 2, peanut butter, 4]', {
    types: {
      field: ['number', 'boolean']
    },
    caseInsensitive: true
  }), 'prohibited case insensitivity').toThrow(ConstraintError)

  expect(parse('fIeLD in [1, 2, peanut butter, 4]', {
    types: {
      field: ['string', 'number']
    },
    caseInsensitive: true
  }), 'allowed case insensitivity').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'IN',
    value: [1, 2, 'peanut butter', 4],
    validated: true
  })
})

test('restriction constraints', () => {
  expect(() => parse('(foo = bar and baz = foobar) or restricted', {
    restricted: {
      restricted: true
    }
  }), 'total restriction').toThrow(ConstraintError)

  expect(() => parse('(foo = bar and baz = foobar) or "RESTRICTED"', {
    restricted: {
      restricted: true
    },
    caseInsensitive: true
  }), 'case insensitivity and quotes').toThrow(ConstraintError)

  expect(() => parse('field = allowed || field = string', {
    restricted: {
      field: ['string']
    }
  }), 'prohibited value restriction').toThrow(ConstraintError)

  expect(() => parse('field = allowed', {
    restricted: {
      field: ['string']
    }
  }), 'allowed value restriction').not.toThrow()

  expect(() => parse('array in [1, 2, cow, null, true]', {
    restricted: {
      array: ['null']
    }
  }), 'prohibited array checking').toThrow(ConstraintError)

  expect(() => parse('array in [1, 2, cow, true]', {
    restricted: {
      array: ['null']
    }
  }), 'allowed array checking').not.toThrow()

  expect(() => parse('plural in [cows, dogs, cats, pigs]', {
    restricted: {
      plural: [/[^s]$/]
    }
  }), 'allowed regexing').not.toThrow()

  expect(() => parse('plural in [cows, dogs, cat, pigs]', {
    restricted: {
      plural: [/[^s]$/]
    }
  }), 'prohibited regexing').toThrow(ConstraintError)
})
