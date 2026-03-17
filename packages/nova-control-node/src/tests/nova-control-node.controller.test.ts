/*******************************************************************************
*                                                                              *
*              nova-control-node — transport + controller tests (T/C)          *
*                                                                              *
*******************************************************************************/

// uses a mocked serialport — no physical port required

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

//----------------------------------------------------------------------------//
//                              module mocks                                  //
//----------------------------------------------------------------------------//

/**** Hoisted — shared mock objects, available in vi.mock factory ****/

const Hoisted = vi.hoisted(() => {
  type Cb  = (e:Error|null) => void
  type WCb = (e:Error|null) => void

  const Port = {
    open:  vi.fn((cb:Cb)                  => cb(null)),
    write: vi.fn((_data:Buffer, cb:WCb)  => cb(null)),
    drain: vi.fn((cb:Cb)                  => cb(null)),
    close: vi.fn(),
  }

  // must be a regular function — arrow functions cannot be used with `new`
  const MockSerialPort = vi.fn().mockImplementation(function () { return Port })

  return { Port, MockSerialPort }
})

vi.mock('serialport', () => ({ SerialPort: Hoisted.MockSerialPort }))

//----------------------------------------------------------------------------//
//                           subject under test                               //
//----------------------------------------------------------------------------//

import { openNova, HomePosition, BaudRate, type NovaController } from '../nova-control-node.js'

//----------------------------------------------------------------------------//
//                              helpers                                       //
//----------------------------------------------------------------------------//

/**** resetPortMocks — restores all port spy implementations to defaults ****/

function resetPortMocks ():void {
  Hoisted.Port.open.mockReset().mockImplementation((cb:(e:null) => void) => cb(null))
  Hoisted.Port.write.mockReset().mockImplementation((_d:Buffer, cb:(e:null) => void) => cb(null))
  Hoisted.Port.drain.mockReset().mockImplementation((cb:(e:null) => void) => cb(null))
  Hoisted.Port.close.mockReset()
  Hoisted.MockSerialPort.mockReset().mockImplementation(function () { return Hoisted.Port })
}

/**** writtenBytes — returns the Uint8Array from the nth Port.write call ****/

function writtenBytes (CallIndex:number = 0):Uint8Array {
  return new Uint8Array(Hoisted.Port.write.mock.calls[CallIndex][0] as Buffer)
}

//----------------------------------------------------------------------------//
//                             transport (T)                                  //
//----------------------------------------------------------------------------//

describe('transport (T)', () => {

  beforeEach(() => { resetPortMocks() })

/**** T-01: correct SerialPort options ****/

  it('T-01: SerialPort constructed with path, baudRate 9600, autoOpen false', async () => {
    vi.useFakeTimers()
    const P = openNova('/dev/ttyACM0')
    await vi.advanceTimersByTimeAsync(2000)
    const Nova = await P
    expect(Hoisted.MockSerialPort).toHaveBeenCalledWith(
      { path:'/dev/ttyACM0', baudRate:9600, autoOpen:false }
    )
    Nova.destroy()
    vi.useRealTimers()
  })

/**** T-02: baud rate override ****/

  it('T-02: baud rate override is forwarded to SerialPort', async () => {
    vi.useFakeTimers()
    const P = openNova('/dev/ttyACM0', 115200)
    await vi.advanceTimersByTimeAsync(2000)
    const Nova = await P
    expect(Hoisted.MockSerialPort).toHaveBeenCalledWith(
      expect.objectContaining({ baudRate:115200 })
    )
    Nova.destroy()
    vi.useRealTimers()
  })

/**** T-03: Port.open called once ****/

  it('T-03: Port.open is called exactly once during openNova', async () => {
    vi.useFakeTimers()
    const P = openNova('/dev/ttyACM0')
    await vi.advanceTimersByTimeAsync(2000)
    const Nova = await P
    expect(Hoisted.Port.open).toHaveBeenCalledOnce()
    Nova.destroy()
    vi.useRealTimers()
  })

/**** T-04: Port.open error causes rejection ****/

  it('T-04: Port.open error causes openNova to reject', async () => {
    Hoisted.Port.open.mockReset().mockImplementation(
      (cb:(e:Error) => void) => cb(new Error('open failed'))
    )
    vi.useFakeTimers()
    await expect(openNova('/dev/ttyACM0')).rejects.toThrow('open failed')
    vi.useRealTimers()
  })

/**** T-05: reset delay (fake timers) ****/

  it('T-05: promise pending after 1999 ms and resolves at exactly 2000 ms', async () => {
    vi.useFakeTimers()
    const P = openNova('/dev/ttyACM0')

    let Resolved = false
    void P.then(() => { Resolved = true })

    await vi.advanceTimersByTimeAsync(1999)
    expect(Resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const Nova = await P
    expect(Resolved).toBe(true)
    expect(Nova).toBeDefined()

    Nova.destroy()
    vi.useRealTimers()
  })

/**** T-06: write callback fires before drain ****/

  it('T-06: Port.drain is not called until Port.write callback fires', async () => {
    vi.useFakeTimers()
    const P = openNova('/dev/ttyACM0')
    await vi.advanceTimersByTimeAsync(2000)
    const TestNova = await P
    vi.useRealTimers()

    // defer write callback — use regular function so it can be called with new
    let TriggerWrite:(()=>void)|undefined
    Hoisted.Port.write.mockReset().mockImplementation(
      function (_d:Buffer, cb:(e:null) => void) { TriggerWrite = () => cb(null) }
    )
    Hoisted.Port.drain.mockReset().mockImplementation(
      function (cb:(e:null) => void) { cb(null) }
    )

    const HomePromise = TestNova.home()

    // flush microtasks so the async promise chain advances to the Port.write call:
    // home() → flushPending() → await Previous (1 flush) → Transport.write() → Port.write called
    await Promise.resolve()
    await Promise.resolve()

    expect(TriggerWrite).toBeDefined()
    expect(Hoisted.Port.drain).not.toHaveBeenCalled()

    TriggerWrite!()
    await HomePromise
    expect(Hoisted.Port.drain).toHaveBeenCalledOnce()

    TestNova.destroy()
  })

/**** T-07: Port.write error causes rejection ****/

  it('T-07: Port.write error causes controller method to reject', async () => {
    vi.useFakeTimers()
    const P = openNova('/dev/ttyACM0')
    await vi.advanceTimersByTimeAsync(2000)
    const TestNova = await P
    vi.useRealTimers()

    Hoisted.Port.write.mockReset().mockImplementation(
      (_d:Buffer, cb:(e:Error) => void) => cb(new Error('write failed'))
    )

    await expect(TestNova.home()).rejects.toThrow('write failed')
    TestNova.destroy()
  })

})

//----------------------------------------------------------------------------//
//                            controller (C)                                  //
//----------------------------------------------------------------------------//

describe('controller (C)', () => {

  let Nova: NovaController

  beforeEach(async () => {
    resetPortMocks()
    vi.useFakeTimers()
    const P = openNova('/dev/test', BaudRate, { StepIntervalMs:0 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    // clear call history accumulated during openNova
    Hoisted.Port.write.mockClear()
    Hoisted.Port.drain.mockClear()
    Hoisted.Port.open.mockClear()
  })

  afterEach(() => {
    Nova.destroy()
  })

/**** C-01: initial state equals HomePosition ****/

  it('C-01: Nova.State immediately after openNova equals HomePosition', () => {
    expect(Nova.State).toEqual({ s1:90, s2:90, s3:110, s4:90, s5:95 })
  })

/**** C-02: State getter returns a deep copy ****/

  it('C-02: mutating the returned State does not affect the next read', () => {
    const S = Nova.State
    S.s1 = 999
    expect(Nova.State.s1).toBe(90)
  })

/**** C-03: home writes correct bytes ****/

  it('C-03: home() writes bytes equal to buildDirectPacket(HomePosition)', async () => {
    await Nova.home()
    expect(writtenBytes()).toEqual(new Uint8Array([90,110,90,90,95]))
  })

/**** C-04: State after home equals HomePosition ****/

  it('C-04: Nova.State after home() equals HomePosition', async () => {
    await Nova.home()
    expect(Nova.State).toEqual(HomePosition)
  })

/**** C-05: shiftHeadTo sets byte 3 ****/

  it('C-05: shiftHeadTo(120) sets byte 3 = 120, others from last-sent state', async () => {
    await Nova.shiftHeadTo(120)
    const W = writtenBytes()
    expect(W[3]).toBe(120)
    expect(W[0]).toBe(90)   // s4 from HomePosition
    expect(W[1]).toBe(110)  // s3
    expect(W[2]).toBe(90)   // s2
    expect(W[4]).toBe(95)   // s5
  })

/**** C-06: rollHeadTo sets byte 2 ****/

  it('C-06: rollHeadTo(60) sets byte 2 = 60', async () => {
    await Nova.rollHeadTo(60)
    expect(writtenBytes()[2]).toBe(60)
  })

/**** C-07: pitchHeadTo sets byte 1 ****/

  it('C-07: pitchHeadTo(130) sets byte 1 = 130', async () => {
    await Nova.pitchHeadTo(130)
    expect(writtenBytes()[1]).toBe(130)
  })

/**** C-08: rotateBodyTo sets byte 0 ****/

  it('C-08: rotateBodyTo(45) sets byte 0 = 45', async () => {
    await Nova.rotateBodyTo(45)
    expect(writtenBytes()[0]).toBe(45)
  })

/**** C-09: liftHeadTo sets byte 4 ****/

  it('C-09: liftHeadTo(110) sets byte 4 = 110', async () => {
    await Nova.liftHeadTo(110)
    expect(writtenBytes()[4]).toBe(110)
  })

/**** C-10: named methods accumulate on PendingState ****/

  it('C-10: shiftHeadTo+rollHeadTo without await yields one combined packet', async () => {
    const P1 = Nova.shiftHeadTo(120)
    const P2 = Nova.rollHeadTo(60)
    await Promise.all([P1, P2])

    // only one packet should have been sent
    expect(Hoisted.Port.write).toHaveBeenCalledOnce()
    const W = writtenBytes()
    expect(W[3]).toBe(120)  // s1
    expect(W[2]).toBe(60)   // s2
  })

/**** C-11: State setter — packet contains s1=120, others from last-sent ****/

  it('C-11: State setter + sendServoState sends s1=120 with others from last-sent', async () => {
    Nova.State = { s1:120 }
    await Nova.sendServoState()
    const W = writtenBytes()
    expect(W[3]).toBe(120)  // s1
    expect(W[0]).toBe(90)   // s4 = HomePosition.s4 (last-sent)
    expect(W[1]).toBe(110)  // s3
    expect(W[2]).toBe(90)   // s2
    expect(W[4]).toBe(95)   // s5
  })

/**** C-12: second State setter discards first — s4 stays at last-sent value ****/

  it('C-12: second State setter starts fresh; s4 stays at last-sent value (not 120)', async () => {
    Nova.State = { s4:120 }           // first setter: PendingState = { ...HP, s4:120 }
    Nova.State = { s1:100 }           // second setter: fresh from CurrentState
    await Nova.sendServoState()
    const W = writtenBytes()
    expect(W[3]).toBe(100)  // s1
    expect(W[0]).toBe(90)   // s4 = HomePosition.s4, not 120
  })

/**** C-13: destroy calls Port.close ****/

  it('C-13: destroy() calls Port.close exactly once', () => {
    Nova.destroy()
    expect(Hoisted.Port.close).toHaveBeenCalledOnce()
  })

})

//----------------------------------------------------------------------------//
//                       timed movement (TM)                                 //
//----------------------------------------------------------------------------//

describe('timed movement (TM)', () => {

  let Nova: NovaController

  afterEach(() => {
    Nova.destroy()
  })

/**** TM-01: moveTo without withinMS sends exactly one packet ****/

  it('TM-01: moveTo without withinMS sends exactly one packet', async () => {
    resetPortMocks()
    vi.useFakeTimers()
    const P = openNova('/dev/test', BaudRate, { StepIntervalMs:0 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.Port.write.mockClear()

    await Nova.moveTo({ s1:120 })
    expect(Hoisted.Port.write).toHaveBeenCalledOnce()
    expect(writtenBytes()[3]).toBe(120)
  })

/**** TM-02: moveTo with withinMS sends multiple packets ****/

  it('TM-02: moveTo with withinMS sends multiple packets', async () => {
    resetPortMocks()
    vi.useFakeTimers()
    const P = openNova('/dev/test', BaudRate, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.Port.write.mockClear()

    await Nova.moveTo({ s1:120 }, 5)
    expect(Hoisted.Port.write.mock.calls.length).toBeGreaterThan(1)
  })

/**** TM-03: shiftHeadTo with withinMS sends multiple packets ****/

  it('TM-03: shiftHeadTo with withinMS sends multiple packets', async () => {
    resetPortMocks()
    vi.useFakeTimers()
    const P = openNova('/dev/test', BaudRate, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.Port.write.mockClear()

    await Nova.shiftHeadTo(120, 5)
    expect(Hoisted.Port.write.mock.calls.length).toBeGreaterThan(1)
  })

/**** TM-04: home with withinMS sends multiple packets ****/

  it('TM-04: home with withinMS sends multiple packets', async () => {
    resetPortMocks()
    vi.useFakeTimers()
    const P = openNova('/dev/test', BaudRate, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.Port.write.mockClear()

    await Nova.home(200)
    expect(Hoisted.Port.write.mock.calls.length).toBeGreaterThan(1)
  })

/**** TM-05: first timed packet is between start and target (ramp-up) ****/

  it('TM-05: first timed packet is between start and target (ramp-up effect)', async () => {
    resetPortMocks()
    vi.useFakeTimers()
    const P = openNova('/dev/test', BaudRate, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.Port.write.mockClear()

    await Nova.moveTo({ s1:120 }, 10)
    const FirstPacket = writtenBytes(0)
    const s1Value = FirstPacket[3]
    // start is 90, target is 120; first step should be between them
    expect(s1Value).toBeGreaterThan(90)
    expect(s1Value).toBeLessThan(120)
  })

/**** TM-06: last timed packet reaches exact target ****/

  it('TM-06: last timed packet reaches exact target angle', async () => {
    resetPortMocks()
    vi.useFakeTimers()
    const P = openNova('/dev/test', BaudRate, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.Port.write.mockClear()

    await Nova.moveTo({ s1:120 }, 5)
    const CallCount = Hoisted.Port.write.mock.calls.length
    const LastPacket = writtenBytes(CallCount - 1)
    expect(LastPacket[3]).toBe(120)
  })

/**** TM-07: trapezoidEasing symmetry — midpoint near 50% of travel ****/

  it('TM-07: symmetric trapezoid: midpoint packet near 50% of travel', async () => {
    resetPortMocks()
    vi.useFakeTimers()
    const P = openNova('/dev/test', BaudRate, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.Port.write.mockClear()

    // move from 90 to 190 (100° travel) over 100 ms
    await Nova.moveTo({ s1:190 }, 100)
    const CallCount = Hoisted.Port.write.mock.calls.length
    const MidIndex = Math.floor(CallCount / 2)
    const MidPacket = writtenBytes(MidIndex)
    const MidValue = MidPacket[3]
    // expecting roughly 140° (90 + 50), allowing ±5° tolerance
    expect(MidValue).toBeGreaterThanOrEqual(135)
    expect(MidValue).toBeLessThanOrEqual(145)
  })

})
