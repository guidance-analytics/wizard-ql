import { test, expect } from 'bun:test'

import { parse } from '../src/parse'
import { stringify } from '../src/stringify'

test('basic stringification', () => {
  const query = 'field1 = "value" and field4 != "2" & field2 equals 2 | !field3'

  expect(stringify(parse(query)!), 'defaults').toBe('field1 = value & field4 != "2" & field2 = 2 | field3 = false')

  expect(stringify(parse(query)!, {
    junctionNotation: 'linguistic',
    comparisonNotation: 'linguistic'
  }), 'linguistic').toBe('field1 EQUALS value AND field4 NOTEQUALS "2" AND field2 EQUALS 2 OR field3 EQUALS false')

  expect(stringify(parse(query)!, {
    comparisonNotation: 'linguistic',
    junctionNotation: 'formal'
  }), 'formal').toBe('field1 EQUALS value ^ field4 NOTEQUALS "2" ^ field2 EQUALS 2 V field3 EQUALS false')

  expect(stringify(parse(query)!, {
    alwaysParenthesize: true
  }), 'always parenthesize').toBe('(field1 = value & field4 != "2" & field2 = 2) | field3 = false')

  expect(stringify(parse(query)!, {
    compact: true
  }), 'compact').toBe('field1=value&field4!="2"&field2=2|field3=false')

  expect(stringify(parse(query)!, {
    compact: true,
    comparisonNotation: 'linguistic'
  }), 'compact with linguistic').toBe('field1 EQUALS value&field4 NOTEQUALS "2"&field2 EQUALS 2|field3 EQUALS false')

  expect(stringify(parse('foo = false | foo = true | foo != false | foo != true | bar | !bar')!, {
    condenseBooleans: true
  }), 'condense booleans').toBe('!foo | foo | foo | !foo | bar | !bar')
})

test('arrays', () => {
  expect(stringify(parse('field : [1,2, 3, "4", "five", \'six\']')!), 'regular mixed').toBe('field : [1, 2, 3, "4", five, six]')
  expect(stringify(parse('field : [1,2, 3, \\[4\\], "five", \'six\']')!), 'escaped bracket mixed').toBe('field : [1, 2, 3, "[4]", five, six]')
  expect(stringify(parse('field : [1,2, 3, "[4]", "five", \'six\']')!), 'quoted bracket mixed').toBe('field : [1, 2, 3, "[4]", five, six]')
})

test('nested quotes', () => {
  expect(stringify(parse('field = "\\"foo\\""')!), 'basic nested quotes').toBe('field = \\"foo\\"')
  expect(stringify(parse('field : [1,2, 3, "[\\"4]", "five", \'six\']')!), 'quoted bracket mixed with quote').toBe('field : [1, 2, 3, "[\\"4]", five, six]')
})

test('complex query can be reparsed', () => {
  const query1 = 'foo & (foo = \'bar\') and ((FOOBAR : [1, "2", \\[3\\], four] V baz) | field !== wrong & test matches ".*regex.*")'
  expect(parse(query1)).toEqual(parse(stringify(parse(query1)!)))

  const query2 = 'foo & (foo = \'bar\') and !(!(FOOBAR : [1, "2", \\[3\\], four] V baz) | field !== wrong & test matches ".*regex.*")'
  expect(parse(query2)).toEqual(parse(stringify(parse(query2)!)))
})
