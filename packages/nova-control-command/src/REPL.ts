/*******************************************************************************
*                                                                              *
*                                   REPL                                       *
*                                                                              *
*******************************************************************************/

// interactive REPL — reads command lines from stdin, executes them via the
// same commander program used for one-shot CLI invocations

import readline from 'node:readline'
import { tokenizeLine } from './CommandTokenizer.js'

//----------------------------------------------------------------------------//
//                                startREPL                                   //
//----------------------------------------------------------------------------//

/**** startREPL — runs a read-eval-print loop until the user exits ****/

export async function startREPL (
  CommandName:    string,
  executeCommand: (Tokens:string[]) => Promise<number>
):Promise<void> {
  const isTTY = process.stdin.isTTY

  // bold prompt makes user input stand out visually; ANSI codes are stripped
  // automatically by readline when computing the visible cursor position
  const Prompt = isTTY ? `\x1b[1m${CommandName}>\x1b[0m ` : `${CommandName}> `

  const REPLInterface = readline.createInterface({
    input:    process.stdin,
    output:   process.stdout,
    terminal: isTTY,
    prompt:   Prompt,
  })

  if (isTTY) {
    process.stdout.write(
      `NOVA interactive shell — type "help [command]" for help, "exit" to quit\n`
    )
    REPLInterface.prompt()
  }

  for await (const rawLine of REPLInterface) {
    const Line = rawLine.trim()

    if ((Line === '') || Line.startsWith('#')) {
      if (isTTY) { REPLInterface.prompt() }
      continue
    }

    if ((Line === 'exit') || (Line === 'quit')) { break }

    const Tokens = tokenizeLine(Line)
    if (Tokens.length === 0) {
      if (isTTY) { REPLInterface.prompt() }
      continue
    }

    try {
      await executeCommand(Tokens)
    } catch (Signal) {
      process.stderr.write(`${CommandName}: ${(Signal as Error).message}\n`)
    }

    if (isTTY) { REPLInterface.prompt() }
  }

  REPLInterface.close()
}
