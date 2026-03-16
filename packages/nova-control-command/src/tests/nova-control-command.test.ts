/*******************************************************************************
*                                                                              *
*                   nova-control-command — integration tests                   *
*                                                                              *
*******************************************************************************/

// covers: CMD (servo commands) and ERR (error handling)
// uses a mocked openNova — no physical serial port required

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

//----------------------------------------------------------------------------//
//                              Module Mocks                                  //
//----------------------------------------------------------------------------//

/**** hoisted variables shared between vi.mock factories and test bodies ****/

const Hoisted = vi.hoisted(() => {
  let LastStateUpdate:Record<string,number>|undefined

  const MockNova = {
    home:           vi.fn().mockResolvedValue(undefined),
    sendServoState: vi.fn().mockResolvedValue(undefined),
    destroy:        vi.fn(),

    get State () {
      return { s1:90, s2:90, s3:110, s4:90, s5:95 }
    },
    set State (Update:Record<string,number>) {
      LastStateUpdate = Update
    },
  }

  const openNova = vi.fn().mockResolvedValue(MockNova)

  return {
    MockNova,
    openNova,
    get LastStateUpdate () { return LastStateUpdate },
    clearLastStateUpdate () { LastStateUpdate = undefined },
  }
})

vi.mock('nova-control-node', () => ({
  openNova: Hoisted.openNova,
}))

//----------------------------------------------------------------------------//
//                          Subject Under Test                                //
//----------------------------------------------------------------------------//

import {
  executeTokens,
  _setupForTests,
  _destroyForTests,
} from '../nova-control-command.js'

//----------------------------------------------------------------------------//
//                               Setup                                        //
//----------------------------------------------------------------------------//

beforeEach(() => {
  _setupForTests('/dev/test')
  vi.clearAllMocks()
  Hoisted.clearLastStateUpdate()
})

afterEach(() => {
  _destroyForTests()
})

//----------------------------------------------------------------------------//
//                                 Tests                                      //
//----------------------------------------------------------------------------//

describe('servo commands (CMD)', () => {

/**** CMD-01: home ****/

  it('CMD-01: home calls Nova.home() and returns exit code 0', async () => {
    const Code = await executeTokens(['home'])
    expect(Code).toBe(0)
    expect(Hoisted.MockNova.home).toHaveBeenCalledOnce()
  })

/**** CMD-02 – CMD-06: individual servo commands ****/

  it('CMD-02: shift-to sets s1 and calls sendServoState()', async () => {
    const Code = await executeTokens(['shift-to', '100'])
    expect(Code).toBe(0)
    expect(Hoisted.LastStateUpdate).toEqual({ s1:100 })
    expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
  })

  it('CMD-03: roll-to sets s2 and calls sendServoState()', async () => {
    const Code = await executeTokens(['roll-to', '60'])
    expect(Code).toBe(0)
    expect(Hoisted.LastStateUpdate).toEqual({ s2:60 })
    expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
  })

  it('CMD-04: pitch-to sets s3 and calls sendServoState()', async () => {
    const Code = await executeTokens(['pitch-to', '80'])
    expect(Code).toBe(0)
    expect(Hoisted.LastStateUpdate).toEqual({ s3:80 })
    expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
  })

  it('CMD-05: rotate-to sets s4 and calls sendServoState()', async () => {
    const Code = await executeTokens(['rotate-to', '120'])
    expect(Code).toBe(0)
    expect(Hoisted.LastStateUpdate).toEqual({ s4:120 })
    expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
  })

  it('CMD-06: lift-to sets s5 and calls sendServoState()', async () => {
    const Code = await executeTokens(['lift-to', '90'])
    expect(Code).toBe(0)
    expect(Hoisted.LastStateUpdate).toEqual({ s5:90 })
    expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
  })

/**** CMD-07 – CMD-09: move ****/

  it('CMD-07: move --shift-to sets s1 and calls sendServoState()', async () => {
    const Code = await executeTokens(['move', '--shift-to', '100'])
    expect(Code).toBe(0)
    expect(Hoisted.LastStateUpdate).toEqual({ s1:100 })
    expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
  })

  it('CMD-08: move --shift-to and --rotate-to sets both servos in one packet', async () => {
    const Code = await executeTokens(['move', '--shift-to', '100', '--rotate-to', '120'])
    expect(Code).toBe(0)
    expect(Hoisted.LastStateUpdate).toEqual({ s1:100, s4:120 })
    expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
  })

  it('CMD-09: move without any servo option returns exit code 2', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const Code = await executeTokens(['move'])
    expect(Code).toBe(2)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('--shift-to'))
    stderrSpy.mockRestore()
  })

/**** CMD-10 – CMD-13: wait ****/

  it('CMD-10: wait 100 resolves after ~100 ms and returns exit code 0', async () => {
    vi.useFakeTimers()
    const WaitPromise = executeTokens(['wait', '100'])
    vi.advanceTimersByTime(100)
    const Code = await WaitPromise
    expect(Code).toBe(0)
    vi.useRealTimers()
  })

  it('CMD-11: wait 0 resolves immediately and returns exit code 0', async () => {
    vi.useFakeTimers()
    const WaitPromise = executeTokens(['wait', '0'])
    vi.advanceTimersByTime(0)
    const Code = await WaitPromise
    expect(Code).toBe(0)
    vi.useRealTimers()
  })

  it('CMD-12: wait -1 returns exit code 2 with an error message', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const Code = await executeTokens(['wait', '-1'])
    expect(Code).toBe(2)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('-1'))
    stderrSpy.mockRestore()
  })

  it('CMD-13: wait abc returns exit code 2 with an error message', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const Code = await executeTokens(['wait', 'abc'])
    expect(Code).toBe(2)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('abc'))
    stderrSpy.mockRestore()
  })

/**** CMD-14: state ****/

  it('CMD-14: state writes a JSON object with all five servo keys to stdout', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const Code = await executeTokens(['state'])
    expect(Code).toBe(0)
    const Written = (stdoutSpy.mock.calls[0]?.[0] as string) ?? ''
    const Parsed  = JSON.parse(Written)
    expect(Parsed).toMatchObject({ s1:expect.any(Number), s2:expect.any(Number),
      s3:expect.any(Number), s4:expect.any(Number), s5:expect.any(Number) })
    stdoutSpy.mockRestore()
  })

})

describe('error handling (ERR)', () => {

/**** ERR-01: unknown command ****/

  it('ERR-01: an unknown command returns exit code 2 and writes an error to stderr', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const Code = await executeTokens(['fly'])
    expect(Code).toBe(2)
    expect(stderrSpy).toHaveBeenCalled()
    stderrSpy.mockRestore()
  })

/**** ERR-02: shift-to without argument ****/

  it('ERR-02: shift-to without argument returns exit code 2 and writes an error', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const Code = await executeTokens(['shift-to'])
    expect(Code).toBe(2)
    expect(stderrSpy).toHaveBeenCalled()
    stderrSpy.mockRestore()
  })

/**** ERR-03: openNova rejection ****/

  it('ERR-03: a rejected openNova propagates as exit code 1 with an error on stderr', async () => {
    Hoisted.openNova.mockRejectedValueOnce(new Error('port not found'))
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const Code = await executeTokens(['home'])
    expect(Code).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('port not found'))
    stderrSpy.mockRestore()
  })

})
