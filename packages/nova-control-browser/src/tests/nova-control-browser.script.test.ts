/*******************************************************************************
*                                                                              *
*             nova-control-browser — runScript tests (RS)                      *
*                                                                              *
*******************************************************************************/

// tests runScript using a mock NovaController — no Web Serial port required

import { describe, it, expect, vi } from 'vitest'
import { runScript, type NovaController, type ServoUpdate } from '../nova-control-browser.js'

//----------------------------------------------------------------------------//
//                              mock controller                               //
//----------------------------------------------------------------------------//

/**** makeMockNova — creates a fresh mock NovaController for each test ****/

function makeMockNova () {
  const Mock = {
    home:           vi.fn().mockResolvedValue(undefined),
    shiftHeadTo:    vi.fn().mockResolvedValue(undefined),
    rollHeadTo:     vi.fn().mockResolvedValue(undefined),
    pitchHeadTo:    vi.fn().mockResolvedValue(undefined),
    rotateBodyTo:   vi.fn().mockResolvedValue(undefined),
    liftHeadTo:     vi.fn().mockResolvedValue(undefined),
    moveTo:         vi.fn().mockResolvedValue(undefined),
    sendServoState: vi.fn().mockResolvedValue(undefined),
    destroy:        vi.fn(),
    get State ()              { return { s1:90, s2:90, s3:110, s4:90, s5:95 } },
    set State (_:ServoUpdate) { /* no-op in mock */ },
  }

  return { Mock }
}

//----------------------------------------------------------------------------//
//                               tests                                        //
//----------------------------------------------------------------------------//

describe('runScript (RS)', () => {

/**** RS-01: empty script — no method called ****/

  it('RS-01: empty script resolves without calling any controller method', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, '')
    expect(Mock.home).not.toHaveBeenCalled()
    expect(Mock.moveTo).not.toHaveBeenCalled()
  })

/**** RS-02: blank lines and comment lines are skipped ****/

  it('RS-02: blank lines and comment lines are skipped without calling any method', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, '   \n# a comment\n\n# another\n')
    expect(Mock.home).not.toHaveBeenCalled()
    expect(Mock.moveTo).not.toHaveBeenCalled()
  })

/**** RS-03: home ****/

  it('RS-03: home calls Nova.home() with undefined within_ms', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, 'home')
    expect(Mock.home).toHaveBeenCalledWith(undefined)
  })

  it('RS-03b: home 500 calls Nova.home() with within_ms = 500', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, 'home 500')
    expect(Mock.home).toHaveBeenCalledWith(500)
  })

/**** RS-04: shift-to ****/

  it('RS-04: shift-to 100 calls Nova.shiftHeadTo(100, undefined)', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, 'shift-to 100')
    expect(Mock.shiftHeadTo).toHaveBeenCalledWith(100, undefined)
  })

  it('RS-04b: shift-to 100 800 calls Nova.shiftHeadTo(100, 800)', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, 'shift-to 100 800')
    expect(Mock.shiftHeadTo).toHaveBeenCalledWith(100, 800)
  })

/**** RS-05: roll-to ****/

  it('RS-05: roll-to 60 calls Nova.rollHeadTo(60, undefined)', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, 'roll-to 60')
    expect(Mock.rollHeadTo).toHaveBeenCalledWith(60, undefined)
  })

/**** RS-06: pitch-to ****/

  it('RS-06: pitch-to 80 calls Nova.pitchHeadTo(80, undefined)', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, 'pitch-to 80')
    expect(Mock.pitchHeadTo).toHaveBeenCalledWith(80, undefined)
  })

/**** RS-07: rotate-to ****/

  it('RS-07: rotate-to 120 calls Nova.rotateBodyTo(120, undefined)', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, 'rotate-to 120')
    expect(Mock.rotateBodyTo).toHaveBeenCalledWith(120, undefined)
  })

/**** RS-08: lift-to ****/

  it('RS-08: lift-to 30 calls Nova.liftHeadTo(30, undefined)', async () => {
    const { Mock } = makeMockNova()
    await runScript(Mock as unknown as NovaController, 'lift-to 30')
    expect(Mock.liftHeadTo).toHaveBeenCalledWith(30, undefined)
  })

/**** RS-09: move with two servo args ****/

  it('RS-09: move shift-to 100 rotate-to 120 calls Nova.moveTo() with both servos', async () => {
    const { Mock } = makeMockNova()
    await runScript(
      Mock as unknown as NovaController,
      'move shift-to 100 rotate-to 120'
    )
    expect(Mock.moveTo).toHaveBeenCalledWith({ s1:100, s4:120 }, undefined)
  })

  it('RS-09b: move shift-to 100 within-ms 600 calls Nova.moveTo() with within_ms', async () => {
    const { Mock } = makeMockNova()
    await runScript(
      Mock as unknown as NovaController,
      'move shift-to 100 within-ms 600'
    )
    expect(Mock.moveTo).toHaveBeenCalledWith({ s1:100 }, 600)
  })

/**** RS-10: wait ****/

  it('RS-10: wait 0 resolves without error', async () => {
    const { Mock } = makeMockNova()
    await expect(
      runScript(Mock as unknown as NovaController, 'wait 0')
    ).resolves.toBeUndefined()
  })

/**** RS-11: multi-line script — each command awaited before next begins ****/

  it('RS-11: multi-line script executes commands in order', async () => {
    const { Mock } = makeMockNova()
    const Calls:string[] = []
    Mock.home.mockImplementation(() => {
      Calls.push('home')
      return Promise.resolve()
    })
    Mock.shiftHeadTo.mockImplementation((d:number) => {
      Calls.push(`shift-to ${d}`)
      return Promise.resolve()
    })
    await runScript(Mock as unknown as NovaController, 'home\nshift-to 100')
    expect(Calls).toEqual([ 'home', 'shift-to 100' ])
  })

/**** RS-12: unknown command — error with line number ****/

  it('RS-12: unknown command throws an error containing the line number', async () => {
    const { Mock } = makeMockNova()
    await expect(
      runScript(Mock as unknown as NovaController, '# ok\nunknown-cmd')
    ).rejects.toThrow('line 2')
  })

/**** RS-13: non-numeric angle — error with line number ****/

  it('RS-13: shift-to with a non-numeric argument throws with the line number', async () => {
    const { Mock } = makeMockNova()
    await expect(
      runScript(Mock as unknown as NovaController, 'shift-to abc')
    ).rejects.toThrow('line 1')
  })

/**** RS-14: move with no servo args — error with line number ****/

  it('RS-14: move with no servo args throws with the line number', async () => {
    const { Mock } = makeMockNova()
    await expect(
      runScript(Mock as unknown as NovaController, 'move')
    ).rejects.toThrow('line 1')
  })

/**** RS-15: wait with negative value — error with line number ****/

  it('RS-15: wait with a negative value throws with the line number', async () => {
    const { Mock } = makeMockNova()
    await expect(
      runScript(Mock as unknown as NovaController, 'wait -1')
    ).rejects.toThrow('line 1')
  })

})
