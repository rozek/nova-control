/*******************************************************************************
*                                                                              *
*                         ScriptRunner — unit tests                            *
*                                                                              *
*******************************************************************************/

// covers: SR (script runner — stop/continue/ask modes and edge cases)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runScript } from '../ScriptRunner.js'

//----------------------------------------------------------------------------//
//                              Helpers                                       //
//----------------------------------------------------------------------------//

/**** makeExecute — creates a mock execute function with configurable behaviour ****/

function makeExecute (resultsByLine:number[]):
  { execute:(Tokens:string[])=>Promise<number>; calls:string[][] } {
  const calls:string[][] = []
  let   CallIndex = 0

  const execute = async (Tokens:string[]):Promise<number> => {
    calls.push(Tokens)
    return resultsByLine[CallIndex++] ?? 0
  }
  return { execute, calls }
}

// helper to write a temp script file and return its path
import os   from 'node:os'
import path from 'node:path'
import fs   from 'node:fs/promises'

async function writeTempScript (lines:string[]):Promise<string> {
  const FilePath = path.join(os.tmpdir(), `nova-test-${Date.now()}.nova`)
  await fs.writeFile(FilePath, lines.join('\n')+'\n')
  return FilePath
}

//----------------------------------------------------------------------------//
//                                Tests                                       //
//----------------------------------------------------------------------------//

describe('runScript (SR)', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

/**** SR-01: stop mode ****/

  it('SR-01: stop mode stops after the first failing command and returns its exit code', async () => {
    const ScriptPath = await writeTempScript([
      'home',
      'shift-to 100',
      'bad-command',
      'rotate-to 120',
    ])
    const { execute, calls } = makeExecute([ 0, 0, 2, 0 ])
    const Code = await runScript('stop', ScriptPath, execute)
    expect(Code).toBe(2)
    expect(calls).toHaveLength(3) // stopped after the third (failing) command
    await fs.unlink(ScriptPath)
  })

/**** SR-02: continue mode ****/

  it('SR-02: continue mode carries on after errors and returns the last non-zero exit code', async () => {
    const ScriptPath = await writeTempScript([
      'home',
      'bad-command',
      'shift-to 100',
      'another-bad',
    ])
    const { execute, calls } = makeExecute([ 0, 2, 0, 1 ])
    const Code = await runScript('continue', ScriptPath, execute)
    expect(Code).toBe(1)
    expect(calls).toHaveLength(4) // all four lines executed
    await fs.unlink(ScriptPath)
  })

/**** SR-03: non-existent script file ****/

  it('SR-03: a non-existent script file writes an error to stderr and returns exit code 2', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const Code = await runScript('stop', '/no/such/file.nova', async () => 0)
    expect(Code).toBe(2)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('/no/such/file.nova'))
    stderrSpy.mockRestore()
  })

/**** SR-04: blank lines and comments are ignored ****/

  it('SR-04: a script with only blank lines and comments exits with code 0', async () => {
    const ScriptPath = await writeTempScript([
      '',
      '# this is a comment',
      '   ',
      '# another comment',
    ])
    const { execute, calls } = makeExecute([])
    const Code = await runScript('stop', ScriptPath, execute)
    expect(Code).toBe(0)
    expect(calls).toHaveLength(0)
    await fs.unlink(ScriptPath)
  })

/**** SR-05: ask mode in non-TTY context falls back to stop ****/

  it('SR-05: ask mode in non-TTY context (stdin not a TTY) falls back to stop behaviour', async () => {
    const ScriptPath = await writeTempScript([
      'home',
      'bad-command',
      'shift-to 100',
    ])
    // ensure stdin.isTTY is falsy so askContinue() returns false immediately
    const originalIsTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value:false, configurable:true })

    const { execute, calls } = makeExecute([ 0, 2, 0 ])
    const Code = await runScript('ask', ScriptPath, execute)
    expect(Code).toBe(2)
    expect(calls).toHaveLength(2) // stopped after the failing command

    Object.defineProperty(process.stdin, 'isTTY', { value:originalIsTTY, configurable:true })
    await fs.unlink(ScriptPath)
  })

})
