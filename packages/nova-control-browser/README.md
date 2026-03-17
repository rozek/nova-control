# nova-control-browser

Browser ESM module for controlling the [Creoqode Nova DIY AI Robot](../../README.md) over USB serial via the Web Serial API.

---

## Prerequisites

| requirement | details |
| --- | --- |
| **Chrome or Edge 89+** | required — the Web Serial API is only available in Chromium-based browsers. Firefox and Safari do not support it. |
| **Node.js 22+** | required for the build toolchain only (`npm run build`). Not needed at runtime in the browser. Download from [nodejs.org](https://nodejs.org). |
| **Arduino sketch** | the matching [`Nova_SerialController.ino`](../../Nova_SerialController.ino) sketch must be flashed to the robot's Arduino board (baud rate 9600, 8N1). |
| **User gesture** | `openNova()` must be called from within a user gesture (e.g. a button click) because the browser requires a transient activation before showing the port picker. |

---

## Installation

```bash
npm add nova-control-browser
```

---

## API

### Constants

| export | type | value | description |
| --- | --- | --- | --- |
| `BaudRate` | `number` | `9600` | baud rate expected by the Arduino sketch |
| `HomePosition` | `ServoState` | `{ s1:90, s2:90, s3:110, s4:90, s5:95 }` | safe resting position for all five servos |
| `SafeRange` | `Record<ServoKey, [number, number]>` | see below | per-servo `[min, max]` in degrees |

`SafeRange` values:

| servo | pin | role | min | max |
| --- | --- | --- | --- | --- |
| `s1` | 32 | head front/back | 45 | 135 |
| `s2` | 34 | head CW/CCW | 10 | 170 |
| `s3` | 36 | head up/down | 40 | 150 |
| `s4` | 38 | body rotation | 30 | 180 |
| `s5` | 40 | secondary head | 20 | 150 |

Both `HomePosition` and `SafeRange` are frozen (`Object.isFrozen` returns `true`).

### `buildDirectPacket`

```typescript
function buildDirectPacket (State:ServoState):Uint8Array
```

Assembles a 5-byte direct servo control packet from the given servo state. Each value is clamped to `SafeRange` and rounded to the nearest integer before encoding. The byte order matches the Arduino sketch:

| byte | servo |
| --- | --- |
| 0 | s4 |
| 1 | s3 |
| 2 | s2 |
| 3 | s1 |
| 4 | s5 |

### `openNova`

```typescript
async function openNova (
  PortOrOptions?:WebSerialPort | WebSerialPortRequestOptions,
  Options?:       NovaOptions
):Promise<NovaController>
```

Opens a USB serial port and returns a `NovaController`. Without an argument the browser's port picker is shown to the user. An existing `WebSerialPort` instance (e.g. from a previous session) may be passed to skip the picker. A `WebSerialPortRequestOptions` object with an optional `filters` array may be passed to narrow the picker to specific USB device IDs.

The returned promise resolves after the 2-second Arduino reset delay that follows every port open.

### `NovaOptions`

```typescript
interface NovaOptions {
  StepIntervalMs?: number   // ms between interpolation steps; default 20 (50 Hz); 0 = instant
  RampRatio?:      number   // fraction of withinMS used for each ramp phase; default 0.25; range 0–0.499
}
```

Controls how servo movements are executed when `withinMS` is specified on a movement call. `StepIntervalMs` sets the interval between intermediate packets. `RampRatio` controls what fraction of the total movement time is used for ramp-up and ramp-down phases (each); the remainder is constant speed. For example `RampRatio: 0.25` means 25% ramp-up, 50% constant speed, 25% ramp-down.

### `NovaController`

```typescript
interface NovaController {
  home ():Promise<void>
  shiftHeadTo (Degrees:number):Promise<void>
  rollHeadTo (Degrees:number):Promise<void>
  pitchHeadTo (Degrees:number):Promise<void>
  liftHeadTo (Degrees:number):Promise<void>
  rotateBodyTo (Degrees:number):Promise<void>
  get State ():ServoState
  set State (Update:ServoUpdate)
  sendServoState ():Promise<void>
  destroy ():void
}
```

| method / property | description |
| --- | --- |
| `home()` | sends all servos to `HomePosition` |
| `shiftHeadTo(Degrees)` | sets s1 — head forward `> 90°`, back `< 90°` |
| `rollHeadTo(Degrees)` | sets s2 — head clockwise `> 90°`, counter-clockwise `< 90°` |
| `pitchHeadTo(Degrees)` | sets s3 — head up `> 110°`, down toward `40°` |
| `liftHeadTo(Degrees)` | sets s5 — secondary head up/down, range `20°`–`150°` |
| `rotateBodyTo(Degrees)` | sets s4 — rotates the entire body around the Z-axis |
| `moveTo(Target, withinMS?)` | moves the servos listed in `Target` to their target angles; with `withinMS`, uses the trapezoidal profile |
| `State` (get) | returns a deep copy of the pending state if any, else the last-sent state |
| `State` (set) | replaces any pending entry with `Update` merged onto the *last-sent* state (not onto pending); flush with `sendServoState()` |
| `sendServoState()` | flushes any pending state update to the Arduino |
| `destroy()` | releases the stream writer lock and closes the serial port |

All movement methods (`home`, `shiftHeadTo`, `rollHeadTo`, `pitchHeadTo`, `liftHeadTo`, `rotateBodyTo`, and `moveTo`) accept an optional `withinMS?:number` final argument. When provided, the method executes a smooth timed movement that completes in exactly the given number of milliseconds, using the trapezoidal velocity profile configured by `RampRatio` in `NovaOptions`. Without `withinMS`, the method uses the existing constant-speed ramp (governed by `StepIntervalMs`).

`State` reflects what was *sent* (or is pending to be sent) to the Arduino, not the physical servo position — there is no read-back channel in the protocol.

Sends are serialised internally: concurrent method calls and `sendServoState()` calls never overlap on the wire. Named methods such as `shiftHeadTo()` *accumulate* changes on top of whatever is already pending; the `State` setter instead *replaces* the pending entry, starting fresh from the last-sent state.

### `runScript`

```typescript
async function runScript (Nova:NovaController, Script:string):Promise<void>
```

Parses and executes a multi-line movement script against an already-open controller. Commands are executed sequentially, one per line. Blank lines and lines starting with `#` are ignored.

Supported commands:

| command | description |
| --- | --- |
| `home [<within_ms>]` | send all servos to home positions |
| `shift-to <deg> [<within_ms>]` | s1 — head forward / back |
| `roll-to <deg> [<within_ms>]` | s2 — head CW / CCW |
| `pitch-to <deg> [<within_ms>]` | s3 — head up / down |
| `rotate-to <deg> [<within_ms>]` | s4 — body Z-axis rotation |
| `lift-to <deg> [<within_ms>]` | s5 — secondary head axis |
| `move [shift-to <deg>] [roll-to <deg>] [pitch-to <deg>] [rotate-to <deg>] [lift-to <deg>] [within-ms <ms>]` | set multiple servos atomically (e.g. `move shift-to 100 rotate-to 120 within-ms 500`) |
| `wait <ms>` | pause for the given number of milliseconds |

Each command is fully awaited before the next begins. Throws a descriptive error containing the line number if an unknown command or invalid argument is encountered.

### Types

```typescript
type ServoKey    = 's1' | 's2' | 's3' | 's4' | 's5'
type ServoState  = { [K in ServoKey]:number }
type ServoUpdate = Partial<ServoState>
```

---

## Examples

### Basic usage

```typescript
import { openNova } from 'nova-control-browser'

const Button = document.querySelector('button')!

Button.addEventListener('click', async () => {
  // shows the browser's port picker — must be inside a user gesture
  const Nova = await openNova()

  await Nova.home()
  await Nova.rotateBodyTo(120)
  await Nova.shiftHeadTo(100)
  await Nova.rollHeadTo(60)

  console.log(Nova.State)
  // → { s1:100, s2:60, s3:110, s4:120, s5:95 }

  Nova.destroy()
})
```

### Two queue strategies

**Named methods accumulate** — each call merges its change on top of whatever is already pending:

```typescript
// none of these three lines sends anything yet
Nova.shiftHeadTo(80)     // pending: { ...home, s1:80 }
Nova.rollHeadTo(60)      // pending: { ...home, s1:80, s2:60 }
Nova.rotateBodyTo(120)   // pending: { ...home, s1:80, s2:60, s4:120 }
await Nova.sendServoState()
// sends { s1:80, s2:60, s3:110, s4:120, s5:95 }
```

**The `State` setter replaces** the pending entry — it starts fresh from the last-sent state, discarding any pending changes:

```typescript
Nova.State = { s4:120 }
Nova.State = { s1:100, s2:60 }   // replaces previous; s4 reverts to last-sent
await Nova.sendServoState()
// sends { s1:100, s2:60, s3:110, s4:90, s5:95 }   ← s4 is 90, not 120
```

### Reusing a previously selected port

```typescript
import { openNova } from 'nova-control-browser'

// ask the browser for the port once (requires user gesture)
const [Port] = await (navigator as any).serial.getPorts()

// later — no picker shown, no gesture needed
const Nova = await openNova(Port)
await Nova.home()
Nova.destroy()
```

### Filtering the port picker by USB vendor

```typescript
import { openNova } from 'nova-control-browser'

Button.addEventListener('click', async () => {
  // only show CH340/CH341 USB serial adapters (Arduino clones)
  const Nova = await openNova({ filters: [{ usbVendorId: 0x1a86 }] })
  await Nova.home()
  Nova.destroy()
})
```

---

## Building

```bash
npm run build --workspace packages/nova-control-browser
```

Output is written to `packages/nova-control-browser/dist/`.

---

## Related packages

| package | description |
| --- | --- |
| [`nova-control-node`](../nova-control-node/README.md) | same API for Node.js via the `serialport` package |
| [`nova-control-command`](../nova-control-command/README.md) | CLI — one-shot commands, interactive REPL, and script files |
| [`nova-control-mcp-server`](../nova-control-mcp-server/README.md) | MCP server — lets an AI assistant control the robot |

---

## License

[MIT License](../../LICENSE.md) © Andreas Rozek
