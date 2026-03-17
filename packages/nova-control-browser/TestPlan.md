# Test Plan — nova-control-browser

ESM module for controlling the Creoqode Nova DIY AI Robot from a browser
via the Web Serial API (Chrome/Edge 89+).

---

## Goal

Verify that `BaudRate`, `HomePosition`, `SafeRange`, and `buildDirectPacket`
have the correct values and produce the correct binary output, and that
`openNova` returns a controller whose methods send the right 5-byte
packets through the (mocked) Web Serial port.

---

## Scope

**In scope:**
- Protocol constants — `BaudRate`, `HomePosition`, `SafeRange` have the correct
  values and are frozen
- Packet builder — `buildDirectPacket` produces a 5-byte `Uint8Array` with the
  correct byte order, per-servo clamping against `SafeRange`, and rounding of
  fractional values
- Transport guard — `openNova()` throws a descriptive error when
  `navigator.serial` is absent
- Port selection — `requestPort` is called when no port argument is given; a
  provided port object (EventTarget) is used directly without calling `requestPort`
- Reset delay — the transport waits 2 s after opening the port before resolving,
  to let the Arduino bootloader finish
- Controller state — `Nova.State` getter returns the correct initial state and
  always a deep copy (mutations to the returned object do not affect internal state)
- Named controller methods — `home()`, `shiftHeadTo()`, `rollHeadTo()`,
  `pitchHeadTo()`, `liftHeadTo()`, `rotateBodyTo()` each produce the correct
  5-byte packet
- Named methods accumulate — consecutive calls accumulate on `PendingState`:
  the second call merges on top of whatever is already pending
- State setter — `Nova.State = Update` replaces any pending entry starting from
  the *last-sent* state; a subsequent `Nova.State = Update2` discards the first
  assignment and starts fresh from the last-sent state
- `sendServoState()` — flushes pending state; a no-op when nothing is pending
- Destroy — `destroy()` releases the writer lock and closes the port; subsequent
  `write` calls are silently ignored
- Script runner — `runScript(Nova, script)` parses and executes a multi-line
  movement script line by line, calling the appropriate `NovaController` methods

**Out of scope:**
- Physical servo movement (requires hardware)
- Actual Web Serial port I/O
- Cross-browser differences in the Web Serial API implementation

---

## Test Environment

- **Runner:** Vitest 4 with `globals: true`
- **Language:** TypeScript 5.9, ESM modules
- **Platform:** Node.js running in `happy-dom` environment
- **Mocking strategy:**
  - `navigator` stubbed globally via `vi.stubGlobal` with a fake `serial` object
    whose `requestPort` is a `vi.fn()` returning a mock port
  - The mock port exposes a `WritableStream` backed by a fake writer that records
    every `write` call
  - `vi.useFakeTimers()` to advance past the 2-second Arduino reset delay without
    actually waiting

---

## Part I — Protocol Constants (K)

- **K-01** — `BaudRate` equals `9600`
- **K-02..06** — `HomePosition` has `s1=90`, `s2=90`, `s3=110`, `s4=90`, `s5=95`
- **K-07** — `Object.isFrozen(HomePosition)` is `true`
- **K-08..12** — `SafeRange` has correct ranges per servo: s1 `[45, 135]`, s2 `[10, 170]`, s3 `[40, 150]`, s4 `[30, 180]`, s5 `[20, 150]`
- **K-13** — `Object.isFrozen(SafeRange)` is `true`
- **K-14..18** — `ServoSpeed` has the correct °/ms rate per servo: (max − min) / 1000
- **K-19** — `Object.isFrozen(ServoSpeed)` is `true`

---

## Part II — Packet Builder (P)

### Byte order
- **P-01** — `buildDirectPacket(HomePosition)` returns length-5 `Uint8Array`
- **P-02** — full byte values equal `[90, 110, 90, 90, 95]`
- **P-03..07** — bytes 0–4 carry s4, s3, s2, s1, s5 respectively

### Clamping
- **P-08..10** — below-minimum values are clamped to the minimum for s1, s3, s5
- **P-11..12** — above-maximum values are clamped to the maximum for s1, s5
- **P-13..14** — boundary values pass through unchanged

### Rounding
- **P-15** — `90.6` rounds to `91`
- **P-16** — `90.4` rounds to `90`

---

## Part III — Transport (T)

- **T-01** — `openNova()` rejects when `navigator.serial` is absent, with an error message containing `'Web Serial API'`
- **T-02** — `openNova()` without arguments calls `requestPort` once
- **T-03** — `openNova(existingPort)` with an EventTarget does not call `requestPort`
- **T-04** — port is opened with `baudRate: 9600`
- **T-05** — reset delay: promise pending after 1999 ms, resolves after 2000 ms

---

## Part IV — Controller (C)

### Initial state
- **C-01** — `Nova.State` after `openNova()` equals HomePosition
- **C-02** — returned state object is a deep copy; mutations do not affect next read

### home
- **C-03** — `home()` transmits bytes equal to `buildDirectPacket(HomePosition)`
- **C-04** — `Nova.State` after `home()` equals `HomePosition`

### Named servo methods
- **C-05** — `shiftHeadTo(120)` sends packet with byte 3 = 120
- **C-06** — `rollHeadTo(60)` sends packet with byte 2 = 60
- **C-07** — `pitchHeadTo(130)` sends packet with byte 1 = 130
- **C-08** — `rotateBodyTo(45)` sends packet with byte 0 = 45
- **C-09** — `liftHeadTo(110)` sends packet with byte 4 = 110

### Named methods accumulate on PendingState
- **C-10** — `shiftHeadTo(120)` then `rollHeadTo(60)` without awaiting the first
  produces a single packet with s1 = 120 and s2 = 60

### State setter
- **C-11** — `Nova.State = { s1:120 }; sendServoState()` sends packet with s1 = 120,
  other bytes from last-sent state
- **C-12** — `Nova.State = { s4:120 }` then `Nova.State = { s1:100 };
  sendServoState()` sends packet with s1 = 100 and s4 at its *last-sent* value (not 120)

### destroy
- **C-13** — `destroy()` calls `writer.releaseLock()` and `port.close()`
- **C-14** — a `write` call after `destroy()` is a no-op and does not throw

---

## Part V — Script Runner (RS)

### happy path
- **RS-01** — empty string resolves without calling any method
- **RS-02** — blank lines and `#`-prefixed comment lines are skipped
- **RS-03** — `home` calls `Nova.home(undefined)`
- **RS-03b** — `home 500` calls `Nova.home(500)`
- **RS-04** — `shift-to 100` calls `Nova.shiftHeadTo(100, undefined)`
- **RS-04b** — `shift-to 100 500` calls `Nova.shiftHeadTo(100, 500)`
- **RS-05** — `roll-to 60` calls `Nova.rollHeadTo(60)`
- **RS-06** — `pitch-to 80` calls `Nova.pitchHeadTo(80)`
- **RS-07** — `rotate-to 120` calls `Nova.rotateBodyTo(120)`
- **RS-08** — `lift-to 30` calls `Nova.liftHeadTo(30)`
- **RS-09** — `move shift-to 100 rotate-to 120` calls `Nova.moveTo({ s1:100, s4:120 }, undefined)`
- **RS-09b** — `move shift-to 100 rotate-to 120 within-ms 500` calls `Nova.moveTo({ s1:100, s4:120 }, 500)`
- **RS-10** — `wait 0` resolves without error
- **RS-11** — a multi-line script executes commands in the order they appear

### error path
- **RS-12** — unknown command on line 2 rejects with an error containing `'line 2'`
- **RS-13** — non-numeric angle argument rejects with an error containing the line number
- **RS-14** — `move` with no servo arguments rejects with an error containing the line number
- **RS-15** — negative wait duration rejects with an error containing the line number

---

## Part VI — Timed Movement (TM)

Tests cover `moveTo()`, the `withinMS` parameter on all servo-command methods, and the trapezoidal easing behaviour.

| test ID | description |
| --- | --- |
| TM-01 | `moveTo` without `withinMS` sends exactly one packet |
| TM-02 | `moveTo` with `withinMS` sends multiple intermediate packets |
| TM-03 | `shiftHeadTo` with `withinMS` sends multiple intermediate packets |
| TM-04 | `home` with `withinMS` sends multiple intermediate packets |
| TM-05 | first timed packet is between start and target (ramp-up effect) |
| TM-06 | last timed packet reaches exact target angle |
| TM-07 | symmetric trapezoid: midpoint packet is at approximately 50% of travel |
