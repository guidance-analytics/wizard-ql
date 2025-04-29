import { test, expect } from 'bun:test'

import { parse } from '../src/parse'
import { summarize } from '../src/summarize'

test('toplevel', () => {
  const andExpr = parse('foo & !bar and baz = "string" ^ baz != 42')
  expect(andExpr).not.toBe(null)

  expect(summarize(andExpr!).entries().toArray(), 'ands').toEqual([
    ['foo', [
      {
        operation: 'EQUAL',
        value: true,
        exclusionary: false
      }
    ]],
    ['bar', [
      {
        operation: 'EQUAL',
        value: false,
        exclusionary: false
      }
    ]],
    ['baz', [
      {
        operation: 'EQUAL',
        value: 'string',
        exclusionary: false
      },
      {
        operation: 'NOTEQUAL',
        value: 42,
        exclusionary: true
      }
    ]]
  ])

  const orExpr = parse('foo || !bar or baz = "string" V baz != 42')
  expect(orExpr).not.toBe(null)

  expect(summarize(orExpr!).entries().toArray(), 'ors').toEqual([
    ['foo', [
      {
        operation: 'EQUAL',
        value: true,
        exclusionary: false
      }
    ]],
    ['bar', [
      {
        operation: 'EQUAL',
        value: false,
        exclusionary: false
      }
    ]],
    ['baz', [
      {
        operation: 'EQUAL',
        value: 'string',
        exclusionary: false
      },
      {
        operation: 'NOTEQUAL',
        value: 42,
        exclusionary: true
      }
    ]]
  ])
})

test('groups', () => {
  const expr = parse('(foo in [1, 2] and (bar = 2 or baz)) V (bar !: [1, 3] and foo = 3)')
  expect(expr).not.toBe(null)

  expect(summarize(expr!).entries().toArray()).toEqual([
    ['foo', [
      {
        operation: 'IN',
        value: [1, 2],
        exclusionary: false
      },
      {
        operation: 'EQUAL',
        value: 3,
        exclusionary: false
      }
    ]],
    ['bar', [
      {
        operation: 'EQUAL',
        value: 2,
        exclusionary: false
      },
      {
        operation: 'NOTIN',
        value: [1, 3],
        exclusionary: true
      }
    ]],
    ['baz', [
      {
        operation: 'EQUAL',
        value: true,
        exclusionary: false
      }
    ]]
  ])
})

test('exclusionaries', () => {
  const expr = parse('foo geq 3 or foo leq 2 or foo !== 8 or foo = 7 || foo < 1 OR foo > 5 | foo in [10, 11] V foo notin [7, 8]')
  expect(expr).not.toBe(null)

  expect(summarize(expr!).entries().toArray()).toEqual([
    ['foo', [
      {
        operation: 'GEQ',
        value: 3,
        exclusionary: false
      },
      {
        operation: 'LEQ',
        value: 2,
        exclusionary: false
      },
      {
        operation: 'NOTEQUAL',
        value: 8,
        exclusionary: true
      },
      {
        operation: 'EQUAL',
        value: 7,
        exclusionary: false
      },
      {
        operation: 'LESS',
        value: 1,
        exclusionary: true
      },
      {
        operation: 'GREATER',
        value: 5,
        exclusionary: true
      },
      {
        operation: 'IN',
        value: [10, 11],
        exclusionary: false
      },
      {
        operation: 'NOTIN',
        value: [7, 8],
        exclusionary: true
      }
    ]]
  ])
})
