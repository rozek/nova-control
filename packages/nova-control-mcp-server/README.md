# nova-control-mcp-server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for controlling the [NOVA DIY Artificial Intelligence Robot](https://www.creoqode.com/nova) by Creoqode. It exposes the same servo commands as [nova-control-command](../nova-control-command/README.md) as MCP tools, allowing any MCP-capable AI assistant (Claude Desktop, Cursor, …) to control the robot arm directly.

## Prerequisites

| requirement | details |
|---|---|
| Node.js | v22 or later |
| NOVA robot | connected via USB serial port |
| serial permissions | on Linux: `sudo usermod -aG dialout $USER` (re-login required) |

## Installation

**No install — run directly with `npx`** (recommended for MCP clients):

```bash
npx nova-control-mcp-server --port /dev/ttyACM0
```

`npx` downloads the package on first use and caches it locally. This is the simplest way to use the server and requires no global installation.

**Global install:**

```bash
npm install -g nova-control-mcp-server
nova-control-mcp-server --port /dev/ttyACM0
```

## Configuration

### Claude Desktop

Add the server to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "nova-control": {
      "command": "npx",
      "args": ["nova-control-mcp-server", "--port", "/dev/ttyACM0"]
    }
  }
}
```

With a custom baud rate:

```json
{
  "mcpServers": {
    "nova-control": {
      "command": "npx",
      "args": ["nova-control-mcp-server", "--port", "/dev/ttyACM0", "--baud", "115200"]
    }
  }
}
```

### Cursor

Add the same block under `mcpServers` in `~/.cursor/mcp.json`.

### Command-line options

| option | short | default | description |
|---|---|---|---|
| `--port <path>` | `-p` | *(required)* | serial port path (e.g. `/dev/ttyACM0`, `COM3`) |
| `--baud <rate>` | `-b` | `9600` | baud rate |
| `--transport <mode>` | `-t` | `stdio` | transport: `stdio` or `http` |
| `--listen <port>` | `-l` | `3000` | HTTP listen port (only used when `--transport http`) |

## HTTP transport (Docker / remote)

Use `--transport http` to expose the MCP server over HTTP instead of stdio. This is the recommended mode when the server runs in a Docker container or on a remote machine.

The server listens on the given port and accepts MCP requests at `POST /mcp`.

```bash
nova-control-mcp-server --port /dev/ttyACM0 --transport http --listen 3000
```

### Docker example

```dockerfile
FROM node:22-slim
RUN npm install -g nova-control-mcp-server
EXPOSE 3000
CMD ["nova-control-mcp-server", "--port", "/dev/ttyACM0", \
     "--transport", "http", "--listen", "3000"]
```

Run the container with the serial device passed through:

```bash
docker run --device /dev/ttyACM0 -p 3000:3000 nova-mcp
```

### Connecting an MCP client to the HTTP transport

Point your MCP client at `http://<host>:3000/mcp`. For Claude Desktop with a remote server, use the `url` transport type:

```json
{
  "mcpServers": {
    "nova-control": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Tools

The server exposes the following tools. The serial connection is opened lazily on the first tool call; call `disconnect` to free the port, or let the server exit cleanly.

All movement tools accept an optional `within_ms` parameter. When provided, the robot moves smoothly to the target using a trapezoidal velocity profile (ramp-up → constant speed → ramp-down) over the given number of milliseconds. Without `within_ms`, the servos move at constant maximum speed.

| tool | parameters | description |
|---|---|---|
| `home` | `within_ms?` | send all servos to their home positions |
| `move` | `shift_to?`, `roll_to?`, `pitch_to?`, `rotate_to?`, `lift_to?` (at least one required); `within_ms?` | set one or more servo positions atomically |
| `move_to` | `within_ms: number` (required, must be > 0); `s1?`, `s2?`, `s3?`, `s4?`, `s5?` | move one or more servos smoothly to target positions using a trapezoidal ramp-up/ramp-down profile |
| `shift_to` | `angle: number`; `within_ms?` | shift head forward (>90°) or back (<90°) — s1 |
| `roll_to` | `angle: number`; `within_ms?` | roll head clockwise (>90°) or counter-clockwise (<90°) — s2 |
| `pitch_to` | `angle: number`; `within_ms?` | pitch head up (>110°) or down (<110°) — s3 |
| `rotate_to` | `angle: number`; `within_ms?` | rotate body around Z-axis — s4 |
| `lift_to` | `angle: number`; `within_ms?` | lift head on secondary axis, range 20°–150° — s5 |
| `wait` | `ms: number` | pause for `ms` milliseconds before the next action |
| `get_state` | — | return current servo positions as a JSON object with keys `s1`–`s5` |
| `run_script` | `script: string` | execute a multi-line movement script (one command per line; blank lines and `#`-comments ignored; commands: `home [<within_ms>]`, `shift-to <angle> [<within_ms>]`, `roll-to`, `pitch-to`, `rotate-to`, `lift-to`, `move [...] [within-ms <ms>]`, `wait <ms>`) |
| `disconnect` | — | close the serial connection to free the port; the connection reopens automatically on the next movement command |

### Servo mapping

| key | tool suffix | direction |
|---|---|---|
| s1 | `shift_to` | forward/back |
| s2 | `roll_to` | clockwise/counter-clockwise |
| s3 | `pitch_to` | up/down |
| s4 | `rotate_to` | Z-axis rotation |
| s5 | `lift_to` | secondary lift axis |

## Usage examples

Once the server is running inside Claude Desktop you can give natural-language instructions like:

- *"Move NOVA's head to look straight up."* → `pitch_to(angle: 130)`
- *"Rotate the body 45° to the right."* → `rotate_to(angle: 45)`
- *"Move the head to 120° smoothly over 800 ms."* → `move_to(within_ms: 800, s1: 120)`
- *"Shift to 100° with a fluid ramp, wait half a second, then return to home."* → `shift_to(angle: 100, within_ms: 600)` + `wait(500)` + `home()`
- *"What is the current servo state?"* → `get_state()`
- *"Run the greeting sequence from this script."* → `run_script(script: "home\nwait 500\nshift-to 110\nwait 400\nhome")`
- *"Free the serial port."* → `disconnect()`

## Exit behaviour

The server exits cleanly on `SIGINT` (Ctrl+C) or `SIGTERM`, closing the serial connection before quitting.

## Related packages

| package | description |
|---|---|
| [`nova-control-browser`](../nova-control-browser/README.md) | browser ESM module — Web Serial API (Chrome / Edge 89+) |
| [`nova-control-node`](../nova-control-node/README.md) | Node.js ESM module — `serialport` package (used internally by this server) |
| [`nova-control-command`](../nova-control-command/README.md) | CLI — one-shot commands, interactive REPL, and script files |

## License

MIT
