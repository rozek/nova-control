# Test Cases — `nova-control-command`

## CT — Command Tokeniser (`tokenizeLine`)

| # | Description | Expected |
|---|---|---|
| CT-01 | empty string | `[]` |
| CT-02 | whitespace-only string | `[]` |
| CT-03 | `'shift-to 100'` | `['shift-to', '100']` |
| CT-04 | multiple spaces between tokens | same result as single space |
| CT-05 | `'"hello world"'` (double-quoted) | `['hello world']` |
| CT-06 | `"'foo bar'"` (single-quoted) | `['foo bar']` |
| CT-07 | unclosed quote | remaining input merged into last token |
| CT-08 | backslash-escaped space (`shift-to\ 100`) | `['shift-to 100']` as one token |
| CT-09 | `'\\"'` (escaped double-quote) | `['"']` |
| CT-10 | backslash-escaped double-quote inside double-quoted string | literal quote in token |
| CT-11 | inline comment (`shift-to 100 # comment`) | tokens before `#` returned; rest stripped |
| CT-12 | line starting with `#` | `[]` |
| CT-13 | tab character between tokens | treated as whitespace |

## SR — Script Runner (`runScript`)

| # | Description | Expected |
|---|---|---|
| SR-01 | `stop` mode with a failing command | stops after first failure; returns its exit code |
| SR-02 | `continue` mode with a failing command | continues; returns last non-zero exit code |
| SR-03 | non-existent script file | error message to stderr; returns exit code 2 |
| SR-04 | script with only blank lines and comments | exits with code 0; no error output |
| SR-05 | `ask` mode in non-TTY context | falls back to `stop`; stops after first failure |

## CMD — Servo Commands (`executeTokens`)

| # | Description | Expected |
|---|---|---|
| CMD-01 | `home` | `Nova.home()` called; exit code 0 |
| CMD-02 | `shift-to 100` | `Nova.State = { s1:100 }`; `sendServoState()` called; exit code 0 |
| CMD-03 | `roll-to 60` | `Nova.State = { s2:60 }`; `sendServoState()` called; exit code 0 |
| CMD-04 | `pitch-to 80` | `Nova.State = { s3:80 }`; `sendServoState()` called; exit code 0 |
| CMD-05 | `rotate-to 120` | `Nova.State = { s4:120 }`; `sendServoState()` called; exit code 0 |
| CMD-06 | `lift-to 90` | `Nova.State = { s5:90 }`; `sendServoState()` called; exit code 0 |
| CMD-07 | `move --shift-to 100` | `Nova.State = { s1:100 }`; `sendServoState()` called; exit code 0 |
| CMD-08 | `move --shift-to 100 --rotate-to 120` | `Nova.State = { s1:100, s4:120 }`; `sendServoState()` called; exit code 0 |
| CMD-09 | `move` without any servo option | exit code 2; error message mentions `--shift-to` |
| CMD-10 | `wait 100` | resolves after ~100 ms; exit code 0 |
| CMD-11 | `wait 0` | resolves immediately; exit code 0 |
| CMD-12 | `wait -1` | exit code 2; error message contains `'-1'` |
| CMD-13 | `wait abc` | exit code 2; error message contains `'abc'` |
| CMD-14 | `state` | JSON with keys `s1`–`s5` written to stdout; exit code 0 |

## ERR — Error Handling

| # | Description | Expected |
|---|---|---|
| ERR-01 | unknown command (e.g. `fly`) | exit code 2; error written to stderr |
| ERR-02 | `shift-to` without argument | exit code 2; error written to stderr |
| ERR-03 | `openNova` rejects (port not found) | exit code 1; error message written to stderr |
