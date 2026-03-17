/*******************************************************************************
*                                                                              *
*                          nova-control-mcp-server                             *
*                                                                              *
*******************************************************************************/

// MCP server for controlling a NOVA robot arm — exposes the same tools as
// nova-control-command over the Model Context Protocol (stdio or HTTP transport)

import { fileURLToPath }  from 'node:url'
import { realpathSync }   from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { parseArgs }      from 'node:util'

import { Server }                        from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport }          from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { openNova, runScript } from 'nova-control-node'
import type { NovaController, ServoUpdate } from 'nova-control-node'

//----------------------------------------------------------------------------//
//                           CLI argument parsing                             //
//----------------------------------------------------------------------------//

/**** parseCLIArgs — extracts --port, --baud, --transport, and --listen from process.argv ****/

function parseCLIArgs ():{
  Port:string, BaudRate:number,
  Transport:'stdio'|'http', ListenPort:number
} {
  try {
    const { values } = parseArgs({
      args:             process.argv.slice(2),
      options: {
        port:      { type:'string', short:'p' },
        baud:      { type:'string', short:'b' },
        transport: { type:'string', short:'t' },
        listen:    { type:'string', short:'l' },
      },
      strict:           true,
      allowPositionals: false,
    })
    if (values.port == null) {
      process.stderr.write('nova-control-mcp: --port is required\n')
      process.exit(1)
    }
    const TransportMode = (values.transport ?? 'stdio') as string
    if ((TransportMode !== 'stdio') && (TransportMode !== 'http')) {
      process.stderr.write(
        `nova-control-mcp: --transport must be 'stdio' or 'http', ` +
        `got '${TransportMode}'\n`
      )
      process.exit(1)
    }
    return {
      Port:       values.port as string,
      BaudRate:   Number(values.baud ?? '9600'),
      Transport:  TransportMode as 'stdio'|'http',
      ListenPort: Number(values.listen ?? '3000'),
    }
  } catch (Signal:unknown) {
    process.stderr.write(
      `nova-control-mcp: ${(Signal as Error).message ?? Signal}\n`
    )
    process.exit(1)
  }
}

//----------------------------------------------------------------------------//
//                            module-level state                              //
//----------------------------------------------------------------------------//

let _Port:      string = ''
let _BaudRate = 9600
let _ActiveNova: NovaController | undefined

/**** getController — opens (or reuses) the active serial connection ****/

async function getController ():Promise<NovaController> {
  if (_ActiveNova != null) { return _ActiveNova }
  _ActiveNova = await openNova(_Port, _BaudRate)
  return _ActiveNova
}

/**** destroyController — closes the serial connection if one is open ****/

function destroyController ():void {
  if (_ActiveNova == null) { return }
  _ActiveNova.destroy()
  _ActiveNova = undefined
}

//----------------------------------------------------------------------------//
//                              test helpers                                  //
//----------------------------------------------------------------------------//

/**** _setupForTests — injects port and baud rate without a full CLI parse ****/

export function _setupForTests (Port:string, BaudRate:number = 9600):void {
  _Port     = Port
  _BaudRate = BaudRate
}

/**** _destroyForTests — tears down the active connection and resets state ****/

export function _destroyForTests ():void {
  destroyController()
  _Port     = ''
  _BaudRate = 9600
}

//----------------------------------------------------------------------------//
//                              tool definitions                              //
//----------------------------------------------------------------------------//

const ToolList = [
  {
    name:        'home',
    description: (
      'send all servos to their home positions — ' +
      'pass within_ms for smooth, fluid motion with automatic velocity ' +
      'ramp-up and ramp-down; without within_ms the robot moves at ' +
      'constant maximum speed'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {
        within_ms: {
          type:        'number' as const,
          description: 'duration in milliseconds for smooth motion with ' +
                       'trapezoidal ramp-up and ramp-down — servos glide ' +
                       'gradually to the target instead of jumping; omit for ' +
                       'constant-speed movement',
        },
      },
    },
  },
  {
    name:        'move',
    description: (
      'set one or more servo positions atomically — ' +
      'at least one of shift_to, roll_to, pitch_to, rotate_to, lift_to is required; ' +
      'pass within_ms for smooth, fluid motion with automatic velocity ' +
      'ramp-up and ramp-down'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {
        within_ms: {
          type:        'number' as const,
          description: 'duration in milliseconds for smooth motion with ' +
                       'trapezoidal ramp-up and ramp-down — servos glide ' +
                       'gradually to their targets instead of jumping; omit ' +
                       'for constant-speed movement',
        },
        shift_to:  { type:'number', description:'shift head forward (>90°) or back (<90°) — s1' },
        roll_to:   { type:'number', description:'roll head clockwise (>90°) or counter-clockwise (<90°) — s2' },
        pitch_to:  { type:'number', description:'pitch head up (>110°) or down (<110°) — s3' },
        rotate_to: { type:'number', description:'rotate body around Z-axis — s4' },
        lift_to:   { type:'number', description:'lift head on secondary axis, range 20°–150° — s5' },
      },
    },
  },
  {
    name:        'shift_to',
    description: (
      'shift head forward (>90°) or back (<90°) — s1; ' +
      'pass within_ms for smooth motion with trapezoidal velocity profile ' +
      '(ramp-up → constant speed → ramp-down)'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {
        angle:    { type:'number' as const, description:'target angle in degrees' },
        within_ms: {
          type:        'number' as const,
          description: 'duration in milliseconds for smooth motion with ' +
                       'trapezoidal ramp-up and ramp-down; omit for ' +
                       'constant-speed movement',
        },
      },
      required: [ 'angle' ],
    },
  },
  {
    name:        'roll_to',
    description: (
      'roll head clockwise (>90°) or counter-clockwise (<90°) — s2; ' +
      'pass within_ms for smooth motion with trapezoidal velocity profile'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {
        angle:    { type:'number' as const, description:'target angle in degrees' },
        within_ms: {
          type:        'number' as const,
          description: 'duration in milliseconds for smooth motion with ' +
                       'trapezoidal ramp-up and ramp-down; omit for ' +
                       'constant-speed movement',
        },
      },
      required: [ 'angle' ],
    },
  },
  {
    name:        'pitch_to',
    description: (
      'pitch head up (>110°) or down (<110°) — s3; ' +
      'pass within_ms for smooth motion with trapezoidal velocity profile'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {
        angle:    { type:'number' as const, description:'target angle in degrees' },
        within_ms: {
          type:        'number' as const,
          description: 'duration in milliseconds for smooth motion with ' +
                       'trapezoidal ramp-up and ramp-down; omit for ' +
                       'constant-speed movement',
        },
      },
      required: [ 'angle' ],
    },
  },
  {
    name:        'rotate_to',
    description: (
      'rotate body around Z-axis — s4; ' +
      'pass within_ms for smooth motion with trapezoidal velocity profile'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {
        angle:    { type:'number' as const, description:'target angle in degrees' },
        within_ms: {
          type:        'number' as const,
          description: 'duration in milliseconds for smooth motion with ' +
                       'trapezoidal ramp-up and ramp-down; omit for ' +
                       'constant-speed movement',
        },
      },
      required: [ 'angle' ],
    },
  },
  {
    name:        'lift_to',
    description: (
      'lift head on secondary axis, range 20°–150° — s5; ' +
      'pass within_ms for smooth motion with trapezoidal velocity profile'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {
        angle:    { type:'number' as const, description:'target angle in degrees' },
        within_ms: {
          type:        'number' as const,
          description: 'duration in milliseconds for smooth motion with ' +
                       'trapezoidal ramp-up and ramp-down; omit for ' +
                       'constant-speed movement',
        },
      },
      required: [ 'angle' ],
    },
  },
  {
    name:        'move_to',
    description: 'move one or more servos smoothly to their target positions, ' +
                 'completing the movement in the specified number of milliseconds ' +
                 'using a trapezoidal ramp-up/ramp-down profile',
    inputSchema: {
      type:       'object' as const,
      properties: {
        within_ms: { type:'number' as const, description:'total movement duration in milliseconds (must be > 0)' },
        s1: { type:'number' as const, description:'head shift target angle (optional)' },
        s2: { type:'number' as const, description:'head roll target angle (optional)' },
        s3: { type:'number' as const, description:'head pitch target angle (optional)' },
        s4: { type:'number' as const, description:'body rotate target angle (optional)' },
        s5: { type:'number' as const, description:'head lift target angle (optional)' },
      },
      required: [ 'within_ms' ],
    },
  },
  {
    name:        'wait',
    description: 'pause for a given number of milliseconds before the next action',
    inputSchema: {
      type:       'object' as const,
      properties: { ms:{ type:'number', description:'duration in milliseconds (non-negative)' } },
      required:   [ 'ms' ],
    },
  },
  {
    name:        'get_state',
    description: 'return the current servo positions as a JSON object with keys s1–s5',
    inputSchema: {
      type:       'object' as const,
      properties: {},
    },
  },
  {
    name:        'run_script',
    description: (
      'execute a multi-line movement script — one command per line; ' +
      'blank lines and lines starting with # are ignored; ' +
      'commands: home | shift-to <angle> | roll-to <angle> | pitch-to <angle> | ' +
      'rotate-to <angle> | lift-to <angle> | ' +
      'move [shift-to <angle>] [roll-to <angle>] [pitch-to <angle>] ' +
      '[rotate-to <angle>] [lift-to <angle>] | wait <ms>'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {
        script: { type:'string', description:'multi-line movement script' },
      },
      required: [ 'script' ],
    },
  },
  {
    name:        'disconnect',
    description: (
      'close the serial connection to the robot — call this when you are ' +
      'done to free the serial port; the connection reopens automatically ' +
      'on the first subsequent movement command'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {},
    },
  },
]

//----------------------------------------------------------------------------//
//                              tool handlers                                 //
//----------------------------------------------------------------------------//

type ToolArgs = Record<string,unknown>

/**** handleHome ****/

async function handleHome (Args:ToolArgs):Promise<string> {
  const WithinMS = (Args.within_ms != null) ? Number(Args.within_ms) : undefined
  const Nova     = await getController()
  await Nova.home(WithinMS)
  return 'all servos moved to home positions'
}

/**** handleMove ****/

async function handleMove (Args:ToolArgs):Promise<string> {
  const Update:ServoUpdate = {}
  if (Args.shift_to  != null) { Update.s1 = Number(Args.shift_to) }
  if (Args.roll_to   != null) { Update.s2 = Number(Args.roll_to) }
  if (Args.pitch_to  != null) { Update.s3 = Number(Args.pitch_to) }
  if (Args.rotate_to != null) { Update.s4 = Number(Args.rotate_to) }
  if (Args.lift_to   != null) { Update.s5 = Number(Args.lift_to) }
  if (Object.keys(Update).length === 0) {
    throw new Error(
      'move: at least one of shift_to, roll_to, pitch_to, rotate_to, lift_to is required'
    )
  }
  const WithinMS = (Args.within_ms != null) ? Number(Args.within_ms) : undefined
  const Nova     = await getController()
  await Nova.moveTo(Update, WithinMS)
  return `servos updated: ${JSON.stringify(Update)}`
}

/**** handleShiftTo ****/

async function handleShiftTo (Args:ToolArgs):Promise<string> {
  const Angle    = Number(Args.angle)
  const WithinMS = (Args.within_ms != null) ? Number(Args.within_ms) : undefined
  const Nova     = await getController()
  await Nova.shiftHeadTo(Angle, WithinMS)
  return `s1 (shift) → ${Angle}°`
}

/**** handleRollTo ****/

async function handleRollTo (Args:ToolArgs):Promise<string> {
  const Angle    = Number(Args.angle)
  const WithinMS = (Args.within_ms != null) ? Number(Args.within_ms) : undefined
  const Nova     = await getController()
  await Nova.rollHeadTo(Angle, WithinMS)
  return `s2 (roll) → ${Angle}°`
}

/**** handlePitchTo ****/

async function handlePitchTo (Args:ToolArgs):Promise<string> {
  const Angle    = Number(Args.angle)
  const WithinMS = (Args.within_ms != null) ? Number(Args.within_ms) : undefined
  const Nova     = await getController()
  await Nova.pitchHeadTo(Angle, WithinMS)
  return `s3 (pitch) → ${Angle}°`
}

/**** handleRotateTo ****/

async function handleRotateTo (Args:ToolArgs):Promise<string> {
  const Angle    = Number(Args.angle)
  const WithinMS = (Args.within_ms != null) ? Number(Args.within_ms) : undefined
  const Nova     = await getController()
  await Nova.rotateBodyTo(Angle, WithinMS)
  return `s4 (rotate) → ${Angle}°`
}

/**** handleLiftTo ****/

async function handleLiftTo (Args:ToolArgs):Promise<string> {
  const Angle    = Number(Args.angle)
  const WithinMS = (Args.within_ms != null) ? Number(Args.within_ms) : undefined
  const Nova     = await getController()
  await Nova.liftHeadTo(Angle, WithinMS)
  return `s5 (lift) → ${Angle}°`
}

/**** handleDisconnect ****/

async function handleDisconnect ():Promise<string> {
  if (_ActiveNova == null) { return 'not connected' }
  destroyController()
  return 'disconnected'
}

/**** handleMoveTo ****/

async function handleMoveTo (Args:ToolArgs):Promise<string> {
  const WithinMS = Number(Args.within_ms)
  if (isNaN(WithinMS) || (WithinMS <= 0)) {
    throw new Error('move_to: within_ms must be a positive number')
  }
  const Update:ServoUpdate = {}
  if (Args.s1 != null) { Update.s1 = Number(Args.s1) }
  if (Args.s2 != null) { Update.s2 = Number(Args.s2) }
  if (Args.s3 != null) { Update.s3 = Number(Args.s3) }
  if (Args.s4 != null) { Update.s4 = Number(Args.s4) }
  if (Args.s5 != null) { Update.s5 = Number(Args.s5) }
  if (Object.keys(Update).length === 0) {
    throw new Error('move_to: at least one servo target (s1–s5) must be specified')
  }
  const Nova = await getController()
  await Nova.moveTo(Update, WithinMS)
  return 'move completed'
}

/**** handleWait ****/

async function handleWait (Args:ToolArgs):Promise<string> {
  const Duration = Number(Args.ms)
  if (isNaN(Duration) || (Duration < 0)) {
    throw new Error(
      `wait: invalid duration '${Args.ms}' — expected a non-negative number`
    )
  }
  await new Promise<void>((resolve) => setTimeout(resolve, Duration))
  return `waited ${Duration} ms`
}

/**** handleGetState ****/

async function handleGetState ():Promise<string> {
  const Nova = await getController()
  return JSON.stringify(Nova.State)
}

/**** handleRunScript ****/

async function handleRunScript (Args:ToolArgs):Promise<string> {
  const Script = String(Args.script ?? '')
  const Nova   = await getController()
  await runScript(Nova, Script)
  return 'script executed successfully'
}

//----------------------------------------------------------------------------//
//                                  Server                                   //
//----------------------------------------------------------------------------//

/**** createServer — constructs and configures the MCP server ****/

export function createServer ():Server {
  const McpServer = new Server(
    { name:'nova-control-mcp-server', version:'0.0.8' },
    { capabilities:{ tools:{} } }
  )

  McpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ToolList,
  }))

  McpServer.setRequestHandler(CallToolRequestSchema, async (Request) => {
    const ToolName = Request.params.name
    const Args     = (Request.params.arguments ?? {}) as ToolArgs
    try {
      let Result:string
      switch (ToolName) {
        case 'home':      Result = await handleHome(Args);      break
        case 'move':      Result = await handleMove(Args);     break
        case 'shift_to':  Result = await handleShiftTo(Args);  break
        case 'roll_to':   Result = await handleRollTo(Args);   break
        case 'pitch_to':  Result = await handlePitchTo(Args);  break
        case 'rotate_to': Result = await handleRotateTo(Args); break
        case 'lift_to':   Result = await handleLiftTo(Args);   break
        case 'move_to':   Result = await handleMoveTo(Args);   break
        case 'wait':      Result = await handleWait(Args);     break
        case 'get_state':   Result = await handleGetState();       break
        case 'run_script':   Result = await handleRunScript(Args);    break
        case 'disconnect':   Result = await handleDisconnect();       break
        default:
          return {
            content: [{ type:'text' as const, text:`unknown tool: ${ToolName}` }],
            isError: true,
          }
      }
      return { content: [{ type:'text' as const, text:Result }] }
    } catch (Signal:unknown) {
      const Message = (Signal instanceof Error) ? Signal.message : String(Signal)
      return {
        content: [{ type:'text' as const, text:Message }],
        isError: true,
      }
    }
  })

  return McpServer
}

//----------------------------------------------------------------------------//
//                                   main                                     //
//----------------------------------------------------------------------------//

/**** startStdioTransport — connects the MCP server over stdin/stdout ****/

async function startStdioTransport (McpServer:Server):Promise<void> {
  const Transport = new StdioServerTransport()
  await McpServer.connect(Transport)

  for (const Sig of [ 'SIGINT', 'SIGTERM' ]) {
    process.on(Sig, () => {
      destroyController()
      process.exit(0)
    })
  }
}

/**** startHttpTransport — connects the MCP server over Streamable HTTP ****/

async function startHttpTransport (
  McpServer:Server, ListenPort:number
):Promise<void> {
  const Transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,  // stateless — one server, many requests
  })
  await McpServer.connect(Transport)

  const HttpServer = createHttpServer(async (Req, Res) => {
    if (Req.url === '/mcp') {
      await Transport.handleRequest(Req, Res)
    } else {
      Res.writeHead(404, { 'Content-Type':'text/plain' })
      Res.end('not found')
    }
  })

  await new Promise<void>((resolve, reject) => {
    HttpServer.listen(ListenPort, () => {
      process.stderr.write(
        `nova-control-mcp: HTTP transport listening on port ${ListenPort} — ` +
        `POST /mcp\n`
      )
      resolve()
    })
    HttpServer.once('error', reject)
  })

  for (const Sig of [ 'SIGINT', 'SIGTERM' ]) {
    process.on(Sig, async () => {
      await Transport.close()
      HttpServer.close()
      destroyController()
      process.exit(0)
    })
  }
}

/**** main — MCP server entry point ****/

async function main ():Promise<void> {
  const { Port, BaudRate, Transport, ListenPort } = parseCLIArgs()
  _Port     = Port
  _BaudRate = BaudRate

  const McpServer = createServer()

  if (Transport === 'http') {
    await startHttpTransport(McpServer, ListenPort)
  } else {
    await startStdioTransport(McpServer)
  }
}

//----------------------------------------------------------------------------//
//                                entry point                                 //
//----------------------------------------------------------------------------//

// only run when this file is executed as the entry point, not when imported
// realpathSync resolves any npm/npx symlinks so the comparison works correctly
if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((Signal) => {
    process.stderr.write(
      `nova-control-mcp: fatal: ${(Signal as Error).message ?? Signal}\n`
    )
    process.exit(1)
  })
}
