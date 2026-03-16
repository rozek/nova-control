/*******************************************************************************
*                                                                              *
*                              ScriptRunner                                    *
*                                                                              *
*******************************************************************************/

// executes a sequence of nova-control commands read from a file or stdin;
// honours the --on-error mode for line-by-line error handling

import fs       from 'node:fs/promises'
import readline from 'node:readline'
import { tokenizeLine } from './CommandTokenizer.js'

//----------------------------------------------------------------------------//
//                               runScript                                    //
//----------------------------------------------------------------------------//

/**** runScript — reads and executes commands from a file or stdin ****/

export async function runScript (
  OnError:        'stop'|'continue'|'ask',
  ScriptPath:     string,
  executeCommand: (Tokens:string[]) => Promise<number>
):Promise<number> {
  let InputStream:NodeJS.ReadableStream
  if (ScriptPath === '-') {
    InputStream = process.stdin
  } else {
    try {
      const FileHandle = await fs.open(ScriptPath)
      InputStream = FileHandle.createReadStream()
    } catch {
      process.stderr.write(`nova-control: cannot open script '${ScriptPath}'\n`)
      return 2
    }
  }

  const LineReader = readline.createInterface({
    input:    InputStream,
    terminal: false,
  })

  let LastExitCode = 0

  for await (const rawLine of LineReader) {
    const Line = rawLine.trim()
    if ((Line === '') || Line.startsWith('#')) { continue }

    const Tokens = tokenizeLine(Line)
    if (Tokens.length === 0) { continue }

    let ExitCode = 0
    try {
      ExitCode = await executeCommand(Tokens)
    } catch (Signal) {
      ExitCode = 1
      process.stderr.write(`nova-control: ${(Signal as Error).message}\n`)
    }

    if (ExitCode !== 0) {
      LastExitCode = ExitCode

      switch (OnError) {
        case 'stop':     { LineReader.close(); return ExitCode }
        case 'continue': { break }
        case 'ask':      {
          const ShouldContinue = await askContinue()
          if (! ShouldContinue) { LineReader.close(); return ExitCode }
          break
        }
      }
    }
  }

  LineReader.close()
  return LastExitCode
}

//----------------------------------------------------------------------------//
//                               askContinue                                  //
//----------------------------------------------------------------------------//

/**** askContinue — prompts the user whether to continue after an error ****/

async function askContinue ():Promise<boolean> {
  if (! process.stdin.isTTY) { return false } // non-interactive: treat as stop

  return new Promise<boolean>((resolve) => {
    const PromptInterface = readline.createInterface({
      input:  process.stdin,
      output: process.stdout,
    })
    PromptInterface.question('error — continue? [y/N] ', (Answer) => {
      PromptInterface.close()
      resolve(Answer.trim().toLowerCase() === 'y')
    })
  })
}
