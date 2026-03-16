# nova-control-mcp-server — Test Cases

## Part I — SH: Server handshake

| ID | Description | Input | Expected result |
|---|---|---|---|
| SH-01 | server connects without error | `InMemoryTransport` pair, `createServer().connect(serverTransport)`, `client.connect(clientTransport)` | no exception thrown |
| SH-02 | `tools/list` returns all nine tools | `client.listTools()` | result contains exactly the names `home`, `move`, `shift_to`, `roll_to`, `pitch_to`, `rotate_to`, `lift_to`, `wait`, `get_state` |

## Part II — MV: Motion tools

### MV-home

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-01 | `home` calls `Nova.home()` | `callTool('home', {})` | `isError` absent or false; `MockNova.home` called once |

### MV-servo (individual servo commands)

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-02 | `shift_to` sets s1 and calls `sendServoState` | `callTool('shift_to', { deg: 100 })` | `LastStateUpdate` equals `{ s1: 100 }`; `sendServoState` called once |
| MV-03 | `roll_to` sets s2 | `callTool('roll_to', { deg: 60 })` | `LastStateUpdate` equals `{ s2: 60 }` |
| MV-04 | `pitch_to` sets s3 | `callTool('pitch_to', { deg: 80 })` | `LastStateUpdate` equals `{ s3: 80 }` |
| MV-05 | `rotate_to` sets s4 | `callTool('rotate_to', { deg: 120 })` | `LastStateUpdate` equals `{ s4: 120 }` |
| MV-06 | `lift_to` sets s5 | `callTool('lift_to', { deg: 30 })` | `LastStateUpdate` equals `{ s5: 30 }` |

### MV-move

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-07 | `move` with one servo sets that servo | `callTool('move', { shift_to: 100 })` | `LastStateUpdate` equals `{ s1: 100 }`; `sendServoState` called once |
| MV-08 | `move` with two servos sets both atomically | `callTool('move', { shift_to: 100, rotate_to: 120 })` | `LastStateUpdate` equals `{ s1: 100, s4: 120 }`; `sendServoState` called once |

### MV-wait

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-09 | `wait` with a small positive duration resolves without error | `callTool('wait', { ms: 5 })` | `isError` absent or false (timing accuracy tested in nova-control-command suite) |
| MV-10 | `wait 0` resolves without error | `callTool('wait', { ms: 0 })` | `isError` absent or false |

### MV-state

| ID | Description | Input | Expected result |
|---|---|---|---|
| MV-11 | `get_state` returns JSON with s1–s5 keys | `callTool('get_state', {})` | text content parses as JSON containing numeric keys `s1`, `s2`, `s3`, `s4`, `s5` |

## Part III — ER: Error handling

| ID | Description | Input | Expected result |
|---|---|---|---|
| ER-01 | `move` with no servo args returns error | `callTool('move', {})` | `isError` is true; text contains `shift_to` |
| ER-02 | `wait` with negative value returns error | `callTool('wait', { ms: -1 })` | `isError` is true; text contains `-1` |
| ER-03 | `wait` with non-numeric string returns error | `callTool('wait', { ms: 'abc' })` | `isError` is true; text contains `abc` |
| ER-04 | `openNova` rejection propagates as error | `openNova` mock rejects with `'port not found'`, `callTool('home', {})` | `isError` is true; text contains `port not found` |

## Part IV — HT: HTTP transport (manual smoke-test only)

The HTTP transport wraps the already-tested `createServer()` with a standard Node.js HTTP server and `StreamableHTTPServerTransport` (stateless mode). It is not covered by automated tests because it requires a live TCP socket. The correctness of the MCP layer is fully verified by Parts I–III.

| ID | Description | Procedure | Expected result |
|---|---|---|---|
| HT-01 | server starts on the given port | `nova-control-mcp-server --port <dev> --transport http --listen 3000` | process stays alive; stderr prints `HTTP transport listening on port 3000` |
| HT-02 | `POST /mcp` accepts a valid request | send MCP initialise request to `http://localhost:3000/mcp` | HTTP 200; valid MCP response body |
| HT-03 | tool call over HTTP succeeds | send `callTool('home')` over HTTP | HTTP 200; `isError` absent or false in response |
| HT-04 | unknown path returns 404 | `GET http://localhost:3000/unknown` | HTTP 404 |
| HT-05 | SIGINT causes clean shutdown | send SIGINT to the process | serial connection closed; process exits 0 |
