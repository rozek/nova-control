/*******************************************************************************
*                                                                              *
*            nova-control-browser — transport + controller tests (T/C)         *
*                                                                              *
*******************************************************************************/

// uses a stubbed navigator.serial — no real Web Serial port required

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

//----------------------------------------------------------------------------//
//                              module mocks                                  //
//----------------------------------------------------------------------------//

/**** Hoisted — shared mock objects used to stub navigator.serial ****/

const Hoisted = vi.hoisted(() => {
  const MockWriter = {
    write:       vi.fn((_data:Uint8Array) => Promise.resolve()),
    releaseLock: vi.fn(),
  }

  const MockPort = {
    // must satisfy `instanceof EventTarget` — created per-test via Object.assign(new EventTarget, ...)
    open:     vi.fn(() => Promise.resolve()),
    close:    vi.fn(() => Promise.resolve()),
    writable: { getWriter:vi.fn(() => MockWriter) },
  }

  const MockSerial = {
    requestPort: vi.fn(() => Promise.resolve(MockPort)),
  }

  return { MockWriter, MockPort, MockSerial }
})

//----------------------------------------------------------------------------//
//                           subject under test                               //
//----------------------------------------------------------------------------//

import { openNova, HomePosition, type NovaController } from '../nova-control-browser.js'

//----------------------------------------------------------------------------//
//                              helpers                                       //
//----------------------------------------------------------------------------//

/**** resetMocks — clears and restores all mock implementations ****/

function resetMocks ():void {
  Hoisted.MockWriter.write.mockReset().mockImplementation(
    (_data:Uint8Array) => Promise.resolve()
  )
  Hoisted.MockWriter.releaseLock.mockReset()
  Hoisted.MockPort.open.mockReset().mockImplementation(() => Promise.resolve())
  Hoisted.MockPort.close.mockReset().mockImplementation(() => Promise.resolve())
  Hoisted.MockPort.writable.getWriter.mockReset().mockImplementation(
    () => Hoisted.MockWriter
  )
  Hoisted.MockSerial.requestPort.mockReset().mockImplementation(
    () => Promise.resolve(Hoisted.MockPort)
  )
}

/**** stubSerial — installs navigator.serial stub ****/

function stubSerial ():void {
  vi.stubGlobal('navigator', { serial: Hoisted.MockSerial })
}

/**** writtenBytes — returns the Uint8Array from the nth Writer.write call ****/

function writtenBytes (CallIndex:number = 0):Uint8Array {
  return Hoisted.MockWriter.write.mock.calls[CallIndex][0] as Uint8Array
}

//----------------------------------------------------------------------------//
//                             transport (T)                                  //
//----------------------------------------------------------------------------//

describe('transport (T)', () => {

  beforeEach(() => {
    resetMocks()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

/**** T-01: throws when navigator.serial absent ****/

  it('T-01: openNova() rejects when navigator.serial is absent', async () => {
    vi.stubGlobal('navigator', {})
    await expect(openNova()).rejects.toThrow('Web Serial API')
  })

/**** T-02: requestPort called once when no port given ****/

  it('T-02: requestPort called once when no port argument given', async () => {
    stubSerial()
    vi.useFakeTimers()
    const P = openNova()
    await vi.advanceTimersByTimeAsync(2000)
    const Nova = await P
    expect(Hoisted.MockSerial.requestPort).toHaveBeenCalledOnce()
    Nova.destroy()
    vi.useRealTimers()
  })

/**** T-03: requestPort NOT called when existing EventTarget port provided ****/

  it('T-03: requestPort not called when an existing port (EventTarget) is provided', async () => {
    stubSerial()
    vi.useFakeTimers()

    // the code checks `instanceof EventTarget` — must use a real EventTarget base
    const Port = Object.assign(new EventTarget(), {
      open:     vi.fn(() => Promise.resolve()),
      close:    vi.fn(() => Promise.resolve()),
      writable: { getWriter:() => Hoisted.MockWriter },
    })

    const P = openNova(Port as unknown as Parameters<typeof openNova>[0])
    await vi.advanceTimersByTimeAsync(2000)
    await P

    expect(Hoisted.MockSerial.requestPort).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

/**** T-04: port opened with correct baud rate ****/

  it('T-04: Port.open called with { baudRate: 9600 }', async () => {
    stubSerial()
    vi.useFakeTimers()
    const P = openNova()
    await vi.advanceTimersByTimeAsync(2000)
    const Nova = await P
    expect(Hoisted.MockPort.open).toHaveBeenCalledWith({ baudRate:9600 })
    Nova.destroy()
    vi.useRealTimers()
  })

/**** T-05: reset delay (fake timers) ****/

  it('T-05: promise pending after 1999 ms and resolves at exactly 2000 ms', async () => {
    stubSerial()
    vi.useFakeTimers()
    const P = openNova()

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

})

//----------------------------------------------------------------------------//
//                             controller (C)                                 //
//----------------------------------------------------------------------------//

describe('controller (C)', () => {

  let Nova: NovaController

  beforeEach(async () => {
    resetMocks()
    stubSerial()
    vi.useFakeTimers()
    const P = openNova(undefined, { StepIntervalMs:0 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    // clear call history from openNova setup
    Hoisted.MockWriter.write.mockClear()
    Hoisted.MockWriter.releaseLock.mockClear()
    Hoisted.MockPort.close.mockClear()
  })

  afterEach(() => {
    Nova.destroy()
    vi.unstubAllGlobals()
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

    expect(Hoisted.MockWriter.write).toHaveBeenCalledOnce()
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

/**** C-13: destroy calls Writer.releaseLock and Port.close ****/

  it('C-13: destroy() calls Writer.releaseLock() and Port.close()', () => {
    Nova.destroy()
    expect(Hoisted.MockWriter.releaseLock).toHaveBeenCalledOnce()
    expect(Hoisted.MockPort.close).toHaveBeenCalledOnce()
  })

/**** C-14: write after destroy is a no-op ****/

  it('C-14: write after destroy() is a no-op and does not throw', async () => {
    Nova.destroy()
    const WriteCount = Hoisted.MockWriter.write.mock.calls.length
    await expect(Nova.home()).resolves.toBeUndefined()
    expect(Hoisted.MockWriter.write.mock.calls.length).toBe(WriteCount)
  })

})

//----------------------------------------------------------------------------//
//                       timed movement (TM)                                 //
//----------------------------------------------------------------------------//

describe('timed movement (TM)', () => {

  let Nova: NovaController

  afterEach(() => {
    Nova.destroy()
    vi.unstubAllGlobals()
  })

/**** TM-01: moveTo without withinMS sends exactly one packet ****/

  it('TM-01: moveTo without withinMS sends exactly one packet', async () => {
    resetMocks()
    stubSerial()
    vi.useFakeTimers()
    const P = openNova(undefined, { StepIntervalMs:0 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.MockWriter.write.mockClear()

    await Nova.moveTo({ s1:120 })
    expect(Hoisted.MockWriter.write).toHaveBeenCalledOnce()
    expect(writtenBytes()[3]).toBe(120)
  })

/**** TM-02: moveTo with withinMS sends multiple packets ****/

  it('TM-02: moveTo with withinMS sends multiple packets', async () => {
    resetMocks()
    stubSerial()
    vi.useFakeTimers()
    const P = openNova(undefined, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.MockWriter.write.mockClear()

    await Nova.moveTo({ s1:120 }, 5)
    expect(Hoisted.MockWriter.write.mock.calls.length).toBeGreaterThan(1)
  })

/**** TM-03: shiftHeadTo with withinMS sends multiple packets ****/

  it('TM-03: shiftHeadTo with withinMS sends multiple packets', async () => {
    resetMocks()
    stubSerial()
    vi.useFakeTimers()
    const P = openNova(undefined, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.MockWriter.write.mockClear()

    await Nova.shiftHeadTo(120, 5)
    expect(Hoisted.MockWriter.write.mock.calls.length).toBeGreaterThan(1)
  })

/**** TM-04: home with withinMS sends multiple packets ****/

  it('TM-04: home with withinMS sends multiple packets', async () => {
    resetMocks()
    stubSerial()
    vi.useFakeTimers()
    const P = openNova(undefined, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.MockWriter.write.mockClear()

    await Nova.home(200)
    expect(Hoisted.MockWriter.write.mock.calls.length).toBeGreaterThan(1)
  })

/**** TM-05: first timed packet is between start and target (ramp-up) ****/

  it('TM-05: first timed packet is between start and target (ramp-up effect)', async () => {
    resetMocks()
    stubSerial()
    vi.useFakeTimers()
    const P = openNova(undefined, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.MockWriter.write.mockClear()

    await Nova.moveTo({ s1:120 }, 10)
    const FirstPacket = writtenBytes(0)
    const s1Value = FirstPacket[3]
    // start is 90, target is 120; first step should be between them
    expect(s1Value).toBeGreaterThan(90)
    expect(s1Value).toBeLessThan(120)
  })

/**** TM-06: last timed packet reaches exact target ****/

  it('TM-06: last timed packet reaches exact target angle', async () => {
    resetMocks()
    stubSerial()
    vi.useFakeTimers()
    const P = openNova(undefined, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.MockWriter.write.mockClear()

    await Nova.moveTo({ s1:120 }, 5)
    const CallCount = Hoisted.MockWriter.write.mock.calls.length
    const LastPacket = writtenBytes(CallCount - 1)
    expect(LastPacket[3]).toBe(120)
  })

/**** TM-07: trapezoidEasing symmetry — midpoint near 50% of travel ****/

  it('TM-07: symmetric trapezoid: midpoint packet near 50% of travel', async () => {
    resetMocks()
    stubSerial()
    vi.useFakeTimers()
    const P = openNova(undefined, { StepIntervalMs:1 })
    await vi.advanceTimersByTimeAsync(2000)
    Nova = await P
    vi.useRealTimers()
    Hoisted.MockWriter.write.mockClear()

    // move from 90 to 190 (100° travel) over 100 ms
    await Nova.moveTo({ s1:190 }, 100)
    const CallCount = Hoisted.MockWriter.write.mock.calls.length
    const MidIndex = Math.floor(CallCount / 2)
    const MidPacket = writtenBytes(MidIndex)
    const MidValue = MidPacket[3]
    // expecting roughly 140° (90 + 50), allowing ±5° tolerance
    expect(MidValue).toBeGreaterThanOrEqual(135)
    expect(MidValue).toBeLessThanOrEqual(145)
  })

})
