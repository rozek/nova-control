/*******************************************************************************
*                                                                              *
*                           nova-control-browser                               *
*                                                                              *
*******************************************************************************/

// ESM module for controlling the Creoqode Nova DIY AI Robot over USB serial
// from a browser using the Web Serial API (Chrome/Edge 89+).
//
// requires the matching Nova_SerialController.ino sketch on the Arduino
// (baud rate 9600, 8N1).
//
// usage (must be called from a user gesture):
//   import { openNova } from 'nova-control-browser'
//
//   button.addEventListener('click', async () => {
//     const Nova = await openNova()   // shows browser port picker
//     await Nova.home()
//     await Nova.rotateBodyTo(120)
//     Nova.destroy()
//   })
//
// setter-based usage (fire-and-forget with coalescing):
//   Nova.State = { s4:120 }
//   Nova.State = { s1:100 }   // merges with previous pending state
//   await Nova.sendServoState()

//----------------------------------------------------------------------------//
//                                   Types                                    //
//----------------------------------------------------------------------------//

/**** ServoKey ****/

  export type ServoKey = 's1' | 's2' | 's3' | 's4' | 's5'

/**** ServoState ****/

  export type ServoState = { [K in ServoKey]:number }

/**** ServoUpdate ****/

  export type ServoUpdate = Partial<ServoState>

/**** NovaController ****/

  export interface NovaController {
    home ():Promise<void>

    shiftHeadTo (Degrees:number):Promise<void>
    rollHeadTo  (Degrees:number):Promise<void>
    pitchHeadTo (Degrees:number):Promise<void>
    liftHeadTo  (Degrees:number):Promise<void>
    rotateBodyTo(Degrees:number):Promise<void>

    get State ():ServoState
    set State (Update:ServoUpdate)
    sendServoState ():Promise<void>

    destroy ():void
  }

//----------------------------------------------------------------------------//
//                             Protocol Constants                             //
//----------------------------------------------------------------------------//

  export const BaudRate = 9600

/**** HomePosition ****/
// s1–s4: CreoqodeNova_MouseKeyboard.ino setup()
// s5=95: CreoqodeNova_Calibration.ino calibrate()

  export const HomePosition = Object.freeze<ServoState>(
    { s1:90, s2:90, s3:110, s4:90, s5:95 }
  )

/**** SafeRange ****/

  export const SafeRange = Object.freeze<Record<ServoKey,[number,number]>>({
    s1:[ 45,135 ], s2:[ 10,170 ], s3:[ 40,150 ], s4:[ 30,180 ], s5:[ 20,150 ],
  })

/**** ServoSpeed — °/ms so that the full safe range takes exactly 1 second ****/

  export const ServoSpeed = Object.freeze<Record<ServoKey,number>>({
    s1: (SafeRange.s1[1]-SafeRange.s1[0])/1000,
    s2: (SafeRange.s2[1]-SafeRange.s2[0])/1000,
    s3: (SafeRange.s3[1]-SafeRange.s3[0])/1000,
    s4: (SafeRange.s4[1]-SafeRange.s4[0])/1000,
    s5: (SafeRange.s5[1]-SafeRange.s5[0])/1000,
  })

//----------------------------------------------------------------------------//
//                               Packet Builder                               //
//----------------------------------------------------------------------------//

/**** clampServo ****/

  function clampServo (Value:number, Key:ServoKey):number {
    const [Min,Max] = SafeRange[Key]
    return Math.max(Min, Math.min(Max, Math.round(Value)))
  }

/**** buildDirectPacket — 5-byte direct servo control packet ****/
// byte order matches CreoqodeNova_MouseKeyboard.ino loop():
//   [0] → NovaServo_4  (body rotation,   pin 38)
//   [1] → NovaServo_3  (head up/down,    pin 36)
//   [2] → NovaServo_2  (head CW/CCW,     pin 34)
//   [3] → NovaServo_1  (head front/back, pin 32)
//   [4] → NovaServo_5  (head 2nd,        pin 40) — appended extension

  export function buildDirectPacket (State:ServoState):Uint8Array {
    return new Uint8Array([
      clampServo(State.s4, 's4'),
      clampServo(State.s3, 's3'),
      clampServo(State.s2, 's2'),
      clampServo(State.s1, 's1'),
      clampServo(State.s5, 's5'),
    ])
  }

//----------------------------------------------------------------------------//
//                            Web Serial Transport                            //
//----------------------------------------------------------------------------//

// minimal local interfaces — avoids a hard dependency on a specific TypeScript
// lib version for the Web Serial API

  interface WebSerialPort extends EventTarget {
    open (Options:{ baudRate:number }):Promise<void>
    close ():Promise<void>
    readonly writable:WritableStream<Uint8Array>
  }

  interface WebSerialPortFilter {
    usbVendorId?:number
    usbProductId?:number
  }

  export interface WebSerialPortRequestOptions {
    filters?:WebSerialPortFilter[]
  }

  interface Transport {
    write (Data:Uint8Array):Promise<void>
    destroy ():void
  }

/**** openWebSerialTransport ****/

  async function openWebSerialTransport (
    PortOrOptions?:WebSerialPort | WebSerialPortRequestOptions
  ):Promise<Transport> {
    if (! ('serial' in navigator)) throw new Error(
      'Nova: Web Serial API is not supported in this browser'
    )
    const SerialNav = (navigator as unknown as {
      serial:{ requestPort(Options?:WebSerialPortRequestOptions):Promise<WebSerialPort> }
    }).serial

    const Port:WebSerialPort = (PortOrOptions instanceof EventTarget)
      ? PortOrOptions as WebSerialPort
      : await SerialNav.requestPort(
          (PortOrOptions as WebSerialPortRequestOptions | undefined) ?? {}
        )

    await Port.open({ baudRate:BaudRate })
    const Writer = Port.writable.getWriter()

    // the Arduino resets on DTR-toggle when the port opens —
    // wait 2 s for the bootloader to finish before sending commands
    await new Promise<void>((resolve) => setTimeout(resolve, 2000))

    let isClosed = false

    return {
      async write (Data:Uint8Array):Promise<void> {
        if (isClosed) { return }
        await Writer.write(Data)
      },
      destroy ():void {
        if (isClosed) { return }
        isClosed = true
        try { Writer.releaseLock() } catch (Signal) { /* already released */ }
        Port.close().catch(() => { /* already closed */ })
      },
    }
  }

//----------------------------------------------------------------------------//
//                              Nova Controller                               //
//----------------------------------------------------------------------------//

/**** NovaOptions ****/

  export interface NovaOptions {
    StepIntervalMs?:number  // ms between ramp steps; default 20 (= 50 Hz); 0 = instant jump
  }

/**** openNova — factory ****/
// opens a USB serial port and returns a controller.
// must be called from a user gesture (e.g. a button click) because
// the Web Serial API requires a transient user activation.

  export async function openNova (
    PortOrOptions?:WebSerialPort | WebSerialPortRequestOptions,
    Options?:NovaOptions
  ):Promise<NovaController> {
    const StepIntervalMs = Options?.StepIntervalMs ?? 20
    const Transport = await openWebSerialTransport(PortOrOptions)

    let currentState:ServoState = { ...HomePosition }
    let pendingState:ServoState | undefined
    let lastSend:Promise<void> = Promise.resolve()

    /**** scheduleUpdate — merge partial update into the one-slot pending queue ****/

    function scheduleUpdate (Update:ServoUpdate):void {
      pendingState = { ...(pendingState ?? currentState), ...Update }
    }

    /**** flushPending — ramp CurrentState toward PendingState one step at a time ****/
    // each step moves every servo by at most ServoSpeed[k]*StepIntervalMs degrees,
    // so the full safe range takes exactly 1 second; StepIntervalMs=0 jumps instantly.
    // concurrent callers chain on LastSend so packets never overlap on the wire.

    async function flushPending ():Promise<void> {
      const Previous = lastSend
      lastSend = (async ():Promise<void> => {
        try { await Previous } catch (Signal) { /* keep chain alive */ }
        while (pendingState != null) {
          const Target   = pendingState
          let allReached = true
          const Step:ServoState = { ...currentState }
          for (const Key of [ 's1','s2','s3','s4','s5' ] as ServoKey[]) {
            const Diff    = Target[Key]-currentState[Key]
            const maxStep = StepIntervalMs > 0 ? ServoSpeed[Key]*StepIntervalMs : Infinity
            if (Math.abs(Diff) > maxStep) {
              Step[Key]  = currentState[Key]+Math.sign(Diff)*maxStep
              allReached = false
            } else {
              Step[Key] = Target[Key]
            }
          }
          if (allReached) { pendingState = undefined }
          currentState = { ...Step }
          await Transport.write(buildDirectPacket(Step))
          if (! allReached) {
            await new Promise<void>((resolve) => setTimeout(resolve, StepIntervalMs))
          }
        }
      })()
      await lastSend
    }

    return {

    /**** home — move all servos to their home positions ****/

      async home ():Promise<void> {
        scheduleUpdate({ ...HomePosition })
        await flushPending()
      },

    /**** shiftHeadTo — NovaServo_1, pin 32: forward (>90°) / back (<90°) ****/

      async shiftHeadTo (Degrees:number):Promise<void> {
        scheduleUpdate({ s1:Degrees })
        await flushPending()
      },

    /**** rollHeadTo — NovaServo_2, pin 34: CW (>90°) / CCW (<90°) ****/

      async rollHeadTo (Degrees:number):Promise<void> {
        scheduleUpdate({ s2:Degrees })
        await flushPending()
      },

    /**** pitchHeadTo — NovaServo_3, pin 36: up (>110°) / down (<110°) ****/

      async pitchHeadTo (Degrees:number):Promise<void> {
        scheduleUpdate({ s3:Degrees })
        await flushPending()
      },

    /**** liftHeadTo — NovaServo_5, pin 40: secondary head, 20°–150° ****/

      async liftHeadTo (Degrees:number):Promise<void> {
        scheduleUpdate({ s5:Degrees })
        await flushPending()
      },

    /**** rotateBodyTo — NovaServo_4, pin 38: whole body Z-axis ****/

      async rotateBodyTo (Degrees:number):Promise<void> {
        scheduleUpdate({ s4:Degrees })
        await flushPending()
      },

    /**** State — current (or pending) servo positions ****/
    // getter: returns a deep copy of the pending state if any, else last-sent
    // setter: replaces any pending entry with a fresh merge of the last-sent
    //         state and Update — named methods (shiftHeadTo, etc.) instead
    //         accumulate on top of whatever is already pending;
    //         flush explicitly with sendServoState()

      get State ():ServoState { return structuredClone(pendingState ?? currentState) },
      set State (Update:ServoUpdate) { pendingState = { ...currentState, ...Update } },

    /**** sendServoState — flush any pending state update to the Arduino ****/

      async sendServoState ():Promise<void> { await flushPending() },

    /**** destroy — close serial port ****/

      destroy ():void { Transport.destroy() },
    }
  }
