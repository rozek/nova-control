# nova-control-mcp-server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for controlling the [NOVA DIY Artificial Intelligence Robot](https://www.creoqode.com/nova) by Creoqode. It exposes the same servo commands as [nova-control-command](../nova-control-command) as MCP tools, allowing any MCP-capable AI assistant (Claude Desktop, Cursor, …) to control the robot arm directly.

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

## Tools

The server exposes the following tools. The serial connection is opened lazily on the first tool call and kept alive for the lifetime of the server process.

| tool | parameters | description |
|---|---|---|
| `home` | — | send all servos to their home positions |
| `move` | `shift_to?`, `roll_to?`, `pitch_to?`, `rotate_to?`, `lift_to?` (all `number`, at least one required) | set one or more servo positions atomically |
| `shift_to` | `deg: number` | shift head forward (>90°) or back (<90°) — s1 |
| `roll_to` | `deg: number` | roll head clockwise (>90°) or counter-clockwise (<90°) — s2 |
| `pitch_to` | `deg: number` | pitch head up (>110°) or down (<110°) — s3 |
| `rotate_to` | `deg: number` | rotate body around Z-axis — s4 |
| `lift_to` | `deg: number` | lift head on secondary axis, range 20°–150° — s5 |
| `wait` | `ms: number` | pause for `ms` milliseconds before the next action |
| `get_state` | — | return current servo positions as a JSON object with keys `s1`–`s5` |

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

- *"Move NOVA's head to look straight up."* → `pitch_to(deg: 130)`
- *"Rotate the body 45° to the left."* → `rotate_to(deg: 45)`
- *"Shift to 100°, wait half a second, then return to home."* → `shift_to(100)` + `wait(500)` + `home()`
- *"What is the current servo state?"* → `get_state()`

## Exit behaviour

The server exits cleanly on `SIGINT` (Ctrl+C) or `SIGTERM`, closing the serial connection before quitting.

## License

MIT
