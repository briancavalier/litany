SQL was designed for relational querying, and object-relational impedence mismatch is painful. Let's just write SQL.

```js
const name = 'Brian'
const category = 'Engineering'

const subQuery = sql`SELECT value FROM departments WHERE category = ${category}`

const q = sql`
  SELECT * FROM users
  WHERE firstName = ${name}
  AND department IN (${subQuery})
`
```