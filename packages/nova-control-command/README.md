# nova-control-command

CLI for controlling a **NOVA DIY Artificial Intelligence Robot** by Creoqode. Provides one-shot commands, an interactive REPL shell, and a batch script runner for moving servos, running motion sequences, and inspecting the current servo state.

---

## Prerequisites

| requirement | details |
| --- | --- |
| **Node.js 22+** | required to run `nova-control`. Download from [nodejs.org](https://nodejs.org). |
| **NOVA robot** | connected via USB serial. The Arduino sketch must be flashed and running before issuing commands. |
| **Linux serial permissions** | on Linux, add your user to the `dialout` group: `sudo usermod -aG dialout $USER` (re-login required). |

---

## Installation

**Global install** — installs the `nova-control` binary on the `PATH`:

```bash
npm install -g nova-control-command
nova-control --port /dev/ttyACM0 home
```

**No install — run directly with `npx`:**

```bash
npx nova-control-command --port /dev/ttyACM0 home
npx nova-control-command --port /dev/ttyACM0 shell
```

`npx` downloads the package on first use and caches it locally. All examples in this document use the `nova-control` binary name (global install); substitute `npx nova-control-command` when running via npx.

**Local install** — adds the binary to `node_modules/.bin/`:

```bash
npm install nova-control-command
```

---

## Concepts

| mode | how to trigger |
| --- | --- |
| one-shot | `nova-control --port <path> <command> [args]` — runs a single command and exits |
| script | `nova-control --port <path> --script <file>` — reads commands line-by-line from a file or stdin (`-`) |
| REPL | `nova-control --port <path> shell` — opens an interactive read-eval-print loop |

`nova-control` without any arguments prints the help text and exits.

In script and REPL mode the serial connection is opened once on the first servo command and kept alive for the duration of the session — `wait` and `help` do not touch the port.

---

## Global options

| option | description |
| --- | --- |
| `--port <path>` | serial port path (e.g. `/dev/ttyACM0` on Linux/macOS, `COM3` on Windows) |
| `--baud <rate>` | baud rate (default: `9600`) |
| `--on-error <mode>` | script error mode: `stop` (default), `continue`, or `ask` |
| `--script <file>` | run commands from a file (`-` reads from stdin) |
| `--version` | print version number and exit |

---

## Command reference

### `home`

```
nova-control --port <path> home
```

Sends all five servos to their home positions simultaneously. Home positions are baked into the firmware (`s1=90°`, `s2=90°`, `s3=110°`, `s4=90°`, `s5=95°`).

---

### Individual servo commands

Each command sets exactly one servo and leaves all others at their last-sent positions.

```
nova-control --port <path> shift-to  <deg>   # head forward (>90°) or back (<90°) — s1
nova-control --port <path> roll-to   <deg>   # head clockwise (>90°) or counter-clockwise (<90°) — s2
nova-control --port <path> pitch-to  <deg>   # head up (>110°) or down (<110°) — s3
nova-control --port <path> rotate-to <deg>   # body rotation around Z-axis — s4
nova-control --port <path> lift-to   <deg>   # secondary head lift, range 20°–150° — s5
```

`<deg>` is a number in degrees. The firmware clamps out-of-range values silently.

---

### `move`

```
nova-control --port <path> move [--shift-to <deg>] [--roll-to <deg>] [--pitch-to <deg>]
                                 [--rotate-to <deg>] [--lift-to <deg>]
```

Sets multiple servos in a single packet. At least one option is required. Servos not mentioned stay at their last-sent positions. Useful when two or more joints must move simultaneously.

---

### `wait`

```
nova-control --port <path> wait <ms>
```

Pauses execution for `<ms>` milliseconds before the next command. Does not open the serial connection. Particularly useful in scripts and the REPL to let the robot settle between moves.

---

### `state`

```
nova-control --port <path> state
```

Prints the current servo state as a single JSON object to stdout. The state reflects what was last *sent* to the Arduino — there is no read-back channel in the protocol.

---

### `shell`

```
nova-control --port <path> shell
```

Opens an interactive REPL. Each line is parsed and executed as a `nova-control` command without the `nova-control` prefix. Blank lines and lines starting with `#` are ignored. Type `exit` or `quit` to close the session.

The serial port is opened on the first command that needs it and held open for the entire session.

**Getting help inside the REPL:**

| what you type | what you get |
| --- | --- |
| `help` | list of all available commands |
| `<command> --help` | help for a specific command (e.g. `move --help`) |

---

### `--script`

```
nova-control --port <path> --script <file>
nova-control --port <path> --script -        # read from stdin
```

Reads commands from a file (or stdin), executing them one per line. Lines starting with `#` and blank lines are ignored. Error handling follows `--on-error`: `stop` aborts on the first error (default), `continue` keeps going, `ask` prompts interactively (TTY only, falls back to `stop` in pipes).

---

## Examples

### One-shot commands

```bash
# send all servos home
nova-control --port /dev/ttyACM0 home

# move the head forward and look up
nova-control --port /dev/ttyACM0 shift-to 110
nova-control --port /dev/ttyACM0 pitch-to 130

# rotate the body 30° clockwise from centre
nova-control --port /dev/ttyACM0 rotate-to 120

# move head and body simultaneously in one packet
nova-control --port /dev/ttyACM0 move --shift-to 100 --rotate-to 120

# check the current state
nova-control --port /dev/ttyACM0 state
```

---

### Motion script

A script file runs a complete motion sequence from a file, pausing between moves with `wait`:

```
# greeting.nova — wave the head left and right
home
wait 500
shift-to 110
wait 400
shift-to 70
wait 400
shift-to 110
wait 400
home
```

Run it:

```bash
nova-control --port /dev/ttyACM0 --script greeting.nova
```

Pipe a script from stdin:

```bash
printf 'home\nwait 500\nshift-to 110\nwait 1000\nhome\n' \
  | nova-control --port /dev/ttyACM0 --script -
```

---

### Interactive REPL session

```
$ nova-control --port /dev/ttyACM0 shell
NOVA interactive shell — type "help [command]" for help, "exit" to quit
nova-control> home
nova-control> wait 500
nova-control> shift-to 100
nova-control> roll-to 60
nova-control> state
{"s1":100,"s2":60,"s3":110,"s4":90,"s5":95}
nova-control> home
nova-control> exit
```

---

## Exit codes

| code | meaning |
| --- | --- |
| `0` | success |
| `1` | unspecified runtime error (e.g. serial port refused to open) |
| `2` | bad arguments or missing required option |

---

## License

[MIT License](../../LICENSE.md) © Andreas Rozek
