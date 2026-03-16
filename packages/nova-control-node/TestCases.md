# Test Cases — nova-control-node

Test cases for the `nova-control-node` package, grouped by test file.

---

## nova-control-node.constants.test.ts

| # | Test case | Expected result |
|---|---|---|
| K-01 | `BaudRate` | `9600` |
| K-02 | `HomePosition.s1` | `90` |
| K-03 | `HomePosition.s2` | `90` |
| K-04 | `HomePosition.s3` | `110` |
| K-05 | `HomePosition.s4` | `90` |
| K-06 | `HomePosition.s5` | `95` |
| K-07 | `Object.isFrozen(HomePosition)` | `true` |
| K-08 | `SafeRange.s1` | `[80, 150]` |
| K-09 | `SafeRange.s2` | `[0, 180]` |
| K-10 | `SafeRange.s3` | `[76, 180]` |
| K-11 | `SafeRange.s4` | `[0, 180]` |
| K-12 | `SafeRange.s5` | `[10, 141]` |
| K-13 | `Object.isFrozen(SafeRange)` | `true` |

---

## nova-control-node.packet.test.ts

| # | Test case | Expected result |
|---|---|---|
| P-01 | `buildDirectPacket(HomePosition)` — length | `5` |
| P-02 | `buildDirectPacket(HomePosition)` — full bytes | `Uint8Array([90, 110, 90, 90, 95])` |
| P-03 | byte 0 carries s4: `buildDirectPacket({ ...HomePosition, s4:45 })[0]` | `45` |
| P-04 | byte 1 carries s3: `buildDirectPacket({ ...HomePosition, s3:100 })[1]` | `100` |
| P-05 | byte 2 carries s2: `buildDirectPacket({ ...HomePosition, s2:60 })[2]` | `60` |
| P-06 | byte 3 carries s1: `buildDirectPacket({ ...HomePosition, s1:120 })[3]` | `120` |
| P-07 | byte 4 carries s5: `buildDirectPacket({ ...HomePosition, s5:110 })[4]` | `110` |
| P-08 | s1 = 0 clamped to minimum 80 | byte 3 = `80` |
| P-09 | s3 = 0 clamped to minimum 76 | byte 1 = `76` |
| P-10 | s5 = 0 clamped to minimum 10 | byte 4 = `10` |
| P-11 | s1 = 255 clamped to maximum 150 | byte 3 = `150` |
| P-12 | s5 = 255 clamped to maximum 141 | byte 4 = `141` |
| P-13 | s1 = 80 (lower boundary) passes through | byte 3 = `80` |
| P-14 | s1 = 150 (upper boundary) passes through | byte 3 = `150` |
| P-15 | s1 = 90.6 rounds to 91 | byte 3 = `91` |
| P-16 | s1 = 90.4 rounds to 90 | byte 3 = `90` |

---

## nova-control-node.controller.test.ts

| # | Test case | Expected result |
|---|---|---|
| T-01 | `openNova('/dev/ttyACM0')` — `SerialPort` constructed with correct args | `SerialPort` spy called with `{ path: '/dev/ttyACM0', baudRate: 9600, autoOpen: false }` |
| T-02 | `openNova('/dev/ttyACM0', 115200)` — baud rate override | `SerialPort` spy called with `baudRate: 115200` |
| T-03 | `Port.open()` called during `openNova` | `open` spy called exactly once |
| T-04 | `Port.open` calls back with an error | `openNova` rejects with that error |
| T-05 | `openNova()` pending after 1999 ms (fake timers) then resolves after 2000 ms | promise resolves to controller object |
| T-06 | each controller write awaits `Port.write` before calling `Port.drain` | `drain` spy not called until `write` callback fires |
| T-07 | `Port.write` calls back with an error | controller method rejects with that error |
| C-01 | `Nova.State` immediately after `openNova()` | `{ s1:90, s2:90, s3:110, s4:90, s5:95 }` |
| C-02 | mutating result of `Nova.State` does not affect next read | subsequent `Nova.State` unchanged |
| C-03 | `home()` — bytes written | `[90, 110, 90, 90, 95]` (= `buildDirectPacket(HomePosition)`) |
| C-04 | `Nova.State` after `home()` | equals `HomePosition` |
| C-05 | `shiftHeadTo(120)` — byte 3 | `120`; other bytes from last-sent state |
| C-06 | `rollHeadTo(60)` — byte 2 | `60` |
| C-07 | `pitchHeadTo(130)` — byte 1 | `130` |
| C-08 | `rotateBodyTo(45)` — byte 0 | `45` |
| C-09 | `liftHeadTo(110)` — byte 4 | `110` |
| C-10 | `shiftHeadTo(120)` then `rollHeadTo(60)` without awaiting | single packet with s1=120, s2=60 |
| C-11 | `Nova.State = { s1:120 }; sendServoState()` | packet with s1=120, others from last-sent |
| C-12 | `Nova.State = { s4:120 }` then `Nova.State = { s1:100 }; sendServoState()` | packet with s1=100, s4 = last-sent value (not 120) |
| C-13 | `destroy()` calls `Port.close()` | `close` spy called exactly once |
