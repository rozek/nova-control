# nova-control-mcp-server — Test Cases

## Part I — SH: Server handshake

| ID | Description | Input | Expected result |
|---|---|---|---|
| SH-01 | server connects without error | `InMemoryTransport` pair, `createServer().connect(serverTransport)`, `client.connect(clientTransport)` | no exception thrown |
| SH-02 | `tools/list` returns all twelve tools | `client.listTools()` | result contains exactly the names `disconnect`, `get_state`, `home`, `lift_to`, `move`, `move_to`, `pitch_to`, `roll_to`, `rotate_to`, `run_script`, `shift_to`, `wait` |

## Part II — MT: Move-To Tool

| ID | Description | Input | Expected result |
|---|---|---|---|
| MT-01 | `move_to` with valid servo targets and `within_ms` succeeds | `callTool('move_to', { within_ms: 100, s1: 120 })` | `isError` absent or false; servo position updated |
| MT-02 | `move_to` with no servo targets returns an error | `callTool('move_to', { within_ms: 100 })` | `isError` is true; text contains `s1–s5` |
| MT-03 | `move_to` with `within_ms` ≤ 0 returns an error | `callTool('move_to', { within_ms: 0, s1: 120 })` | `isError` is true; text indicates invalid duration |

## Part III — MV: Motion tools

### MV-home (Part III)

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-01 | `home` calls `Nova.home()` | `callTool('home', {})` | `isError` absent or false; `MockNova.home` called once |

### MV-servo (individual servo commands) (Part III)

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-02 | `shift_to` calls `Nova.shiftHeadTo()` with the given angle | `callTool('shift_to', { angle: 100 })` | `isError` absent or false; `MockNova.shiftHeadTo` called with `(100, undefined)` |
| MV-03 | `roll_to` calls `Nova.rollHeadTo()` | `callTool('roll_to', { angle: 60 })` | `isError` absent or false; `MockNova.rollHeadTo` called with `(60, undefined)` |
| MV-04 | `pitch_to` calls `Nova.pitchHeadTo()` | `callTool('pitch_to', { angle: 80 })` | `isError` absent or false; `MockNova.pitchHeadTo` called with `(80, undefined)` |
| MV-05 | `rotate_to` calls `Nova.rotateBodyTo()` | `callTool('rotate_to', { angle: 120 })` | `isError` absent or false; `MockNova.rotateBodyTo` called with `(120, undefined)` |
| MV-06 | `lift_to` calls `Nova.liftHeadTo()` | `callTool('lift_to', { angle: 30 })` | `isError` absent or false; `MockNova.liftHeadTo` called with `(30, undefined)` |

### MV-move (Part III)

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-07 | `move` with one servo calls `Nova.moveTo()` with that servo | `callTool('move', { shift_to: 100 })` | `isError` absent or false; `MockNova.moveTo` called with `({ s1: 100 }, undefined)` |
| MV-08 | `move` with two servos calls `Nova.moveTo()` with both | `callTool('move', { shift_to: 100, rotate_to: 120 })` | `isError` absent or false; `MockNova.moveTo` called with `({ s1: 100, s4: 120 }, undefined)` |

### MV-wait (Part III)

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-09 | `wait` with a small positive duration resolves without error | `callTool('wait', { ms: 5 })` | `isError` absent or false (timing accuracy tested in nova-control-command suite) |
| MV-10 | `wait 0` resolves without error | `callTool('wait', { ms: 0 })` | `isError` absent or false |

### MV-state (Part III)

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-11 | `get_state` returns JSON with s1–s5 keys | `callTool('get_state', {})` | text content parses as JSON containing numeric keys `s1`, `s2`, `s3`, `s4`, `s5` |

## Part IV — SC: Script tool

| ID | Description | Input | Expected result |
|---|---|---|---|
| SC-01 | `run_script` delegates to `runScript` and returns success | `callTool('run_script', { script: 'home\nwait 0' })` | `isError` absent or false; `runScript` mock called once |
| SC-02 | error thrown by `runScript` propagates as `isError=true` | `runScript` mock rejects with `"line 1: unknown command 'bad'"`, `callTool('run_script', { script: 'bad' })` | `isError` is true; text contains `line 1` |

## Part V — ER: Error handling

| ID | Description | Input | Expected result |
|---|---|---|---|
| ER-01 | `move` with no servo args returns error | `callTool('move', {})` | `isError` is true; text contains `shift_to` |
| ER-02 | `wait` with negative value returns error | `callTool('wait', { ms: -1 })` | `isError` is true; text contains `-1` |
| ER-03 | `wait` with non-numeric string returns error | `callTool('wait', { ms: 'abc' })` | `isError` is true; text contains `abc` |
| ER-04 | unknown tool name returns an error | `callTool('fly', {})` | `isError` is true; text contains `fly` |
| ER-05 | `openNova` rejection propagates as error | `openNova` mock rejects with `'port not found'`, `callTool('home', {})` | `isError` is true; text contains `port not found` |

## Part VI — DC: Disconnect tool

| ID | Description | Input | Expected result |
|---|---|---|---|
| DC-01 | `disconnect` when connected closes the connection and returns success | call `home` first to open connection, then `callTool('disconnect', {})` | `isError` absent or false; text contains `disconnected` |
| DC-02 | `disconnect` when not connected returns not-connected message without error | `callTool('disconnect', {})` without prior call | `isError` absent or false; text contains `not connected` |

## Part VII — HT: HTTP transport (manual smoke-test only)

The HTTP transport wraps the already-tested `createServer()` with a standard Node.js HTTP server and `StreamableHTTPServerTransport` (stateless mode). It is not covered by automated tests because it requires a live TCP socket. The correctness of the MCP layer is fully verified by Parts I–III.

| ID | Description | Procedure | Expected result |
|---|---|---|---|
| HT-01 | server starts on the given port | `nova-control-mcp-server --port <dev> --transport http --listen 3000` | process stays alive; stderr prints `HTTP transport listening on port 3000` |
| HT-02 | `POST /mcp` accepts a valid request | send MCP initialise request to `http://localhost:3000/mcp` | HTTP 200; valid MCP response body |
| HT-03 | tool call over HTTP succeeds | send `callTool('home')` over HTTP | HTTP 200; `isError` absent or false in response |
| HT-04 | unknown path returns 404 | `GET http://localhost:3000/unknown` | HTTP 404 |
| HT-05 | SIGINT causes clean shutdown | send SIGINT to the process | serial connection closed; process exits 0 |
