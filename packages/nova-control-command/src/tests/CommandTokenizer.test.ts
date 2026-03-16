/*******************************************************************************
*                                                                              *
*                       CommandTokenizer — unit tests                          *
*                                                                              *
*******************************************************************************/

// covers: CT (command tokeniser)

import { describe, it, expect } from 'vitest'
import { tokenizeLine } from '../CommandTokenizer.js'

describe('tokenizeLine (CT)', () => {

  it('CT-01: returns an empty array for an empty line', () => {
    expect(tokenizeLine('')).toEqual([])
  })

  it('CT-02: returns an empty array for a whitespace-only line', () => {
    expect(tokenizeLine('   ')).toEqual([])
  })

  it('CT-03: splits simple whitespace-separated tokens', () => {
    expect(tokenizeLine('shift-to 100')).toEqual(['shift-to', '100'])
  })

  it('CT-04: handles multiple spaces between tokens', () => {
    expect(tokenizeLine('move   --shift-to   100')).toEqual(
      ['move', '--shift-to', '100']
    )
  })

  it('CT-05: handles double-quoted strings', () => {
    expect(tokenizeLine('"hello world"')).toEqual(['hello world'])
  })

  it('CT-06: handles single-quoted strings', () => {
    expect(tokenizeLine("'foo bar'")).toEqual(['foo bar'])
  })

  it('CT-07: unclosed quote merges the remaining input into the last token', () => {
    expect(tokenizeLine('"hello')).toEqual(['hello'])
  })

  it('CT-08: handles backslash-escaped space outside quotes', () => {
    expect(tokenizeLine('shift-to\\ 100')).toEqual(['shift-to 100'])
  })

  it('CT-09: handles backslash-escaped double-quote outside quotes', () => {
    expect(tokenizeLine('\\"quoted\\"')).toEqual(['"quoted"'])
  })

  it('CT-10: handles backslash-escaped double-quote inside a double-quoted string', () => {
    expect(tokenizeLine('--label "say \\"hi\\""')).toEqual(['--label', 'say "hi"'])
  })

  it('CT-11: strips inline comments starting with #', () => {
    expect(tokenizeLine('shift-to 100 # set head forward')).toEqual(
      ['shift-to', '100']
    )
  })

  it('CT-12: treats a line starting with # as a comment', () => {
    expect(tokenizeLine('# this is a comment')).toEqual([])
  })

  it('CT-13: handles tabs as whitespace', () => {
    expect(tokenizeLine('shift-to\t100')).toEqual(['shift-to', '100'])
  })

})
