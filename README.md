<h2>
  𝗪<sub>izard</sub>
  <br />
  𝗜<sub>s</sub>
  <br />
  𝗭<sub>not</sub>
  <br />
  𝗔<sub>n</sub>
  <br />
  𝗥<sub>acronym</sub>
  <br />
  𝗗
  <br />
  <br />
  𝗤<sub>uery</sub>
  𝗟<sub>anguage</sub>
</h2>

#### WizardQL is a natural-language-like query language for constructing data queries for resources that meet conditions.

## Examples
`parse('(rank >= 10 & role = admin) | banned')`

> ```js
> {
>   type: "group",
>   operation: "OR",
>   constituents: [
>     {
>       type: "group",
>       operation: "AND",
>       constituents: [
>         {
>           type: "condition",
>           field: "rank",
>           operation: "GEQ",
>           value: 10,
>           validated: false,
>         }, {
>           type: "condition",
>           field: "role",
>           operation: "EQUAL",
>           value: "admin",
>           validated: false,
>         }
>       ],
>     }, {
>       type: "condition",
>       field: "banned",
>       operation: "EQUAL",
>       value: true,
>       validated: false,
>     }
>   ],
> }
> ```

`parse('flagged OR (name MATCHES "decorative_.*" AND !(price >= 20 AND price <= 30))')`

> ```js
> {
>   type: "group",
>   operation: "OR",
>   constituents: [
>     {
>       type: "condition",
>       field: "flagged",
>       operation: "EQUAL",
>       value: true,
>       validated: false,
>     }, {
>       type: "group",
>       operation: "AND",
>       constituents: [
>         {
>           type: "condition",
>           field: "name",
>           operation: "MATCH",
>           value: "decorative_.*",
>           validated: false,
>         }, {
>           type: "group",
>           operation: "OR",
>           constituents: [
>             {
>               type: "condition",
>               field: "price",
>               operation: "LESS",
>               value: 20,
>               validated: false,
>             }, {
>               type: "condition",
>               field: "price",
>               operation: "GREATER",
>               value: 30,
>               validated: false,
>             }
>           ],
>         }
>       ],
>     }
>   ],
> }
> ```

## Basic Syntax
### Condition
*A condition is a check against a field using a condition operator such as EQUAL or LESS.*
`{FIELD} {C_OPERATOR} {VALUE}`
For array operators, (`IN`, `NOTIN`), the value must be in brackets separated by commas.
> Example: `snack : [pizza, soda, chips]`

A field OR a value can be wrapped in quotes if it contains a special operator.
> Example: `"vendor" = "H&M"`

> Example: `"vendor" = H\&M`

You can also escape characters
> Example: `'speech' = "\"Hello\""`

> Example: `'speech' = '"Hello"'`

Backslashes can be denoted with a double backslash
> Example: `\\`

#### Implicit Boolean
Simply denoting a field name (`field`) transforms it into `field = true`

(`!field`) transforms it into `field = false`

### Group
*A group is multiple conditions joined by a junction operator such as AND or OR.*
`({CONDITION} [...{J_OPERATOR} {CONDITION}])`
Groups are implicit when junction operators are used (follows PEMDAS [ANDs grouped before ORs]). Parentheses can be used to denote them explicitly.

Groups can be nested.
> Example: `user.activated & ((user.role = member & user.group : [abc, xyz]) | (user.role = admin & user.privileged))`

Groups can also be negated
> `!(firstname = John & lastname = Doe)` &rarr; `firstname != John | lastname != Doe`

## Operators
### Junction Operators
<details>
<summary>AND</summary>

- `AND`
- `&`
- `&&`
- `^`
</details>

<details>
<summary>OR</summary>

- `OR`
- `|`
- `||`
- `V`
</details>

### Comparison Operators
<details>
<summary>EQUAL</summary>

- `EQUAL`
- `EQUALS`
- `EQ`
- `IS`
- `==`
- `=`
</details>

<details>
<summary>NOTEQUAL</summary>

- `NOTEQUALS`
- `NOTEQUAL`
- `NEQ`
- `ISNT`
- `!==`
- `!=`
</details>

<details>
<summary>LESS</summary>

- `LESS`
- `<`
</details>

<details>
<summary>GREATER</summary>

- `GREATER`
- `>`
- `MORE`
</details>

<details>
<summary>GEQ</summary>

- `GEQ`
- `>=`
- `=>`
</details>

<details>
<summary>LEQ</summary>

- `LEQ`
- `<=`
- `=<`
</details>

<details>
<summary>IN</summary>

- `IN`
- `:`
</details>

<details>
<summary>NOTIN</summary>

- `NOTIN`
- `!:`
</details>

<details>
<summary>MATCH</summary>

- `MATCH`
- `MATCHES`
- `~`
</details>

<details>
<summary>NOTMATCH</summary>

- `NOTMATCH`
- `NOTMATCHES`
- `!~`
</details>

## Constraints
The `parse` function can be passed an object containing various constraints as its second parameter

### `restricted`
A record mapping field names to restrictions. A value of `true` totally prohibits the usage of a field.

Otherwise, a tuple can be passed
> `['allow' | 'deny', [...values]]`

Values can be direct values (string, number, boolean) or regex expressions

"allow" will allow the values/patterns and deny all others
"deny" will deny the values/patterns and allow all others

### `types`
A record mapping field names to (`boolean`, `string`, `number`). The value in the record can either be a single allowed type or an array of allowed types. Only operators that can function on that type can be used for that field. By default, fields will be treated as being able to be any of the three types.

> Example:
> ```js
> parse('field1 = value', {
>   types: {
>     field1: 'string',
>     field2: ['string', 'number']
>   }
> })
> ```

### Regarding constraints: `validated` property
When a field has matched either a key in `types` or a field in `restricted`, the `validated` property on the parsed condition will be true. This is due to a limitation with TypeScript's type checking.

Therefore, type inference would look something like this:
```js
const parsed = parse('field = value', {
  types: {
    field: ['string', 'number']
  }
})

if (parsed.validated) {
  switch (parsed.type) {
    case 'condition':
      switch (parsed.field) {
        case 'field':
          parsed.value
          // ^?: string | number
          break
      }
      break
  }
}
```

### `caseInsensitive`
Type/constraint checks will be case-insensitive on the field name
> [!NOTE]
> If enabled, all fields will be returned as their casing denoted by the types or restricted record

> [!WARNING]
> Mismatching casing between the restricted record and the type record will prioritize the restricted record

### `disallowUnvalidated`
Fields that are not present in the type or restriction record will considered invalid fields

### `interpretDates`
If a field is set as a number, dates-like strings will still be interpreted and converted to their millisecond representations.

`true` can be passed to enable this feature, using `new Date()` to parse dates or a custom callback can be passed.

## Stringification
Parsed expressions can be converted back into strings using the `stringify` function. The stringify function comes with its own slew of options as its second parameter

### `junctionNotation`
The notation to use for junction operators
- Programmatic: `&`
- Linguistic: `AND`
- Formal: `^`

### `comparisonNotation`
The notation to use for comparison operators
- Programmatic: `=`
- Linguistic: `EQUALS`

### `alwaysParenthesize`
Always put parentheses around every group

### `compact`
Don't include spaces in the output (except for surrounding lingustic operators)

### `condenseBoolean`
`EQUAL`/`NOTEQUAL` regarding booleans will be condensed into [implicit form](#implicit-boolean)

## Summarize
You can use the `summarize` function to summarize a parsed expression, aggregated by field name across groups

`summarize(parse('(foo in [1, 2] and (bar = 2 or baz)) V (bar !: [1, 3] and foo = 3)'))`
> ```js
> [
>     ['foo', [
>       {
>         operation: 'IN',
>         value: [1, 2],
>         exclusionary: false
>       },
>       {
>         operation: 'EQUAL',
>         value: 3,
>         exclusionary: false
>       }
>     ]],
>     ['bar', [
>       {
>         operation: 'EQUAL',
>         value: 2,
>         exclusionary: false
>       },
>       {
>         operation: 'NOTIN',
>         value: [1, 3],
>         exclusionary: true
>       }
>     ]],
>     ['baz', [
>       {
>         operation: 'EQUAL',
>         value: true,
>         exclusionary: false
>       }
>     ]]
>   ]
> ```

> [!NOTE]
> `exclusionary` implies a negative operation (once that excludes the value)

## Execution Example
Below is an example of how a Wizard query would be executed in the context of a [KnexJS Query](https://knexjs.org/)

https://github.com/guidance-analytics/wizard-ql/blob/bf8693e2cb5678ef855600d70bc495a614aa3d0b/src/execute.ts#L1-L35

## DOM Input
Wizard comes pre-packaged with a DOM input that applies classes for tokens, making for query input with syntax highlighting (up to discretion)

```js
// NOTE: The input element should be a regular div element, not an input element
const destructor = createDOMInput({ input: document.getElementById('input') })

destructor()
```

### Token types
Depending on a token's type, attributes will be applied to the contents of the input for styling:

- `data-spacer` - Whitespace
- `data-node` - An actual token
  - `data-quoted` - Quoted text
  - `data-number` - A number
  - `data-bracket` - A parenthesis or array bracket
  - `data-delimiter` - A comma
  - `data-negation` - A negatory exclamation mark
  - `data-operation` - A comparison or junction operator

A token can also possess `data-error` if it is part of an error span

The input itself can have the following attributes:
- `data-error-message` - The error message
- `data-error-start` - The starting token index for the error
- `data-error-end` - The end token index for the error