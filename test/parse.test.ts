import { test, expect } from 'bun:test'

import { OPERATION_ALIAS_DICTIONARY, tokenize, parse } from '../src/parse'
import { ParseError } from '../src/errors'

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
    expect(tokenize(string), string).toEqual(strings[string as keyof typeof strings])
  }

  for (const operation in OPERATION_ALIAS_DICTIONARY) {
    const string = `field ${operation.toLowerCase()} value`

    expect(tokenize(string), string).toEqual(['field', operation, 'value'])
  }

  expect(tokenize('one\\ token'), 'one\\ token').toEqual(['one\\ token'])
})

test('basic query', () => {
  expect(parse('field = value'), 'string query').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'EQUAL',
    value: 'value'
  })

  expect(parse('field : [foo bar , "baz", ` foobar `]'), 'array query').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'IN',
    value: ['foo bar', 'baz', ' foobar ']
  })

  expect(parse('field < 8'), 'numbers').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'LESS',
    value: 8
  })
})

test('implicit boolean', () => {
  expect(parse('field'), 'standalone').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'EQUAL',
    value: true
  })

  expect(parse('field & foo = bar'), 'with junction').toEqual({
    type: 'group',
    operation: 'AND',
    constituents: [
      {
        type: 'condition',
        field: 'field',
        operation: 'EQUAL',
        value: true
      },
      {
        type: 'condition',
        field: 'foo',
        operation: 'EQUAL',
        value: 'bar'
      }
    ]
  })

  expect(parse('!foo'), 'negative').toEqual({
    type: 'condition',
    field: 'foo',
    operation: 'EQUAL',
    value: false
  })
})

test('escaped parsing', () => {
  expect(parse('"field 1" = foo\\ bar'), 'quoted field escaped value').toEqual({
    type: 'condition',
    field: 'field 1',
    operation: 'EQUAL',
    value: 'foo bar'
  })

  expect(parse('field\\ 1 = \'foo bar\''), 'escaped field quoted value').toEqual({
    type: 'condition',
    field: 'field 1',
    operation: 'EQUAL',
    value: 'foo bar'
  })

  expect(parse('field1 = \\"value spaced\\"'), 'escaped quotes field').toEqual({
    type: 'condition',
    field: 'field1',
    operation: 'EQUAL',
    value: '"value spaced"'
  })

  expect(parse('\'field\' = "\\"value\\" \\"spaced\\""'), 'escaped inner quotes field').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'EQUAL',
    value: '"value" "spaced"'
  })

  expect(parse('field != ["entry, 1", entry 2, \'\\\'entry 3\\\'\']'), 'array entries').toEqual({
    type: 'condition',
    field: 'field',
    operation: 'NOTEQUAL',
    value: ['entry, 1', 'entry 2', '\\\'entry 3\\\'']
  })
})

test('invalid operands', () => {
  expect(() => parse('"1" "2" "3"'), 'no comparison').toThrow(ParseError)
  expect(() => parse('1 = "2 3" "4 5"'), 'too many operands').toThrow(ParseError)
})

test('unclosed scopes', () => {
  expect(() => parse('(foo'), 'parenthesis').toThrow(ParseError)
  expect(() => parse('(foo'), 'parenthesis').toThrow('Token #0: Missing closing parenthesis for group')
  expect(() => parse('foo : [1'), 'bracket').toThrow(ParseError)
  expect(() => parse('foo : [1'), 'bracket').toThrow('Token #2: Missing closing bracket/brace for array value')
  expect(() => parse('foo : {1'), 'brace').toThrow(ParseError)
  expect(() => parse('foo : {1'), 'brace').toThrow('Token #2: Missing closing bracket/brace for array value')

  expect(() => parse(')test'), 'unopened parenthesis').toThrow(ParseError)
  expect(() => parse(')test'), 'unopened parenthesis').toThrow('Token #0: Unexpected closing parenthesis')
  expect(() => parse('field = ]test'), 'unopened bracket').toThrow(ParseError)
  expect(() => parse('field = ]test'), 'unopened bracket').toThrow('Token #2: Unexpected closing bracket/brace')
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
        value: 'value1'
      },
      {
        type: 'condition',
        field: 'field 2',
        operation: 'LESS',
        value: 2
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
        value: 'value1'
      },
      {
        type: 'condition',
        field: 'field 2',
        operation: 'GREATER',
        value: 2
      }
    ]
  })

  expect(parse('field1 = value1 or (field 2 : value 2 && field_3 = value 3)'), 'complex group').toEqual({
    type: 'group',
    operation: 'OR',
    constituents: [
      {
        type: 'condition',
        field: 'field1',
        operation: 'EQUAL',
        value: 'value1'
      },
      {
        type: 'group',
        operation: 'AND',
        constituents: [
          {
            type: 'condition',
            field: 'field 2',
            operation: 'IN',
            value: 'value 2'
          },
          {
            type: 'condition',
            field: 'field_3',
            operation: 'EQUAL',
            value: 'value 3'
          }
        ]
      }
    ]
  })
})

test('basic parsing errors', () => {
  expect(() => parse('operation = ='), 'double equal').toThrow(ParseError)
  expect(() => parse('operation = \\='), 'double equal with escape doesnt throw').not.toThrow()
  expect(() => parse('operation = "="'), 'double equal with quotes doesnt throw').not.toThrow()
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
            value: true
          },
          {
            type: 'condition',
            field: 'field2',
            operation: 'EQUAL',
            value: true
          }
        ]
      },
      {
        type: 'condition',
        field: 'field3',
        operation: 'EQUAL',
        value: false
      }
    ]
  })

  expect(parse('field1 | field2 and !field3'), 'or -> and').toEqual({
    type: 'group',
    operation: 'OR',
    constituents: [
      {
        type: 'condition',
        field: 'field1',
        operation: 'EQUAL',
        value: true
      },
      {
        type: 'group',
        operation: 'AND',
        constituents: [
          {
            type: 'condition',
            field: 'field2',
            operation: 'EQUAL',
            value: true
          },
          {
            type: 'condition',
            field: 'field3',
            operation: 'EQUAL',
            value: false
          }
        ]
      }
    ]
  })
})

test('dangling junctions', () => {
  expect(() => parse('^ foo')).toThrow('Token #0: Unexpected junction operator with no preceding expression')
  expect(() => parse('foo^')).toThrow('Token #1: Dangling junction operator')
  expect(() => parse('|foo')).toThrow('Token #0: Unexpected junction operator with no preceding expression')
  expect(() => parse('foo or')).toThrow('Token #1: Dangling junction operator')
})
