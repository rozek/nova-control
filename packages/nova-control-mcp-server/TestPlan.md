# nova-control-mcp-server — Test Plan

## Scope

Automated tests for the `nova-control-mcp-server` package. All tests run without physical hardware: `nova-control-node`'s `openNova` function is replaced by a vitest mock that returns a fake `NovaController`.

The server is tested end-to-end through the MCP protocol using the SDK's `InMemoryTransport.createLinkedPair()` and a real `Client` instance. This exercises request serialisation, handler dispatch, and response shape — not just the raw handler functions.

## Test environment

| Item | Details |
|---|---|
| Runtime | Node.js 22+ |
| Framework | Vitest 4 |
| Transport | `@modelcontextprotocol/sdk` `InMemoryTransport` (in-process, no stdio) |
| Serial port | mocked via `vi.hoisted` + `vi.mock('nova-control-node', …)` |
| Entry under test | `createServer()` export + `_setupForTests` / `_destroyForTests` helpers |

## Test parts

### Part I — SH: Server handshake

Verifies that the server starts correctly and advertises its capabilities.

- connects via `InMemoryTransport` without error
- `tools/list` returns exactly the nine expected tool names

### Part II — MV: Motion tools

Verifies that each tool triggers the correct `NovaController` method and returns a non-error response.

| Subgroup | Tools covered |
|---|---|
| MV-home | `home` |
| MV-servo | `shift_to`, `roll_to`, `pitch_to`, `rotate_to`, `lift_to` |
| MV-move | `move` (single servo, multiple servos atomically) |
| MV-wait | `wait` with valid duration, fake timers |
| MV-state | `get_state` |

### Part III — ER: Error handling

Verifies that tools return `isError: true` with a descriptive message for invalid inputs, and that a rejected `openNova` propagates correctly.

| Subgroup | Scenario |
|---|---|
| ER-move | `move` with no servo arguments |
| ER-wait | `wait` with negative value; non-numeric value |
| ER-unknown | call to an unknown tool name |
| ER-open | `openNova` rejection |

### Part IV — HT: HTTP transport (infrastructure — not automated)

The HTTP transport (`--transport http`) wraps the already end-to-end-tested `createServer()` with a standard Node.js HTTP server and the MCP SDK's `StreamableHTTPServerTransport`. It is not covered by automated unit tests because it requires a live TCP socket; the correctness of `createServer()` is already verified by Parts I–III.

Manual smoke-test procedure (not part of the automated suite):

1. Start the server with `--transport http --listen 3000`.
2. Send `POST /mcp` with a valid MCP initialise request — verify a 200 response.
3. Call a tool (e.g. `home`) over HTTP — verify a success response.
4. Send `GET /unknown` — verify a 404 response.
5. Send SIGINT — verify the process exits cleanly.

## Pass criteria

All automated tests must report **passed** with zero errors. The test suite must complete without touching `/dev/tty*` or any real serial device.
