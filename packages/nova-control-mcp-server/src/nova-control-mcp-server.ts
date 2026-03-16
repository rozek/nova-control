/*******************************************************************************
*                                                                              *
*                          nova-control-mcp-server                             *
*                                                                              *
*******************************************************************************/

// MCP server for controlling a NOVA robot arm — exposes the same tools as
// nova-control-command over the Model Context Protocol (stdio transport)

import { fileURLToPath } from 'node:url'
import { parseArgs }     from 'node:util'

import { Server }               from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { openNova } from 'nova-control-node'
import type { NovaController, ServoUpdate } from 'nova-control-node'

//----------------------------------------------------------------------------//
//                           CLI argument parsing                             //
//----------------------------------------------------------------------------//

/**** parseCLIArgs — extracts --port and --baud from process.argv ****/

function parseCLIArgs ():{Port:string, BaudRate:number} {
  try {
    const { values } = parseArgs({
      args:             process.argv.slice(2),
      options: {
        port: { type:'string', short:'p' },
        baud: { type:'string', short:'b' },
      },
      strict:           true,
      allowPositionals: false,
    })
    if (values.port == null) {
      process.stderr.write('nova-control-mcp: --port is required\n')
      process.exit(1)
    }
    return {
      Port:     values.port as string,
      BaudRate: Number(values.baud ?? '9600'),
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
    description: 'send all servos to their home positions',
    inputSchema: {
      type:       'object' as const,
      properties: {},
    },
  },
  {
    name:        'move',
    description: (
      'set one or more servo positions atomically — ' +
      'at least one of shift_to, roll_to, pitch_to, rotate_to, lift_to is required'
    ),
    inputSchema: {
      type:       'object' as const,
      properties: {
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
    description: 'shift head forward (>90°) or back (<90°) — s1',
    inputSchema: {
      type:       'object' as const,
      properties: { deg:{ type:'number', description:'target angle in degrees' } },
      required:   [ 'deg' ],
    },
  },
  {
    name:        'roll_to',
    description: 'roll head clockwise (>90°) or counter-clockwise (<90°) — s2',
    inputSchema: {
      type:       'object' as const,
      properties: { deg:{ type:'number', description:'target angle in degrees' } },
      required:   [ 'deg' ],
    },
  },
  {
    name:        'pitch_to',
    description: 'pitch head up (>110°) or down (<110°) — s3',
    inputSchema: {
      type:       'object' as const,
      properties: { deg:{ type:'number', description:'target angle in degrees' } },
      required:   [ 'deg' ],
    },
  },
  {
    name:        'rotate_to',
    description: 'rotate body around Z-axis — s4',
    inputSchema: {
      type:       'object' as const,
      properties: { deg:{ type:'number', description:'target angle in degrees' } },
      required:   [ 'deg' ],
    },
  },
  {
    name:        'lift_to',
    description: 'lift head on secondary axis, range 20°–150° — s5',
    inputSchema: {
      type:       'object' as const,
      properties: { deg:{ type:'number', description:'target angle in degrees' } },
      required:   [ 'deg' ],
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
]

//----------------------------------------------------------------------------//
//                              tool handlers                                 //
//----------------------------------------------------------------------------//

type ToolArgs = Record<string,unknown>

/**** handleHome ****/

async function handleHome ():Promise<string> {
  const Nova = await getController()
  await Nova.home()
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
  const Nova = await getController()
  Nova.State = Update
  await Nova.sendServoState()
  return `servos updated: ${JSON.stringify(Update)}`
}

/**** handleShiftTo ****/

async function handleShiftTo (Args:ToolArgs):Promise<string> {
  const Deg  = Number(Args.deg)
  const Nova = await getController()
  Nova.State = { s1:Deg }
  await Nova.sendServoState()
  return `s1 (shift) → ${Deg}°`
}

/**** handleRollTo ****/

async function handleRollTo (Args:ToolArgs):Promise<string> {
  const Deg  = Number(Args.deg)
  const Nova = await getController()
  Nova.State = { s2:Deg }
  await Nova.sendServoState()
  return `s2 (roll) → ${Deg}°`
}

/**** handlePitchTo ****/

async function handlePitchTo (Args:ToolArgs):Promise<string> {
  const Deg  = Number(Args.deg)
  const Nova = await getController()
  Nova.State = { s3:Deg }
  await Nova.sendServoState()
  return `s3 (pitch) → ${Deg}°`
}

/**** handleRotateTo ****/

async function handleRotateTo (Args:ToolArgs):Promise<string> {
  const Deg  = Number(Args.deg)
  const Nova = await getController()
  Nova.State = { s4:Deg }
  await Nova.sendServoState()
  return `s4 (rotate) → ${Deg}°`
}

/**** handleLiftTo ****/

async function handleLiftTo (Args:ToolArgs):Promise<string> {
  const Deg  = Number(Args.deg)
  const Nova = await getController()
  Nova.State = { s5:Deg }
  await Nova.sendServoState()
  return `s5 (lift) → ${Deg}°`
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

//----------------------------------------------------------------------------//
//                                  Server                                   //
//----------------------------------------------------------------------------//

/**** createServer — constructs and configures the MCP server ****/

export function createServer ():Server {
  const McpServer = new Server(
    { name:'nova-control-mcp-server', version:'0.0.1' },
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
        case 'home':      Result = await handleHome();         break
        case 'move':      Result = await handleMove(Args);     break
        case 'shift_to':  Result = await handleShiftTo(Args);  break
        case 'roll_to':   Result = await handleRollTo(Args);   break
        case 'pitch_to':  Result = await handlePitchTo(Args);  break
        case 'rotate_to': Result = await handleRotateTo(Args); break
        case 'lift_to':   Result = await handleLiftTo(Args);   break
        case 'wait':      Result = await handleWait(Args);     break
        case 'get_state': Result = await handleGetState();     break
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

/**** main — MCP server entry point ****/

async function main ():Promise<void> {
  const { Port, BaudRate } = parseCLIArgs()
  _Port     = Port
  _BaudRate = BaudRate

  const McpServer = createServer()
  const Transport = new StdioServerTransport()
  await McpServer.connect(Transport)

  for (const Sig of [ 'SIGINT', 'SIGTERM' ]) {
    process.on(Sig, () => {
      destroyController()
      process.exit(0)
    })
  }
}

//----------------------------------------------------------------------------//
//                                entry point                                 //
//----------------------------------------------------------------------------//

// only run when this file is executed as the entry point, not when imported
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((Signal) => {
    process.stderr.write(
      `nova-control-mcp: fatal: ${(Signal as Error).message ?? Signal}\n`
    )
    process.exit(1)
  })
}
