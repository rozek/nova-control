# nova-control

Control a [Creoqode Nova DIY AI Robot](https://www.kickstarter.com/projects/creoqode/nova-diy-artificial-intelligence-robot) from a browser, Node.js, the command line, or an AI assistant — over USB serial.

---

## Overview

This monorepo contains four npm packages and one Arduino sketch:

| package | target | what it does |
| --- | --- | --- |
| [`nova-control-browser`](packages/nova-control-browser/README.md) | browser | Web Serial API — Chrome / Edge 89+ |
| [`nova-control-node`](packages/nova-control-node/README.md) | Node.js | `serialport` package — any OS |
| [`nova-control-command`](packages/nova-control-command/README.md) | CLI | one-shot commands, REPL, script files |
| [`nova-control-mcp-server`](packages/nova-control-mcp-server/README.md) | AI assistant | MCP server for Claude / other LLM clients |

The sketch [`Nova_SerialController.ino`](Nova_SerialController.ino) must be uploaded to the robot's Arduino (Creoqode Mini Mega / Arduino Mega-compatible) before using any of the packages.

---

## Arduino sketch

[`Nova_SerialController.ino`](Nova_SerialController.ino) — upload this once to the robot.

- baud rate: **9600**, 8N1
- protocol: 5-byte direct servo control packet
- servo pin assignments: s1→32, s2→34, s3→36, s4→38, s5→40
- safe ranges enforced on-board and in the JS packages:
  - s1 (head shift): 45–135°
  - s2 (head roll): 10–170°
  - s3 (head pitch): 40–150°
  - s4 (body rotation): 30–180°
  - s5 (head lift): 20–150°

---

## [nova-control-browser](packages/nova-control-browser/README.md)

ESM module for controlling Nova from a **browser** via the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) (Chrome / Edge 89+).

```js
import { openNova } from 'nova-control-browser'

// must be called from a user gesture (e.g. a button click)
button.addEventListener('click', async () => {
  const Nova = await openNova()   // shows browser port picker
  await Nova.home()
  await Nova.rotateBodyTo(120)
  console.log(Nova.State)         // { s1:90, s2:90, s3:110, s4:120, s5:95 }
  Nova.destroy()
})
```

Pass an existing `SerialPort` object (extends `EventTarget`) to skip the port picker:

```js
const Nova = await openNova(existingPort)
```

### Coalescing state setter

```js
Nova.State = { s4:120 }       // queues a state update
Nova.State = { s1:100 }       // replaces queue; starts fresh from last-sent state
await Nova.sendServoState()   // sends one 5-byte packet: s1=100, s4=90 (last-sent)
```

Named methods accumulate on top of whatever is already pending:

```js
Nova.shiftHeadTo(120)         // pending: { ...last, s1:120 }
Nova.rollHeadTo(60)           // pending: { ...last, s1:120, s2:60 }
await Nova.sendServoState()   // one packet with both changes
```

---

## [nova-control-node](packages/nova-control-node/README.md)

ESM module for controlling Nova from **Node.js** via the `serialport` package.

```js
import { openNova } from 'nova-control-node'

const Nova = await openNova('/dev/ttyACM0')   // or 'COM3' on Windows
await Nova.home()
await Nova.pitchHeadTo(130)
console.log(Nova.State)
Nova.destroy()
```

An optional second argument overrides the default baud rate:

```js
const Nova = await openNova('/dev/ttyACM0', 115200)
```

The API is otherwise identical to `nova-control-browser`.

### Exported API (both browser and node)

| symbol | type | description |
| --- | --- | --- |
| `BaudRate` | `number` | `9600` |
| `HomePosition` | `ServoState` | `{ s1:90, s2:90, s3:110, s4:90, s5:95 }` |
| `SafeRange` | `Record<ServoKey, [number, number]>` | per-servo safe angle ranges |
| `buildDirectPacket(state)` | `Uint8Array` | builds a 5-byte direct servo control packet |
| `openNova(...)` | `Promise<NovaController>` | opens the port and returns a controller |
| `runScript(Nova,Script)` | `Promise<void>` | executes a multi-line movement script against an open controller |

### `NovaController` interface

| method / accessor | description |
| --- | --- |
| `home(withinMS?)` | moves all servos to `HomePosition` |
| `shiftHeadTo(angle, withinMS?)` | s1 — head forward / back |
| `rollHeadTo(angle, withinMS?)` | s2 — head CW / CCW |
| `pitchHeadTo(angle, withinMS?)` | s3 — head up / down |
| `rotateBodyTo(angle, withinMS?)` | s4 — body Z-axis rotation |
| `moveTo(Target, withinMS?)` | moves the servos in `Target` to their angles; with `withinMS`, uses a trapezoidal ramp profile |
| `liftHeadTo(angle, withinMS?)` | s5 — secondary head axis (20–150°) |
| `get State` | returns a deep copy of the current or pending state |
| `set State(update)` | replaces the pending update; starts fresh from last-sent |
| `sendServoState()` | flushes the pending state as a single packet |
| `destroy()` | closes the serial port |

---

## [nova-control-command](packages/nova-control-command/README.md)

CLI tool for sending commands to Nova from a terminal.

Install globally and use the `nova-control` binary:

```bash
npm install -g nova-control-command

nova-control --port /dev/ttyACM0 home
nova-control --port /dev/ttyACM0 shift-to 120
nova-control --port /dev/ttyACM0 move --shift-to 120 --rotate-to 45
nova-control --port /dev/ttyACM0 shell        # interactive REPL
nova-control --port /dev/ttyACM0 --script run.nova
```

Or run without installing via `npx`:

```bash
npx nova-control-command --port /dev/ttyACM0 home
npx nova-control-command --port /dev/ttyACM0 shell
```

### Global options

| option | default | description |
| --- | --- | --- |
| `--port <path>` | *(required)* | serial port, e.g. `/dev/ttyACM0` or `COM3` |
| `--baud <rate>` | `9600` | baud rate |
| `--on-error <mode>` | `stop` | script error handling: `stop`, `continue`, `ask` |
| `--script <file>` | — | run commands from a file (`-` for stdin) |

### Commands

| command | arguments / options | description |
| --- | --- | --- |
| `home` | `[--within-ms <ms>]` | send all servos to home positions |
| `shift-to <angle>` | `[--within-ms <ms>]` | s1: head forward / back |
| `roll-to <angle>` | `[--within-ms <ms>]` | s2: head CW / CCW |
| `pitch-to <angle>` | `[--within-ms <ms>]` | s3: head up / down |
| `rotate-to <angle>` | `[--within-ms <ms>]` | s4: body Z-axis |
| `lift-to <angle>` | `[--within-ms <ms>]` | s5: secondary head axis |
| `move` | `--shift-to`, `--roll-to`, `--pitch-to`, `--rotate-to`, `--lift-to` (at least one required); `[--within-ms <ms>]` | set one or more servos in one packet |
| `wait <ms>` | — | pause for the given number of milliseconds |
| `state` | — | print the current servo state as JSON |
| `shell` | — | start an interactive REPL |

### Script file format

One command per line; `#` begins a comment; blank lines are ignored:

```
# move to a position, pause, then go home
shift-to 120 --within-ms 1000
wait 500
home --within-ms 500
```

---

## [nova-control-mcp-server](packages/nova-control-mcp-server/README.md)

[MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes Nova as tools for an AI assistant (Claude, etc.).

```
npx nova-control-mcp-server --port /dev/ttyACM0
```

Or add to your MCP client configuration (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nova": {
      "command": "npx",
      "args": ["nova-control-mcp-server", "--port", "/dev/ttyACM0"]
    }
  }
}
```

### MCP tools

All movement tools accept an optional `within_ms` parameter for smooth trapezoidal motion (ramp-up → constant speed → ramp-down). Without it, servos move at constant maximum speed.

| tool | arguments | description |
| --- | --- | --- |
| `home` | `within_ms?` | move all servos to home positions |
| `shift_to` | `angle: number`; `within_ms?` | s1: head forward / back |
| `roll_to` | `angle: number`; `within_ms?` | s2: head CW / CCW |
| `pitch_to` | `angle: number`; `within_ms?` | s3: head up / down |
| `rotate_to` | `angle: number`; `within_ms?` | s4: body Z-axis rotation |
| `lift_to` | `angle: number`; `within_ms?` | s5: secondary head axis (20–150°) |
| `move` | `shift_to?`, `roll_to?`, `pitch_to?`, `rotate_to?`, `lift_to?` (at least one required); `within_ms?` | set one or more servos atomically |
| `move_to` | `within_ms: number` (required, > 0); `s1?`, `s2?`, `s3?`, `s4?`, `s5?` | move one or more servos smoothly to target positions |
| `wait` | `ms: number` | pause for the given number of milliseconds |
| `get_state` | — | return the current servo state as JSON |
| `run_script` | `script: string` | execute a multi-line movement script (one command per line; blank lines and `#`-comments ignored) |
| `disconnect` | — | close the serial connection; reopens automatically on the next command |

### CLI options

| option | default | description |
| --- | --- | --- |
| `--port <path>` | *(required)* | serial port |
| `--baud <rate>` | `9600` | baud rate |

---

## Protocol

Each packet is exactly 5 bytes, no framing byte:

- byte order: `[s4, s3, s2, s1, s5]`
- each byte is a servo angle in degrees, clamped to the servo's safe range
- fractional values are rounded to the nearest integer before transmission
- baud rate: **9600**, 8N1

---

## Repository structure

```
nova-control/
├── Nova_SerialController.ino          Arduino sketch (upload once)
├── packages/
│   ├── nova-control-browser/          Web Serial API module
│   ├── nova-control-node/             Node.js serialport module
│   ├── nova-control-command/          CLI tool
│   └── nova-control-mcp-server/       MCP server
└── package.json                       npm workspace root
```

---

## Development

```bash
# install all workspace dependencies
npm install

# build all packages
npm run build

# run all test suites
npm run test:run
```

Each package has its own `vitest.config.ts`, `TestPlan.md`, and `TestCases.md`.

### Build order

`nova-control-command` and `nova-control-mcp-server` both depend on the built output of `nova-control-node`. The root `build` script therefore runs the packages in two sequential tiers:

1. `nova-control-browser` and `nova-control-node` (no intra-workspace dependencies)
2. `nova-control-command` and `nova-control-mcp-server` (depend on `nova-control-node`)

This ordering is encoded directly in the root `build` script, so `npm run build` always works correctly even after a full clean.

---

## License

[MIT](LICENSE.md) © Andreas Rozek