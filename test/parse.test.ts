import test from 'bun:test'

import { OPERATION_ALIAS_DICTIONARY, tokenize } from '../src/parse'

test.test('tokenization', () => {
  const strings = {
    '(field = string or other\\ field > 24) & boolean_field\\!': ['(', 'field', '=', 'string', 'OR', 'other field', '>', '24', ')', '&', 'boolean_field!'],
    '!(test = foo oR bar <= baz) ^ !boolean\\ field': ['!', '(', 'test', '=', 'foo', 'OR', 'bar', '<=', 'baz', ')', '^', '!', 'boolean field'],
    '': [],
    'field\\==value': ['field=', '=', 'value'],
    'field\\= equals value': ['field=', 'EQUALS', 'value'],
    'field\\\\= value': ['field\\', '=', 'value'],
    '\'field WITH spaces\' isnt        "value with  spaces"': ['field WITH spaces', 'ISNT', 'value with  spaces'],
    'array_field : [value1\\ spaced , "value2"]': ['array_field', ':', '[', 'value1 spaced', ',', 'value2', ']'],
    '1 NOtIN 2,3': ['1', 'NOTIN', '2', ',', '3']
  }

  for (const string in strings) {
    test.expect(tokenize(string), string).toEqual(strings[string as keyof typeof strings])
  }

  for (const operation in OPERATION_ALIAS_DICTIONARY) {
    const string = `field ${operation.toLowerCase()} value`

    test.expect(tokenize(string), string).toEqual(['field', operation, 'value'])
  }

  test.expect(tokenize('no\\ tokens'), 'no\\ tokens').toEqual(['no tokens'])
})
