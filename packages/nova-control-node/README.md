# nova-control-node

Node.js ESM module for controlling the [Creoqode Nova DIY AI Robot](../../README.md) over USB serial via the `serialport` package.

---

## Prerequisites

| requirement | details |
| --- | --- |
| **Node.js 22+** | required at runtime and for the build toolchain. Download from [nodejs.org](https://nodejs.org). |
| **`serialport` ≥ 12** | runtime dependency — installed automatically with this package. Requires a C++ build toolchain (`node-gyp`) on first install if no pre-built binary is available for your platform. |
| **USB serial permissions** | on Linux, add your user to the `dialout` group (`sudo usermod -aG dialout $USER`) and re-login. On macOS and Windows no extra configuration is normally required. |
| **Arduino sketch** | the matching `Nova_SerialController.ino` sketch must be flashed to the robot's Arduino board (baud rate 9600, 8N1). |

---

## Installation

```bash
npm add nova-control-node
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
async function openNova (PortPath:string):Promise<NovaController>
```

Opens the USB serial port at `PortPath` and returns a `NovaController`.

`PortPath` examples: `/dev/ttyACM0` or `/dev/ttyUSB0` on Linux/macOS, `COM3` on Windows.

The returned promise rejects if the port cannot be opened (e.g. wrong path, permission denied, or device not connected). On success the promise resolves after the 2-second Arduino reset delay that follows every port open.

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
| `State` (get) | returns a deep copy of the pending state if any, else the last-sent state |
| `State` (set) | replaces any pending entry with `Update` merged onto the *last-sent* state (not onto pending); flush with `sendServoState()` |
| `sendServoState()` | flushes any pending state update to the Arduino |
| `destroy()` | closes the serial port |

`State` reflects what was *sent* (or is pending to be sent) to the Arduino, not the physical servo position — there is no read-back channel in the protocol.

Sends are serialised internally: concurrent method calls and `sendServoState()` calls never overlap on the wire. Each write awaits both `Port.write` and `Port.drain` before resolving, ensuring the 5-byte packet is fully flushed to the OS serial buffer. Named methods such as `shiftHeadTo()` *accumulate* changes on top of whatever is already pending; the `State` setter instead *replaces* the pending entry, starting fresh from the last-sent state.

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
import { openNova } from 'nova-control-node'

const Nova = await openNova('/dev/ttyACM0')   // or 'COM3' on Windows

await Nova.home()
await Nova.rotateBodyTo(120)
await Nova.shiftHeadTo(100)
await Nova.rollHeadTo(60)

console.log(Nova.State)
// → { s1:100, s2:60, s3:110, s4:120, s5:95 }

Nova.destroy()
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

### Error handling

```typescript
import { openNova } from 'nova-control-node'

try {
  const Nova = await openNova('/dev/ttyACM0')
  await Nova.home()
  Nova.destroy()
} catch (Signal) {
  console.error('Could not open serial port:', Signal)
}
```

### Listing available serial ports

The `serialport` package provides a utility for enumerating connected devices:

```typescript
import { SerialPort } from 'serialport'

const Ports = await SerialPort.list()
Ports.forEach((Port) => {
  console.log(Port.path, Port.manufacturer ?? '(unknown)')
})
```

---

## Building

```bash
npm run build --workspace packages/nova-control-node
```

Output is written to `packages/nova-control-node/dist/`.

---

## License

[MIT License](../../LICENSE.md) © Andreas Rozek
