type Uncompiled = 'uncompiled'
type Compiled = 'compiled'

// An SqlFragment represents an SQL query or part of a query,
// with associated parameter values.  It is in either an Uncompiled
// or Compiled state, which determines what is allowed to be done
// with it.  E.g. a Dialect only accepts Compiled SqlFragments
export class SqlFragment<S> {
  _state!: S
  constructor (public readonly strings: ReadonlyArray<string>, public readonly values: ReadonlyArray<unknown>) {}
}

// A Dialect transforms a compiled SqlFragment for a particular db library/driver/engine
export type Dialect<P> = (s: SqlFragment<Compiled>) => P

// SQL Tagged template for building SqlFragments by
// writing literal SQL
export const sql = (strings: TemplateStringsArray, ...values: unknown[]): SqlFragment<Uncompiled> =>
  new SqlFragment(strings, values)

// Flatten an SqlFragment whose values may contain nested
// SqlFragments.  Internal mutation for speed, but they don't
// escape, so it's safe.
export const compile = <S> (s: SqlFragment<S>): SqlFragment<Compiled> => {
  const strings = s.strings.slice()
  const values = s.values.slice()

  let vindex = 0
  let sindex = 0
  for (let i = 0; i < s.values.length; i++) {
    const v = s.values[i]
    if (v instanceof SqlFragment) {
      const cv = compile(v)

      spliceTemplateStrings(sindex, cv.strings, strings)
      values.splice(vindex, 1, ...cv.values)

      vindex += cv.values.length
      sindex += cv.strings.length - 2
    } else {
      vindex += 1
      sindex += 1
    }
  }

  return new SqlFragment<Compiled>(strings, values)
}

// Splice (mutably) src array of template strings into dst,
// joining the strings at the start and end splice points
const spliceTemplateStrings = (i: number, src: ReadonlyArray<string>, dst: string[]): void => {
  const srcEnd = src.length - 1
  const dstEnd = i + src.length
  dst[i] = dst[i] + src[0]
  dst.splice(i + 1, 0, ...src.slice(1, srcEnd))
  if (dstEnd < dst.length) {
    dst[dstEnd] = dst[dstEnd] + src[srcEnd]
  }
}

//
// Trivial string Dialect (unsafe! only for humans)
//
export const toUnsafeString = ({ strings, values }: SqlFragment<Compiled>): string =>
  strings.slice(1).reduce((sql, s, i) =>`${sql}${values[i]}${s}`, strings[0])

//
// Postgres Dialect
//
type PostgresQuery = {
  readonly text: string,
  readonly values: ReadonlyArray<unknown>
}

export const toPostgresQuery = ({ strings, values }: SqlFragment<Compiled>): PostgresQuery =>
  ({ text: joinWithPlaceholders(strings), values })

const joinWithPlaceholders = (ss: ReadonlyArray<string>): string =>
  ss.reduce((sql, s, i) => `${sql}$${i}${s}`)

//
// MySQL Dialect
//
type MySqlQuery = {
  readonly sql: string,
  readonly values: ReadonlyArray<unknown>
}

export const toMySqlQuery = ({ strings, values }: SqlFragment<Compiled>): MySqlQuery =>
  ({ sql: strings.join('?'), values })
