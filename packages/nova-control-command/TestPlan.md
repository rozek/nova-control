# Test Plan — `nova-control-command`

---

## Goal

Verify that the `nova-control` CLI tool correctly tokenises input, dispatches commands, controls the one-slot coalescing queue, handles errors gracefully, and operates correctly in one-shot, script, and REPL modes — without requiring a physical NOVA robot.

---

## Scope

**In scope:**
- Command tokenisation (`tokenizeLine`) — quoted strings, escapes, comments, tabs
- Script runner (`runScript`) — stop / continue / ask error handling, blank and comment lines
- All servo commands: `home`, `shift-to`, `roll-to`, `pitch-to`, `rotate-to`, `lift-to`, `move`
- `wait` — duration validation and actual pause behaviour
- `state` — JSON output to stdout
- Error handling — unknown commands, missing arguments, invalid values
- `--on-error` mode propagation in script mode
- REPL — blank lines, comment lines, exit/quit, error recovery, unknown commands

**Out of scope:**
- Real serial communication (mocked via `vi.mock('nova-control-node')`)
- Degree range validation — the firmware clamps silently; the CLI passes values through
- Interactive `ask` mode with a real TTY (non-TTY path is tested)

---

## Test Environment

- **Runtime:** Node.js 22+
- **Serial transport:** mocked via vitest module mocking — no physical port needed
- **Test framework:** Vitest 4

---

## Part I — Command Tokeniser

### 1. Basic splitting

- **CT-01** — empty string returns `[]`
- **CT-02** — whitespace-only string returns `[]`
- **CT-03** — `'shift-to 100'` returns `['shift-to', '100']`
- **CT-04** — multiple spaces between tokens treated as single delimiter

### 2. Quoted strings

- **CT-05** — `'"hello world"'` returns `['hello world']`
- **CT-06** — `"'foo bar'"` returns `['foo bar']`
- **CT-07** — unclosed quote merges remaining input into last token

### 3. Escape sequences

- **CT-08** — backslash-escaped space outside quotes merges into one token
- **CT-09** — `'\\"'` returns `['"']`
- **CT-10** — backslash-escaped double-quote inside double-quoted string returns literal quote

### 4. Comments and tabs

- **CT-11** — inline `#` (preceded by space) strips the comment; preceding tokens returned
- **CT-12** — line starting with `#` returns `[]`
- **CT-13** — tab between tokens treated as whitespace

---

## Part II — Script Runner

### 1. Error modes

- **SR-01** — `stop` mode: stops after first failing command; returns its exit code
- **SR-02** — `continue` mode: continues after errors; returns last non-zero exit code

### 2. Edge cases

- **SR-03** — non-existent script file: error message written to stderr; returns exit code 2
- **SR-04** — script file containing only blank lines and comments: exits with code 0; no error output
- **SR-05** — `ask` mode in non-TTY context falls back to `stop` behaviour

---

## Part III — Servo Commands

All tests inject `--port /dev/test` via `_setupForTests` and use a mocked `openNova` that returns a `MockNova` object. The mock tracks `State` setter calls and records `sendServoState()` invocations.

### 1. `home`

- **CMD-01** — `executeTokens(['home'])` calls `Nova.home()` and returns exit code 0

### 2. Individual servo commands (`shift-to`, `roll-to`, `pitch-to`, `rotate-to`, `lift-to`)

- **CMD-02** — `shift-to 100` sets `Nova.State = { s1:100 }` and calls `sendServoState()`
- **CMD-03** — `roll-to 60` sets `Nova.State = { s2:60 }` and calls `sendServoState()`
- **CMD-04** — `pitch-to 80` sets `Nova.State = { s3:80 }` and calls `sendServoState()`
- **CMD-05** — `rotate-to 120` sets `Nova.State = { s4:120 }` and calls `sendServoState()`
- **CMD-06** — `lift-to 90` sets `Nova.State = { s5:90 }` and calls `sendServoState()`

### 3. `move`

- **CMD-07** — `move --shift-to 100` sets `{ s1:100 }` and calls `sendServoState()`
- **CMD-08** — `move --shift-to 100 --rotate-to 120` sets `{ s1:100, s4:120 }` and calls `sendServoState()`
- **CMD-09** — `move` without any servo option returns exit code 2 (UsageError)

### 4. `wait`

- **CMD-10** — `wait 100` resolves after ~100 ms (fake timers) and returns exit code 0
- **CMD-11** — `wait 0` resolves immediately and returns exit code 0
- **CMD-12** — `wait -1` returns exit code 2; error message contains the invalid value
- **CMD-13** — `wait abc` returns exit code 2; error message contains the invalid value

### 5. `state`

- **CMD-14** — `state` writes a JSON object to stdout containing all five servo keys and returns exit code 0

---

## Part IV — Error Handling

- **ERR-01** — unknown command (e.g. `executeTokens(['fly'])`) returns exit code 2; error written to stderr
- **ERR-02** — `shift-to` without argument returns exit code 2; error written to stderr
- **ERR-03** — `openNova` rejection (port not found) propagates as exit code 1; error written to stderr

---

## Running the Tests

```bash
cd packages/nova-control-command
npm run test:run
```
