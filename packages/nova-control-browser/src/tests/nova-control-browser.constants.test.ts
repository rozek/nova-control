/*******************************************************************************
*                                                                              *
*              nova-control-browser — protocol constants tests (K)                *
*                                                                              *
*******************************************************************************/

import { describe, it, expect } from 'vitest'
import { BaudRate, HomePosition, SafeRange, ServoSpeed } from '../nova-control-browser.js'

//----------------------------------------------------------------------------//
//                           protocol constants (K)                           //
//----------------------------------------------------------------------------//

describe('protocol constants (K)', () => {

/**** K-01: BaudRate ****/

  it('K-01: BaudRate equals 9600', () => {
    expect(BaudRate).toBe(9600)
  })

/**** K-02..06: HomePosition ****/

  it('K-02: HomePosition.s1 equals 90',  () => { expect(HomePosition.s1).toBe(90) })
  it('K-03: HomePosition.s2 equals 90',  () => { expect(HomePosition.s2).toBe(90) })
  it('K-04: HomePosition.s3 equals 110', () => { expect(HomePosition.s3).toBe(110) })
  it('K-05: HomePosition.s4 equals 90',  () => { expect(HomePosition.s4).toBe(90) })
  it('K-06: HomePosition.s5 equals 95',  () => { expect(HomePosition.s5).toBe(95) })

/**** K-07: HomePosition is frozen ****/

  it('K-07: HomePosition is frozen', () => {
    expect(Object.isFrozen(HomePosition)).toBe(true)
  })

/**** K-08..12: SafeRange ****/

  it('K-08: SafeRange.s1 equals [45,135]', () => { expect(SafeRange.s1).toEqual([45,135]) })
  it('K-09: SafeRange.s2 equals [10,170]',  () => { expect(SafeRange.s2).toEqual([10,170])  })
  it('K-10: SafeRange.s3 equals [40,150]', () => { expect(SafeRange.s3).toEqual([40,150]) })
  it('K-11: SafeRange.s4 equals [30,180]',  () => { expect(SafeRange.s4).toEqual([30,180])  })
  it('K-12: SafeRange.s5 equals [20,150]', () => { expect(SafeRange.s5).toEqual([20,150]) })

/**** K-13: SafeRange is frozen ****/

  it('K-13: SafeRange is frozen', () => {
    expect(Object.isFrozen(SafeRange)).toBe(true)
  })

/**** K-14..18: ServoSpeed — full range in 1 s ****/

  it('K-14: ServoSpeed.s1 = (135-45)/1000', () => { expect(ServoSpeed.s1).toBeCloseTo(0.09) })
  it('K-15: ServoSpeed.s2 = (170-10)/1000', () => { expect(ServoSpeed.s2).toBeCloseTo(0.16) })
  it('K-16: ServoSpeed.s3 = (150-40)/1000', () => { expect(ServoSpeed.s3).toBeCloseTo(0.11) })
  it('K-17: ServoSpeed.s4 = (180-30)/1000', () => { expect(ServoSpeed.s4).toBeCloseTo(0.15) })
  it('K-18: ServoSpeed.s5 = (150-20)/1000', () => { expect(ServoSpeed.s5).toBeCloseTo(0.13) })

/**** K-19: ServoSpeed is frozen ****/

  it('K-19: ServoSpeed is frozen', () => {
    expect(Object.isFrozen(ServoSpeed)).toBe(true)
  })

})
