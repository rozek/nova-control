/*******************************************************************************
*                                                                              *
*               nova-control-browser — packet builder tests (P)                   *
*                                                                              *
*******************************************************************************/

import { describe, it, expect } from 'vitest'
import { HomePosition, buildDirectPacket } from '../nova-control-browser.js'

//----------------------------------------------------------------------------//
//                             packet builder (P)                             //
//----------------------------------------------------------------------------//

describe('packet builder (P)', () => {

/**** P-01..02: buildDirectPacket(HomePosition) ****/

  it('P-01: buildDirectPacket(HomePosition) has length 5', () => {
    expect(buildDirectPacket(HomePosition)).toHaveLength(5)
  })

  it('P-02: buildDirectPacket(HomePosition) equals Uint8Array([90,110,90,90,95])', () => {
    expect(buildDirectPacket(HomePosition)).toEqual(new Uint8Array([90,110,90,90,95]))
  })

/**** P-03..07: byte order ****/

  it('P-03: byte 0 carries s4', () => {
    expect(buildDirectPacket({ ...HomePosition, s4:45 })[0]).toBe(45)
  })

  it('P-04: byte 1 carries s3', () => {
    expect(buildDirectPacket({ ...HomePosition, s3:100 })[1]).toBe(100)
  })

  it('P-05: byte 2 carries s2', () => {
    expect(buildDirectPacket({ ...HomePosition, s2:60 })[2]).toBe(60)
  })

  it('P-06: byte 3 carries s1', () => {
    expect(buildDirectPacket({ ...HomePosition, s1:120 })[3]).toBe(120)
  })

  it('P-07: byte 4 carries s5', () => {
    expect(buildDirectPacket({ ...HomePosition, s5:110 })[4]).toBe(110)
  })

/**** P-08..10: clamping — below minimum ****/

  it('P-08: s1 = 0 is clamped to minimum 45 (byte 3)', () => {
    expect(buildDirectPacket({ ...HomePosition, s1:0 })[3]).toBe(45)
  })

  it('P-09: s3 = 0 is clamped to minimum 40 (byte 1)', () => {
    expect(buildDirectPacket({ ...HomePosition, s3:0 })[1]).toBe(40)
  })

  it('P-10: s5 = 0 is clamped to minimum 20 (byte 4)', () => {
    expect(buildDirectPacket({ ...HomePosition, s5:0 })[4]).toBe(20)
  })

/**** P-11..12: clamping — above maximum ****/

  it('P-11: s1 = 255 is clamped to maximum 135 (byte 3)', () => {
    expect(buildDirectPacket({ ...HomePosition, s1:255 })[3]).toBe(135)
  })

  it('P-12: s5 = 255 is clamped to maximum 150 (byte 4)', () => {
    expect(buildDirectPacket({ ...HomePosition, s5:255 })[4]).toBe(150)
  })

/**** P-13..14: boundary values pass through ****/

  it('P-13: s1 = 45 (lower boundary) passes through', () => {
    expect(buildDirectPacket({ ...HomePosition, s1:45 })[3]).toBe(45)
  })

  it('P-14: s1 = 135 (upper boundary) passes through', () => {
    expect(buildDirectPacket({ ...HomePosition, s1:135 })[3]).toBe(135)
  })

/**** P-15..16: rounding ****/

  it('P-15: s1 = 90.6 rounds to 91', () => {
    expect(buildDirectPacket({ ...HomePosition, s1:90.6 })[3]).toBe(91)
  })

  it('P-16: s1 = 90.4 rounds to 90', () => {
    expect(buildDirectPacket({ ...HomePosition, s1:90.4 })[3]).toBe(90)
  })

})
