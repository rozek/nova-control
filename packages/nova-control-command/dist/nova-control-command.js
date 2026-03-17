#!/usr/bin/env node
import { fileURLToPath as e } from "node:url";
import { realpathSync as t } from "node:fs";
import { Command as n } from "commander";
import { z as r } from "zod";
import { openNova as i } from "nova-control-node";
import a from "node:readline";
import o from "node:fs/promises";
//#region src/CommandTokenizer.ts
function s(e) {
	let t = [], n = "", r = 0;
	for (; r < e.length;) {
		let i = e[r];
		switch (!0) {
			case i === " " || i === "	":
				n.length > 0 && (t.push(n), n = ""), r++;
				break;
			case i === "'":
				for (r++; r < e.length && e[r] !== "'";) n += e[r], r++;
				r++;
				break;
			case i === "\"":
				for (r++; r < e.length && e[r] !== "\"";) if (e[r] === "\\" && r + 1 < e.length) {
					let t = e[r + 1];
					n += t === "\"" || t === "\\" ? t : "\\" + t, r += 2;
				} else n += e[r], r++;
				r++;
				break;
			case i === "#" && n.length === 0:
				r = e.length;
				break;
			default: i === "\\" && r + 1 < e.length ? (n += e[r + 1], r += 2) : (n += i, r++);
		}
	}
	return n.length > 0 && t.push(n), t;
}
//#endregion
//#region src/REPL.ts
async function c(e, t) {
	let n = process.stdin.isTTY, r = n ? `\x1b[1m${e}>\x1b[0m ` : `${e}> `, i = a.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: n,
		prompt: r
	});
	n && (process.stdout.write("NOVA interactive shell — type \"help [command]\" for help, \"exit\" to quit\n"), i.prompt());
	for await (let r of i) {
		let a = r.trim();
		if (a === "" || a.startsWith("#")) {
			n && i.prompt();
			continue;
		}
		if (a === "exit" || a === "quit") break;
		let o = s(a);
		if (o.length === 0) {
			n && i.prompt();
			continue;
		}
		try {
			await t(o);
		} catch (t) {
			process.stderr.write(`${e}: ${t.message}\n`);
		}
		n && i.prompt();
	}
	i.close();
}
//#endregion
//#region src/ScriptRunner.ts
async function l(e, t, n) {
	let r;
	if (t === "-") r = process.stdin;
	else try {
		r = (await o.open(t)).createReadStream();
	} catch {
		return process.stderr.write(`nova-control: cannot open script '${t}'\n`), 2;
	}
	let i = a.createInterface({
		input: r,
		terminal: !1
	}), c = 0;
	for await (let t of i) {
		let r = t.trim();
		if (r === "" || r.startsWith("#")) continue;
		let a = s(r);
		if (a.length === 0) continue;
		let o = 0;
		try {
			o = await n(a);
		} catch (e) {
			o = 1, process.stderr.write(`nova-control: ${e.message}\n`);
		}
		if (o !== 0) switch (c = o, e) {
			case "stop": return i.close(), o;
			case "continue": break;
			case "ask":
				if (!await u()) return i.close(), o;
				break;
		}
	}
	return i.close(), c;
}
async function u() {
	return process.stdin.isTTY ? new Promise((e) => {
		let t = a.createInterface({
			input: process.stdin,
			output: process.stdout
		});
		t.question("error — continue? [y/N] ", (n) => {
			t.close(), e(n.trim().toLowerCase() === "y");
		});
	}) : !1;
}
//#endregion
//#region src/nova-control-command.ts
var d = {
	OK: 0,
	GeneralError: 1,
	UsageError: 2
}, f = class extends Error {
	ExitCode;
	constructor(e, t = d.GeneralError) {
		super(e), this.name = "NovaCommandError", this.ExitCode = t;
	}
}, p = r.coerce.number().finite(), m = r.coerce.number().finite().positive(), h = r.coerce.number().finite().nonnegative();
function g(e, t) {
	try {
		return p.parse(e);
	} catch {
		throw new f(`${t}: '${e}' is not a valid angle — expected a finite number`, d.UsageError);
	}
}
function _(e, t) {
	if (e != null) try {
		return m.parse(e);
	} catch {
		throw new f(`${t}: '--within-ms ${e}' is not valid — expected a positive number`, d.UsageError);
	}
}
var v = "nova-control", y, b = 9600, x = "stop", S;
async function C() {
	if (y == null) throw new f("--port is required — specify the serial port (e.g. /dev/ttyACM0 or COM3)", d.UsageError);
	return S ??= await i(y, b), S;
}
function w() {
	S != null && (S.destroy(), S = void 0);
}
function T(e, t = 9600, n = "stop") {
	y = e, b = t, x = n;
}
function E() {
	w(), y = void 0, b = 9600, x = "stop";
}
function D(e) {
	e.exitOverride(), e.configureOutput({ writeErr: () => {} });
	for (let t of e.commands) D(t);
}
function O(e = !1) {
	let t = new n(v);
	return t.description("NOVA robot arm CLI").allowUnknownOption(!1).configureOutput({ writeErr: () => {} }), e || (t.option("--port <path>", "serial port path (e.g. /dev/ttyACM0 on Linux/macOS, COM3 on Windows)").option("--baud <rate>", "baud rate (default: 9600)", "9600").option("--on-error <mode>", "script error mode: stop | continue | ask (default: stop)"), t.hook("preAction", (e, t) => {
		let n = t.optsWithGlobals();
		y = n.port, b = Number(n.baud ?? "9600"), x = n.onError ?? "stop";
	})), t.command("home").description("send all servos to their home positions").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e) => {
		let t = _(e.withinMs, "home");
		await (await C()).home(t);
	}), t.command("move").description("set one or more servo positions without interrupting the others").option("--shift-to <angle>", "shift head forward (>90°) or back (<90°) — s1").option("--roll-to <angle>", "roll head clockwise (>90°) or counter-clockwise (<90°) — s2").option("--pitch-to <angle>", "pitch head up (>110°) or down (<110°) — s3").option("--rotate-to <angle>", "rotate body around Z-axis — s4").option("--lift-to <angle>", "lift head on secondary axis, range 20°–150° — s5").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e) => {
		let t = {};
		if (e.shiftTo != null && (t.s1 = g(e.shiftTo, "move")), e.rollTo != null && (t.s2 = g(e.rollTo, "move")), e.pitchTo != null && (t.s3 = g(e.pitchTo, "move")), e.rotateTo != null && (t.s4 = g(e.rotateTo, "move")), e.liftTo != null && (t.s5 = g(e.liftTo, "move")), Object.keys(t).length === 0) throw new f("move: specify at least one servo option (--shift-to, --roll-to, --pitch-to, --rotate-to, --lift-to)", d.UsageError);
		let n = _(e.withinMs, "move");
		await (await C()).moveTo(t, n);
	}), t.command("shift-to").description("shift head forward (>90°) or back (<90°) — s1").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = g(e, "shift-to"), r = _(t.withinMs, "shift-to");
		await (await C()).shiftHeadTo(n, r);
	}), t.command("roll-to").description("roll head clockwise (>90°) or counter-clockwise (<90°) — s2").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = g(e, "roll-to"), r = _(t.withinMs, "roll-to");
		await (await C()).rollHeadTo(n, r);
	}), t.command("pitch-to").description("pitch head up (>110°) or down (<110°) — s3").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = g(e, "pitch-to"), r = _(t.withinMs, "pitch-to");
		await (await C()).pitchHeadTo(n, r);
	}), t.command("rotate-to").description("rotate body around Z-axis — s4").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = g(e, "rotate-to"), r = _(t.withinMs, "rotate-to");
		await (await C()).rotateBodyTo(n, r);
	}), t.command("lift-to").description("lift head on secondary axis, range 20°–150° — s5").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = g(e, "lift-to"), r = _(t.withinMs, "lift-to");
		await (await C()).liftHeadTo(n, r);
	}), t.command("wait").description("pause for <ms> milliseconds before the next command").argument("<ms>", "duration in milliseconds (non-negative number)").action(async (e) => {
		let t;
		try {
			t = h.parse(e);
		} catch {
			throw new f(`wait: invalid duration '${e}' — expected a non-negative number`, d.UsageError);
		}
		await new Promise((e) => setTimeout(e, t));
	}), t.command("state").description("print the current servo state as JSON").action(async () => {
		let e = await C();
		process.stdout.write(JSON.stringify(e.State) + "\n");
	}), e || (t.command("shell").description("start an interactive REPL").action(async () => {
		await c(v, (e) => k(e));
	}), t.option("--script <file>", "run commands from a script file (use - for stdin)").action(async (e) => {
		if (e.script != null) {
			let t = await l(x, e.script, k);
			process.exit(t);
		} else process.stdout.write(t.helpInformation()), process.exit(d.OK);
	}), t.addHelpCommand(!0)), t;
}
async function k(e) {
	if (e.length === 0) return d.OK;
	let t = O(!0);
	D(t);
	try {
		return await t.parseAsync([
			"node",
			v,
			...e
		]), d.OK;
	} catch (t) {
		let n = t;
		return n.code === "commander.help" || n.code === "commander.helpDisplayed" ? d.OK : n.code === "commander.unknownCommand" ? (process.stderr.write(`${v}: unknown command '${e[0]}' — try '${v} help'\n`), d.UsageError) : n.code === "commander.unknownOption" || n.code === "commander.missingArgument" || n.code === "commander.missingMandatoryOptionValue" ? (process.stderr.write(`${v}: ${n.message}\n`), d.UsageError) : t instanceof f ? (process.stderr.write(`${v}: ${t.message}\n`), t.ExitCode) : (process.stderr.write(`${v}: ${t.message ?? String(t)}\n`), d.GeneralError);
	}
}
async function A() {
	let e = O();
	D(e);
	try {
		await e.parseAsync(process.argv);
	} catch (t) {
		let n = t;
		(n.code === "commander.help" || n.code === "commander.helpDisplayed" || n.code === "commander.version") && process.exit(d.OK), (n.code === "commander.unknownCommand" || n.code === "commander.unknownOption" || n.code === "commander.missingArgument" || n.code === "commander.missingMandatoryOptionValue") && (process.stderr.write(`${v}: ${n.message}\n\n`), process.stderr.write(e.helpInformation()), process.exit(d.UsageError)), t instanceof f && (process.stderr.write(`${v}: ${t.message}\n`), process.exit(t.ExitCode)), process.stderr.write(`${v}: ${t.message ?? String(t)}\n`), process.exit(d.GeneralError);
	} finally {
		w();
	}
}
t(process.argv[1]) === e(import.meta.url) && A().catch((e) => {
	process.stderr.write(`${v}: fatal: ${e.message ?? e}\n`), process.exit(d.GeneralError);
});
//#endregion
export { E as _destroyForTests, T as _setupForTests, k as executeTokens };
