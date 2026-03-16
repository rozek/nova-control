/*******************************************************************************
*                                                                              *
*                            CommandTokenizer                                  *
*                                                                              *
*******************************************************************************/

// simple shell-like tokeniser for REPL and script-file input lines;
// handles single-quoted, double-quoted, backslash-escaped, and unquoted tokens

//----------------------------------------------------------------------------//
//                               tokenizeLine                                 //
//----------------------------------------------------------------------------//

/**** tokenizeLine — splits a line into tokens, respecting quoted strings ****/

export function tokenizeLine (Line:string):string[] {
  const Tokens:string[] = []
  let   TokenBuffer = ''
  let   CharAt      = 0

  while (CharAt < Line.length) {
    const Character = Line[CharAt]

    switch (true) {
      // skip leading and inter-token whitespace
      case ((Character === ' ') || (Character === '\t')): {
        if (TokenBuffer.length > 0) { Tokens.push(TokenBuffer); TokenBuffer = '' }
        CharAt++
        break
      }

      // single-quoted string — no escapes inside
      case (Character === '\''): {
        CharAt++
        while ((CharAt < Line.length) && (Line[CharAt] !== '\'')) {
          TokenBuffer += Line[CharAt]
          CharAt++
        }
        CharAt++ // consume closing quote
        break
      }

      // double-quoted string — supports \" and \\ inside
      case (Character === '"'): {
        CharAt++
        while ((CharAt < Line.length) && (Line[CharAt] !== '"')) {
          if ((Line[CharAt] === '\\') && (CharAt+1 < Line.length)) {
            const Escaped = Line[CharAt+1]
            TokenBuffer += ((Escaped === '"') || (Escaped === '\\')) ? Escaped : '\\'+Escaped
            CharAt += 2
          } else {
            TokenBuffer += Line[CharAt]
            CharAt++
          }
        }
        CharAt++ // consume closing quote
        break
      }

      // inline comment — everything from # to end of line is dropped
      case ((Character === '#') && (TokenBuffer.length === 0)): {
        CharAt = Line.length // skip rest of line
        break
      }

      default: {
        // backslash escape outside quotes — next character is taken literally
        if ((Character === '\\') && (CharAt+1 < Line.length)) {
          TokenBuffer += Line[CharAt+1]
          CharAt += 2
        } else {
          TokenBuffer += Character
          CharAt++
        }
      }
    }
  }

  if (TokenBuffer.length > 0) { Tokens.push(TokenBuffer) }
  return Tokens
}
