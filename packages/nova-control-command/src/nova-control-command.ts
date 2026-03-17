/*******************************************************************************
*                                                                              *
*                           nova-control-command                               *
*                                                                              *
*******************************************************************************/

// CLI for controlling a NOVA robot arm — supports one-shot commands,
// an interactive REPL, and script-file execution

import { fileURLToPath } from 'node:url'
import { realpathSync }  from 'node:fs'
import { Command }  from 'commander'
import { openNova } from 'nova-control-node'
import type { NovaController, ServoUpdate } from 'nova-control-node'

import { tokenizeLine } from './CommandTokenizer.js'
import { startREPL }    from './REPL.js'
import { runScript }    from './ScriptRunner.js'

//----------------------------------------------------------------------------//
//                                 ExitCodes                                  //
//----------------------------------------------------------------------------//

  const ExitCodes = {
    OK:           0,   // success
    GeneralError: 1,   // unspecified runtime error
    UsageError:   2,   // bad arguments or missing required option
  } as const

//----------------------------------------------------------------------------//
//                             NovaCommandError                               //
//----------------------------------------------------------------------------//

/**** NovaCommandError — carries a machine-readable exit code alongside the message ****/

  class NovaCommandError extends Error {
    readonly ExitCode:number

    constructor (Message:string, Code:number = ExitCodes.GeneralError) {
      super(Message)
      this.name     = 'NovaCommandError'
      this.ExitCode = Code
    }
  }

//----------------------------------------------------------------------------//
//                           module-level state                               //
//----------------------------------------------------------------------------//

  // set once by main() before any sub-command action runs
  let _CommandName = 'nova-control'
  let _Port:        string | undefined
  let _BaudRate     = 9600
  let _OnError:     'stop'|'continue'|'ask' = 'stop'
  let _ActiveNova:  NovaController | undefined

/**** getController — opens (or reuses) the active serial connection ****/

  async function getController ():Promise<NovaController> {
    if (_Port == null) {
      throw new NovaCommandError(
        '--port is required — specify the serial port (e.g. /dev/ttyACM0 or COM3)',
        ExitCodes.UsageError
      )
    }
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

/**** _setupForTests — injects port and options without a full CLI parse ****/

  export function _setupForTests (
    Port:string, BaudRate:number = 9600, OnError:'stop'|'continue'|'ask' = 'stop'
  ):void {
    _Port     = Port
    _BaudRate = BaudRate
    _OnError  = OnError
  }

/**** _destroyForTests — tears down the active connection and resets state ****/

  export function _destroyForTests ():void {
    destroyController()
    _Port     = undefined
    _BaudRate = 9600
    _OnError  = 'stop'
  }

//----------------------------------------------------------------------------//
//                            applyExitOverride                               //
//----------------------------------------------------------------------------//

/**** applyExitOverride — recursively arms exitOverride and silences writeErr ****/

  function applyExitOverride (Cmd:Command):void {
    Cmd.exitOverride()
    Cmd.configureOutput({ writeErr: () => {} })
    for (const SubCmd of Cmd.commands) {
      applyExitOverride(SubCmd)
    }
  }

//----------------------------------------------------------------------------//
//                               buildProgram                                 //
//----------------------------------------------------------------------------//

/**** buildProgram — constructs a fully configured commander Command ****/

// isSubContext = true  → REPL / script runner: omit global options, shell
//                        command, and root action so process.exit() is never
//                        called from within those contexts
// isSubContext = false → full top-level CLI (default)

  function buildProgram (isSubContext:boolean = false):Command {
    const Program = new Command(_CommandName)
      Program
        .description('NOVA robot arm CLI')
        .allowUnknownOption(false)
        .configureOutput({ writeErr: () => {} })

    if (! isSubContext) {
      Program
        .option('--port <path>',
          'serial port path (e.g. /dev/ttyACM0 on Linux/macOS, COM3 on Windows)')
        .option('--baud <rate>',
          'baud rate (default: 9600)', '9600')
        .option('--on-error <mode>',
          'script error mode: stop | continue | ask (default: stop)')

      // capture global options into module state before any action runs
      Program.hook('preAction', (_, ActionCmd) => {
        const Opts = ActionCmd.optsWithGlobals()
        _Port     = Opts.port
        _BaudRate = Number(Opts.baud ?? '9600')
        _OnError  = (Opts.onError ?? 'stop') as 'stop'|'continue'|'ask'
      })
    }

  /**** home ****/

    Program.command('home')
      .description('send all servos to their home positions')
      .option('--within-ms <ms>', 'move smoothly over this many milliseconds (trapezoidal ramp)')
      .action(async (Options) => {
        const WithinMS = (Options.withinMs != null) ? Number(Options.withinMs) : undefined
        const Nova     = await getController()
        await Nova.home(WithinMS)
      })

  /**** move ****/

    Program.command('move')
      .description('set one or more servo positions without interrupting the others')
      .option('--shift-to <angle>',  'shift head forward (>90°) or back (<90°) — s1')
      .option('--roll-to <angle>',   'roll head clockwise (>90°) or counter-clockwise (<90°) — s2')
      .option('--pitch-to <angle>',  'pitch head up (>110°) or down (<110°) — s3')
      .option('--rotate-to <angle>', 'rotate body around Z-axis — s4')
      .option('--lift-to <angle>',   'lift head on secondary axis, range 20°–150° — s5')
      .option('--within-ms <ms>',    'move smoothly over this many milliseconds (trapezoidal ramp)')
      .action(async (Options) => {
        const Update:ServoUpdate = {}
        if (Options.shiftTo  != null) { Update.s1 = Number(Options.shiftTo) }
        if (Options.rollTo   != null) { Update.s2 = Number(Options.rollTo) }
        if (Options.pitchTo  != null) { Update.s3 = Number(Options.pitchTo) }
        if (Options.rotateTo != null) { Update.s4 = Number(Options.rotateTo) }
        if (Options.liftTo   != null) { Update.s5 = Number(Options.liftTo) }
        if (Object.keys(Update).length === 0) {
          throw new NovaCommandError(
            'move: specify at least one servo option ' +
            '(--shift-to, --roll-to, --pitch-to, --rotate-to, --lift-to)',
            ExitCodes.UsageError
          )
        }
        const WithinMS = (Options.withinMs != null) ? Number(Options.withinMs) : undefined
        const Nova     = await getController()
        await Nova.moveTo(Update, WithinMS)
      })

  /**** shift-to / roll-to / pitch-to / rotate-to / lift-to ****/

    Program.command('shift-to')
      .description('shift head forward (>90°) or back (<90°) — s1')
      .argument('<angle>', 'target angle in degrees')
      .option('--within-ms <ms>', 'move smoothly over this many milliseconds (trapezoidal ramp)')
      .action(async (AngleArg:string, Options) => {
        const WithinMS = (Options.withinMs != null) ? Number(Options.withinMs) : undefined
        const Nova     = await getController()
        await Nova.shiftHeadTo(Number(AngleArg), WithinMS)
      })

    Program.command('roll-to')
      .description('roll head clockwise (>90°) or counter-clockwise (<90°) — s2')
      .argument('<angle>', 'target angle in degrees')
      .option('--within-ms <ms>', 'move smoothly over this many milliseconds (trapezoidal ramp)')
      .action(async (AngleArg:string, Options) => {
        const WithinMS = (Options.withinMs != null) ? Number(Options.withinMs) : undefined
        const Nova     = await getController()
        await Nova.rollHeadTo(Number(AngleArg), WithinMS)
      })

    Program.command('pitch-to')
      .description('pitch head up (>110°) or down (<110°) — s3')
      .argument('<angle>', 'target angle in degrees')
      .option('--within-ms <ms>', 'move smoothly over this many milliseconds (trapezoidal ramp)')
      .action(async (AngleArg:string, Options) => {
        const WithinMS = (Options.withinMs != null) ? Number(Options.withinMs) : undefined
        const Nova     = await getController()
        await Nova.pitchHeadTo(Number(AngleArg), WithinMS)
      })

    Program.command('rotate-to')
      .description('rotate body around Z-axis — s4')
      .argument('<angle>', 'target angle in degrees')
      .option('--within-ms <ms>', 'move smoothly over this many milliseconds (trapezoidal ramp)')
      .action(async (AngleArg:string, Options) => {
        const WithinMS = (Options.withinMs != null) ? Number(Options.withinMs) : undefined
        const Nova     = await getController()
        await Nova.rotateBodyTo(Number(AngleArg), WithinMS)
      })

    Program.command('lift-to')
      .description('lift head on secondary axis, range 20°–150° — s5')
      .argument('<angle>', 'target angle in degrees')
      .option('--within-ms <ms>', 'move smoothly over this many milliseconds (trapezoidal ramp)')
      .action(async (AngleArg:string, Options) => {
        const WithinMS = (Options.withinMs != null) ? Number(Options.withinMs) : undefined
        const Nova     = await getController()
        await Nova.liftHeadTo(Number(AngleArg), WithinMS)
      })

  /**** wait ****/

    Program.command('wait')
      .description('pause for <ms> milliseconds before the next command')
      .argument('<ms>', 'duration in milliseconds (non-negative number)')
      .action(async (MsArg:string) => {
        const Duration = Number(MsArg)
        if (isNaN(Duration) || (Duration < 0)) {
          throw new NovaCommandError(
            `wait: invalid duration '${MsArg}' — expected a non-negative number`,
            ExitCodes.UsageError
          )
        }
        await new Promise<void>((resolve) => setTimeout(resolve, Duration))
      })

  /**** state ****/

    Program.command('state')
      .description('print the current servo state as JSON')
      .action(async () => {
        const Nova = await getController()
        process.stdout.write(JSON.stringify(Nova.State)+'\n')
      })

    // shell and the root action are only available at the top-level CLI
    if (! isSubContext) {

  /**** shell — interactive REPL ****/

      Program.command('shell')
        .description('start an interactive REPL')
        .action(async () => {
          await startREPL(_CommandName, (Tokens) => executeTokens(Tokens))
        })

      Program
        .option('--script <file>',
          'run commands from a script file (use - for stdin)')
        .action(async (Options) => {
          if (Options.script != null) {
            const Code = await runScript(_OnError, Options.script, executeTokens)
            process.exit(Code)
          } else {
            process.stdout.write(Program.helpInformation())
            process.exit(ExitCodes.OK)
          }
        })

      // force the built-in `help [command]` sub-command back — commander drops
      // it when a root action is registered
      Program.addHelpCommand(true)
    }

    return Program
  }

//----------------------------------------------------------------------------//
//                             executeTokens                                  //
//----------------------------------------------------------------------------//

/**** executeTokens — parses and executes a token array as a nova-control command ****/

  export async function executeTokens (Tokens:string[]):Promise<number> {
    if (Tokens.length === 0) { return ExitCodes.OK }

    // build a sub-context program: no global options, no shell, no root action,
    // so process.exit() can never fire from within the REPL or script runner
    const Program = buildProgram(true)
    applyExitOverride(Program)

    try {
      await Program.parseAsync(['node', _CommandName, ...Tokens])
      return ExitCodes.OK
    } catch (Signal:unknown) {
      const CommanderError = Signal as { code?:string; message:string }

      // commander's own exit events — not real errors
      if (
        (CommanderError.code === 'commander.help') ||
        (CommanderError.code === 'commander.helpDisplayed')
      ) { return ExitCodes.OK }

      if (CommanderError.code === 'commander.unknownCommand') {
        process.stderr.write(
          `${_CommandName}: unknown command '${Tokens[0]}' — ` +
          `try '${_CommandName} help'\n`
        )
        return ExitCodes.UsageError
      }

      if (
        (CommanderError.code === 'commander.unknownOption') ||
        (CommanderError.code === 'commander.missingArgument') ||
        (CommanderError.code === 'commander.missingMandatoryOptionValue')
      ) {
        process.stderr.write(`${_CommandName}: ${CommanderError.message}\n`)
        return ExitCodes.UsageError
      }

      if (Signal instanceof NovaCommandError) {
        process.stderr.write(`${_CommandName}: ${Signal.message}\n`)
        return Signal.ExitCode
      }

      process.stderr.write(
        `${_CommandName}: ${(Signal as Error).message ?? String(Signal)}\n`
      )
      return ExitCodes.GeneralError
    }
  }

//----------------------------------------------------------------------------//
//                                   main                                     //
//----------------------------------------------------------------------------//

/**** main — CLI entry point ****/

  async function main ():Promise<void> {
    const Program = buildProgram()
    applyExitOverride(Program)

    try {
      await Program.parseAsync(process.argv)
    } catch (Signal:unknown) {
      const CommanderError = Signal as { code?:string; message:string }

      if (
        (CommanderError.code === 'commander.help') ||
        (CommanderError.code === 'commander.helpDisplayed') ||
        (CommanderError.code === 'commander.version')
      ) { process.exit(ExitCodes.OK) }

      if (
        (CommanderError.code === 'commander.unknownCommand') ||
        (CommanderError.code === 'commander.unknownOption') ||
        (CommanderError.code === 'commander.missingArgument') ||
        (CommanderError.code === 'commander.missingMandatoryOptionValue')
      ) {
        // error first, then help — so the mistake is visible at the top
        process.stderr.write(`${_CommandName}: ${CommanderError.message}\n\n`)
        process.stderr.write(Program.helpInformation())
        process.exit(ExitCodes.UsageError)
      }

      if (Signal instanceof NovaCommandError) {
        process.stderr.write(`${_CommandName}: ${Signal.message}\n`)
        process.exit(Signal.ExitCode)
      }

      process.stderr.write(
        `${_CommandName}: ${(Signal as Error).message ?? String(Signal)}\n`
      )
      process.exit(ExitCodes.GeneralError)
    } finally {
      destroyController()
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
        `${_CommandName}: fatal: ${(Signal as Error).message ?? Signal}\n`
      )
      process.exit(ExitCodes.GeneralError)
    })
  }
