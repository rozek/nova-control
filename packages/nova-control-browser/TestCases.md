# Test Cases — nova-control-browser

Test cases for the `nova-control-browser` package, grouped by test file.

---

## nova-control-browser.constants.test.ts

| # | Test case | Expected result |
|---|---|---|
| K-01 | `BaudRate` | `9600` |
| K-02 | `HomePosition.s1` | `90` |
| K-03 | `HomePosition.s2` | `90` |
| K-04 | `HomePosition.s3` | `110` |
| K-05 | `HomePosition.s4` | `90` |
| K-06 | `HomePosition.s5` | `95` |
| K-07 | `Object.isFrozen(HomePosition)` | `true` |
| K-08 | `SafeRange.s1` | `[45, 135]` |
| K-09 | `SafeRange.s2` | `[10, 170]` |
| K-10 | `SafeRange.s3` | `[40, 150]` |
| K-11 | `SafeRange.s4` | `[30, 180]` |
| K-12 | `SafeRange.s5` | `[20, 150]` |
| K-13 | `Object.isFrozen(SafeRange)` | `true` |
| K-14 | `ServoSpeed.s1` = (135−45)/1000 | ≈ `0.09` |
| K-15 | `ServoSpeed.s2` = (170−10)/1000 | ≈ `0.16` |
| K-16 | `ServoSpeed.s3` = (150−40)/1000 | ≈ `0.11` |
| K-17 | `ServoSpeed.s4` = (180−30)/1000 | ≈ `0.15` |
| K-18 | `ServoSpeed.s5` = (150−20)/1000 | ≈ `0.13` |
| K-19 | `Object.isFrozen(ServoSpeed)` | `true` |

---

## nova-control-browser.packet.test.ts

| # | Test case | Expected result |
|---|---|---|
| P-01 | `buildDirectPacket(HomePosition)` — length | `5` |
| P-02 | `buildDirectPacket(HomePosition)` — full bytes | `Uint8Array([90, 110, 90, 90, 95])` |
| P-03 | byte 0 carries s4: `buildDirectPacket({ ...HomePosition, s4:45 })[0]` | `45` |
| P-04 | byte 1 carries s3: `buildDirectPacket({ ...HomePosition, s3:100 })[1]` | `100` |
| P-05 | byte 2 carries s2: `buildDirectPacket({ ...HomePosition, s2:60 })[2]` | `60` |
| P-06 | byte 3 carries s1: `buildDirectPacket({ ...HomePosition, s1:120 })[3]` | `120` |
| P-07 | byte 4 carries s5: `buildDirectPacket({ ...HomePosition, s5:110 })[4]` | `110` |
| P-08 | s1 = 0 clamped to minimum 45 | byte 3 = `45` |
| P-09 | s3 = 0 clamped to minimum 40 | byte 1 = `40` |
| P-10 | s5 = 0 clamped to minimum 20 | byte 4 = `20` |
| P-11 | s1 = 255 clamped to maximum 135 | byte 3 = `135` |
| P-12 | s5 = 255 clamped to maximum 150 | byte 4 = `150` |
| P-13 | s1 = 45 (lower boundary) passes through | byte 3 = `45` |
| P-14 | s1 = 135 (upper boundary) passes through | byte 3 = `135` |
| P-15 | s1 = 90.6 rounds to 91 | byte 3 = `91` |
| P-16 | s1 = 90.4 rounds to 90 | byte 3 = `90` |

---

## nova-control-browser.controller.test.ts

| # | Test case | Expected result |
|---|---|---|
| T-01 | `openNova()` with `navigator.serial` absent | rejects with error containing `'Web Serial API'` |
| T-02 | `openNova()` without arguments — `requestPort` called | `requestPort` spy called exactly once |
| T-03 | `openNova(existingPort)` with EventTarget — `requestPort` not called | `requestPort` spy call count = 0 |
| T-04 | port opened with correct baud rate | `port.open` called with `{ baudRate: 9600 }` |
| T-05 | `openNova()` pending after 1999 ms then resolves after 2000 ms (fake timers) | promise resolves to controller object |
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
| C-12 | `Nova.State = { s4:120 }` then `Nova.State = { s1:100 }; sendServoState()` | s1=100, s4=last-sent (not 120) |
| C-13 | `destroy()` calls `writer.releaseLock()` and `port.close()` | both spy methods called |
| C-14 | write after `destroy()` is a no-op | writer write spy not called again; no throw |

---

## nova-control-browser.script.test.ts

| # | Test case | Expected result |
|---|---|---|
| RS-01 | empty script | resolves; `home` and `sendServoState` not called |
| RS-02 | blank lines and `#` comment lines only | resolves; no controller method called |
| RS-03 | `home` | `Nova.home(undefined)` called once |
| RS-03b | `home 500` | `Nova.home(500)` called once |
| RS-04 | `shift-to 100` | `Nova.shiftHeadTo(100, undefined)` called |
| RS-04b | `shift-to 100 500` | `Nova.shiftHeadTo(100, 500)` called |
| RS-05 | `roll-to 60` | `Nova.rollHeadTo(60)` called |
| RS-06 | `pitch-to 80` | `Nova.pitchHeadTo(80)` called |
| RS-07 | `rotate-to 120` | `Nova.rotateBodyTo(120)` called |
| RS-08 | `lift-to 30` | `Nova.liftHeadTo(30)` called |
| RS-09 | `move shift-to 100 rotate-to 120` | `Nova.moveTo({ s1:100, s4:120 }, undefined)` called |
| RS-09b | `move shift-to 100 rotate-to 120 within-ms 500` | `Nova.moveTo({ s1:100, s4:120 }, 500)` called |
| RS-10 | `wait 0` | resolves without error |
| RS-11 | multi-line `home\nshift-to 100` | commands executed in order |
| RS-12 | unknown command on line 2 | rejects with error containing `'line 2'` |
| RS-13 | `shift-to abc` (non-numeric angle) | rejects with error containing `'line 1'` |
| RS-14 | `move` with no servo arguments | rejects with error containing `'line 1'` |
| RS-15 | `wait -1` (negative duration) | rejects with error containing `'line 1'` |

---

## nova-control-browser.controller.test.ts (continued)

### Timed movement (TM)

| # | Test case | Expected result |
|---|---|---|
| TM-01 | `moveTo({ s1:120 })` without `withinMS` | exactly one packet written; byte 3 = 120 |
| TM-02 | `moveTo({ s1:120 }, 5)` with `StepIntervalMs:1` | more than one packet written |
| TM-03 | `shiftHeadTo(120, 5)` with `StepIntervalMs:1` | more than one packet written |
| TM-04 | `home(200)` with `StepIntervalMs:1` | more than one packet written |
| TM-05 | first packet from `moveTo({ s1:120 }, 10)` | byte 3 > 90 and < 120 (between start and target) |
| TM-06 | last packet from `moveTo({ s1:120 }, 5)` | byte 3 = 120 (exact target reached) |
| TM-07 | midpoint packet from `moveTo({ s1:190 }, 100)` | midpoint byte 3 ≈ 140 (±3°, roughly 50% of 100° travel) |
