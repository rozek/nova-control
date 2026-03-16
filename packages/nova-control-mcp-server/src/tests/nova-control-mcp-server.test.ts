/*******************************************************************************
*                                                                              *
*                   nova-control-mcp-server — integration tests                *
*                                                                              *
*******************************************************************************/

// covers: SH (handshake), MV (motion tools), ER (error handling)
// tests via the MCP protocol using InMemoryTransport — no physical port required

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { Client }           from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

//----------------------------------------------------------------------------//
//                              Module Mocks                                  //
//----------------------------------------------------------------------------//

/**** hoisted variables shared between vi.mock factories and test bodies ****/

const Hoisted = vi.hoisted(() => {
  let LastStateUpdate: Record<string, number> | undefined

  const MockNova = {
    home:           vi.fn().mockResolvedValue(undefined),
    sendServoState: vi.fn().mockResolvedValue(undefined),
    destroy:        vi.fn(),

    get State () {
      return { s1:90, s2:90, s3:110, s4:90, s5:95 }
    },
    set State (Update:Record<string, number>) {
      LastStateUpdate = Update
    },
  }

  const openNova = vi.fn().mockResolvedValue(MockNova)

  return {
    MockNova,
    openNova,
    get LastStateUpdate () { return LastStateUpdate },
    clearLastStateUpdate () { LastStateUpdate = undefined },
  }
})

vi.mock('nova-control-node', () => ({
  openNova: Hoisted.openNova,
}))

//----------------------------------------------------------------------------//
//                          Subject Under Test                                //
//----------------------------------------------------------------------------//

import {
  createServer,
  _setupForTests,
  _destroyForTests,
} from '../nova-control-mcp-server.js'

//----------------------------------------------------------------------------//
//                          Test Helpers                                      //
//----------------------------------------------------------------------------//

/**** makeConnectedPair — creates a fresh server+client pair for each test ****/

async function makeConnectedPair ():{
  McpClient: Client,
  disconnect: () => Promise<void>,
} {
  const [ ClientTransport, ServerTransport ] = InMemoryTransport.createLinkedPair()

  const McpServer = createServer()
  await McpServer.connect(ServerTransport)

  const McpClient = new Client(
    { name:'test-client', version:'1.0.0' },
    { capabilities:{} }
  )
  await McpClient.connect(ClientTransport)

  return {
    McpClient,
    disconnect: async () => {
      await McpClient.close()
      await McpServer.close()
    },
  }
}

/**** callTool — shorthand with typed args ****/

async function callTool (
  McpClient:Client, Name:string, Args:Record<string,unknown> = {}
) {
  return McpClient.callTool({ name:Name, arguments:Args })
}

/**** isErrorResult — true when the response carries isError ****/

function isErrorResult (Result:Awaited<ReturnType<typeof callTool>>):boolean {
  return Result.isError === true
}

/**** firstText — extracts the first text content item ****/

function firstText (Result:Awaited<ReturnType<typeof callTool>>):string {
  const Item = (Result.content as Array<{ type:string; text?:string }>)[0]
  return (Item?.type === 'text') ? (Item.text ?? '') : ''
}

//----------------------------------------------------------------------------//
//                               Setup                                        //
//----------------------------------------------------------------------------//

beforeEach(() => {
  _setupForTests('/dev/test')
  vi.clearAllMocks()
  Hoisted.clearLastStateUpdate()
})

afterEach(() => {
  _destroyForTests()
})

//----------------------------------------------------------------------------//
//                                 Tests                                      //
//----------------------------------------------------------------------------//

describe('server handshake (SH)', () => {

/**** SH-01: server connects without error ****/

  it('SH-01: server connects and client handshake completes without error', async () => {
    const { disconnect } = await makeConnectedPair()
    await disconnect()
  })

/**** SH-02: tools/list returns all nine expected tool names ****/

  it('SH-02: tools/list returns all nine expected tool names', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const { tools } = await McpClient.listTools()
      const Names = tools.map((T) => T.name).sort()
      expect(Names).toEqual([
        'get_state', 'home', 'lift_to', 'move', 'pitch_to',
        'roll_to', 'rotate_to', 'shift_to', 'wait',
      ])
    } finally { await disconnect() }
  })

})

describe('motion tools (MV)', () => {

/**** MV-01: home ****/

  it('MV-01: home calls Nova.home() and returns a success response', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'home')
      expect(isErrorResult(Result)).toBe(false)
      expect(Hoisted.MockNova.home).toHaveBeenCalledOnce()
    } finally { await disconnect() }
  })

/**** MV-02 – MV-06: individual servo commands ****/

  it('MV-02: shift_to sets s1 and calls sendServoState()', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'shift_to', { deg:100 })
      expect(isErrorResult(Result)).toBe(false)
      expect(Hoisted.LastStateUpdate).toEqual({ s1:100 })
      expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
    } finally { await disconnect() }
  })

  it('MV-03: roll_to sets s2 and calls sendServoState()', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'roll_to', { deg:60 })
      expect(isErrorResult(Result)).toBe(false)
      expect(Hoisted.LastStateUpdate).toEqual({ s2:60 })
      expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
    } finally { await disconnect() }
  })

  it('MV-04: pitch_to sets s3 and calls sendServoState()', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'pitch_to', { deg:80 })
      expect(isErrorResult(Result)).toBe(false)
      expect(Hoisted.LastStateUpdate).toEqual({ s3:80 })
      expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
    } finally { await disconnect() }
  })

  it('MV-05: rotate_to sets s4 and calls sendServoState()', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'rotate_to', { deg:120 })
      expect(isErrorResult(Result)).toBe(false)
      expect(Hoisted.LastStateUpdate).toEqual({ s4:120 })
      expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
    } finally { await disconnect() }
  })

  it('MV-06: lift_to sets s5 and calls sendServoState()', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'lift_to', { deg:30 })
      expect(isErrorResult(Result)).toBe(false)
      expect(Hoisted.LastStateUpdate).toEqual({ s5:30 })
      expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
    } finally { await disconnect() }
  })

/**** MV-07 – MV-08: move ****/

  it('MV-07: move with one servo arg sets that servo atomically', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'move', { shift_to:100 })
      expect(isErrorResult(Result)).toBe(false)
      expect(Hoisted.LastStateUpdate).toEqual({ s1:100 })
      expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
    } finally { await disconnect() }
  })

  it('MV-08: move with two servo args sets both in one packet', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'move', { shift_to:100, rotate_to:120 })
      expect(isErrorResult(Result)).toBe(false)
      expect(Hoisted.LastStateUpdate).toEqual({ s1:100, s4:120 })
      expect(Hoisted.MockNova.sendServoState).toHaveBeenCalledOnce()
    } finally { await disconnect() }
  })

/**** MV-09 – MV-10: wait ****/

  // note: fake timers cannot be used here because the MCP transport relies on
  // its own internal setTimeout calls — freezing all timers would deadlock the
  // request. timing accuracy is covered by the nova-control-command test suite;
  // here we only verify that the tool resolves without error over MCP.

  it('MV-09: wait with a small positive duration resolves without error', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'wait', { ms:5 })
      expect(isErrorResult(Result)).toBe(false)
    } finally { await disconnect() }
  })

  it('MV-10: wait 0 ms resolves without error', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'wait', { ms:0 })
      expect(isErrorResult(Result)).toBe(false)
    } finally { await disconnect() }
  })

/**** MV-11: get_state ****/

  it('MV-11: get_state returns JSON with s1–s5 keys', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'get_state')
      expect(isErrorResult(Result)).toBe(false)
      const Parsed = JSON.parse(firstText(Result))
      expect(Parsed).toMatchObject({
        s1:expect.any(Number), s2:expect.any(Number), s3:expect.any(Number),
        s4:expect.any(Number), s5:expect.any(Number),
      })
    } finally { await disconnect() }
  })

})

describe('error handling (ER)', () => {

/**** ER-01: move with no servo args ****/

  it('ER-01: move with no servo args returns isError=true', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'move', {})
      expect(isErrorResult(Result)).toBe(true)
      expect(firstText(Result)).toContain('shift_to')
    } finally { await disconnect() }
  })

/**** ER-02 – ER-03: wait with bad input ****/

  it('ER-02: wait with a negative duration returns isError=true', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'wait', { ms:-1 })
      expect(isErrorResult(Result)).toBe(true)
      expect(firstText(Result)).toContain('-1')
    } finally { await disconnect() }
  })

  it('ER-03: wait with a non-numeric string returns isError=true', async () => {
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'wait', { ms:'abc' })
      expect(isErrorResult(Result)).toBe(true)
      expect(firstText(Result)).toContain('abc')
    } finally { await disconnect() }
  })

/**** ER-04: openNova rejection ****/

  it('ER-04: a rejected openNova propagates as isError=true', async () => {
    Hoisted.openNova.mockRejectedValueOnce(new Error('port not found'))
    const { McpClient, disconnect } = await makeConnectedPair()
    try {
      const Result = await callTool(McpClient, 'home')
      expect(isErrorResult(Result)).toBe(true)
      expect(firstText(Result)).toContain('port not found')
    } finally { await disconnect() }
  })

})
