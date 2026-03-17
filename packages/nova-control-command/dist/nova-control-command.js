#!/usr/bin/env node
import { fileURLToPath as e } from "node:url";
import { realpathSync as t } from "node:fs";
import { Command as n } from "commander";
import { openNova as r } from "nova-control-node";
import i from "node:readline";
import a from "node:fs/promises";
//#region src/CommandTokenizer.ts
function o(e) {
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
async function s(e, t) {
	let n = process.stdin.isTTY, r = n ? `\x1b[1m${e}>\x1b[0m ` : `${e}> `, a = i.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: n,
		prompt: r
	});
	n && (process.stdout.write("NOVA interactive shell — type \"help [command]\" for help, \"exit\" to quit\n"), a.prompt());
	for await (let r of a) {
		let i = r.trim();
		if (i === "" || i.startsWith("#")) {
			n && a.prompt();
			continue;
		}
		if (i === "exit" || i === "quit") break;
		let s = o(i);
		if (s.length === 0) {
			n && a.prompt();
			continue;
		}
		try {
			await t(s);
		} catch (t) {
			process.stderr.write(`${e}: ${t.message}\n`);
		}
		n && a.prompt();
	}
	a.close();
}
//#endregion
//#region src/ScriptRunner.ts
async function c(e, t, n) {
	let r;
	if (t === "-") r = process.stdin;
	else try {
		r = (await a.open(t)).createReadStream();
	} catch {
		return process.stderr.write(`nova-control: cannot open script '${t}'\n`), 2;
	}
	let s = i.createInterface({
		input: r,
		terminal: !1
	}), c = 0;
	for await (let t of s) {
		let r = t.trim();
		if (r === "" || r.startsWith("#")) continue;
		let i = o(r);
		if (i.length === 0) continue;
		let a = 0;
		try {
			a = await n(i);
		} catch (e) {
			a = 1, process.stderr.write(`nova-control: ${e.message}\n`);
		}
		if (a !== 0) switch (c = a, e) {
			case "stop": return s.close(), a;
			case "continue": break;
			case "ask":
				if (!await l()) return s.close(), a;
				break;
		}
	}
	return s.close(), c;
}
async function l() {
	return process.stdin.isTTY ? new Promise((e) => {
		let t = i.createInterface({
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
var u = {
	OK: 0,
	GeneralError: 1,
	UsageError: 2
}, d = class extends Error {
	ExitCode;
	constructor(e, t = u.GeneralError) {
		super(e), this.name = "NovaCommandError", this.ExitCode = t;
	}
}, f = "nova-control", p, m = 9600, h = "stop", g;
async function _() {
	if (p == null) throw new d("--port is required — specify the serial port (e.g. /dev/ttyACM0 or COM3)", u.UsageError);
	return g ??= await r(p, m), g;
}
function v() {
	g != null && (g.destroy(), g = void 0);
}
function y(e, t = 9600, n = "stop") {
	p = e, m = t, h = n;
}
function b() {
	v(), p = void 0, m = 9600, h = "stop";
}
function x(e) {
	e.exitOverride(), e.configureOutput({ writeErr: () => {} });
	for (let t of e.commands) x(t);
}
function S(e = !1) {
	let t = new n(f);
	return t.description("NOVA robot arm CLI").allowUnknownOption(!1).configureOutput({ writeErr: () => {} }), e || (t.option("--port <path>", "serial port path (e.g. /dev/ttyACM0 on Linux/macOS, COM3 on Windows)").option("--baud <rate>", "baud rate (default: 9600)", "9600").option("--on-error <mode>", "script error mode: stop | continue | ask (default: stop)"), t.hook("preAction", (e, t) => {
		let n = t.optsWithGlobals();
		p = n.port, m = Number(n.baud ?? "9600"), h = n.onError ?? "stop";
	})), t.command("home").description("send all servos to their home positions").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e) => {
		let t = e.withinMs == null ? void 0 : Number(e.withinMs);
		await (await _()).home(t);
	}), t.command("move").description("set one or more servo positions without interrupting the others").option("--shift-to <angle>", "shift head forward (>90°) or back (<90°) — s1").option("--roll-to <angle>", "roll head clockwise (>90°) or counter-clockwise (<90°) — s2").option("--pitch-to <angle>", "pitch head up (>110°) or down (<110°) — s3").option("--rotate-to <angle>", "rotate body around Z-axis — s4").option("--lift-to <angle>", "lift head on secondary axis, range 20°–150° — s5").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e) => {
		let t = {};
		if (e.shiftTo != null && (t.s1 = Number(e.shiftTo)), e.rollTo != null && (t.s2 = Number(e.rollTo)), e.pitchTo != null && (t.s3 = Number(e.pitchTo)), e.rotateTo != null && (t.s4 = Number(e.rotateTo)), e.liftTo != null && (t.s5 = Number(e.liftTo)), Object.keys(t).length === 0) throw new d("move: specify at least one servo option (--shift-to, --roll-to, --pitch-to, --rotate-to, --lift-to)", u.UsageError);
		let n = e.withinMs == null ? void 0 : Number(e.withinMs);
		await (await _()).moveTo(t, n);
	}), t.command("shift-to").description("shift head forward (>90°) or back (<90°) — s1").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = t.withinMs == null ? void 0 : Number(t.withinMs);
		await (await _()).shiftHeadTo(Number(e), n);
	}), t.command("roll-to").description("roll head clockwise (>90°) or counter-clockwise (<90°) — s2").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = t.withinMs == null ? void 0 : Number(t.withinMs);
		await (await _()).rollHeadTo(Number(e), n);
	}), t.command("pitch-to").description("pitch head up (>110°) or down (<110°) — s3").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = t.withinMs == null ? void 0 : Number(t.withinMs);
		await (await _()).pitchHeadTo(Number(e), n);
	}), t.command("rotate-to").description("rotate body around Z-axis — s4").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = t.withinMs == null ? void 0 : Number(t.withinMs);
		await (await _()).rotateBodyTo(Number(e), n);
	}), t.command("lift-to").description("lift head on secondary axis, range 20°–150° — s5").argument("<angle>", "target angle in degrees").option("--within-ms <ms>", "move smoothly over this many milliseconds (trapezoidal ramp)").action(async (e, t) => {
		let n = t.withinMs == null ? void 0 : Number(t.withinMs);
		await (await _()).liftHeadTo(Number(e), n);
	}), t.command("wait").description("pause for <ms> milliseconds before the next command").argument("<ms>", "duration in milliseconds (non-negative number)").action(async (e) => {
		let t = Number(e);
		if (isNaN(t) || t < 0) throw new d(`wait: invalid duration '${e}' — expected a non-negative number`, u.UsageError);
		await new Promise((e) => setTimeout(e, t));
	}), t.command("state").description("print the current servo state as JSON").action(async () => {
		let e = await _();
		process.stdout.write(JSON.stringify(e.State) + "\n");
	}), e || (t.command("shell").description("start an interactive REPL").action(async () => {
		await s(f, (e) => C(e));
	}), t.option("--script <file>", "run commands from a script file (use - for stdin)").action(async (e) => {
		if (e.script != null) {
			let t = await c(h, e.script, C);
			process.exit(t);
		} else process.stdout.write(t.helpInformation()), process.exit(u.OK);
	}), t.addHelpCommand(!0)), t;
}
async function C(e) {
	if (e.length === 0) return u.OK;
	let t = S(!0);
	x(t);
	try {
		return await t.parseAsync([
			"node",
			f,
			...e
		]), u.OK;
	} catch (t) {
		let n = t;
		return n.code === "commander.help" || n.code === "commander.helpDisplayed" ? u.OK : n.code === "commander.unknownCommand" ? (process.stderr.write(`${f}: unknown command '${e[0]}' — try '${f} help'\n`), u.UsageError) : n.code === "commander.unknownOption" || n.code === "commander.missingArgument" || n.code === "commander.missingMandatoryOptionValue" ? (process.stderr.write(`${f}: ${n.message}\n`), u.UsageError) : t instanceof d ? (process.stderr.write(`${f}: ${t.message}\n`), t.ExitCode) : (process.stderr.write(`${f}: ${t.message ?? String(t)}\n`), u.GeneralError);
	}
}
async function w() {
	let e = S();
	x(e);
	try {
		await e.parseAsync(process.argv);
	} catch (t) {
		let n = t;
		(n.code === "commander.help" || n.code === "commander.helpDisplayed" || n.code === "commander.version") && process.exit(u.OK), (n.code === "commander.unknownCommand" || n.code === "commander.unknownOption" || n.code === "commander.missingArgument" || n.code === "commander.missingMandatoryOptionValue") && (process.stderr.write(`${f}: ${n.message}\n\n`), process.stderr.write(e.helpInformation()), process.exit(u.UsageError)), t instanceof d && (process.stderr.write(`${f}: ${t.message}\n`), process.exit(t.ExitCode)), process.stderr.write(`${f}: ${t.message ?? String(t)}\n`), process.exit(u.GeneralError);
	} finally {
		v();
	}
}
t(process.argv[1]) === e(import.meta.url) && w().catch((e) => {
	process.stderr.write(`${f}: fatal: ${e.message ?? e}\n`), process.exit(u.GeneralError);
});
//#endregion
export { b as _destroyForTests, y as _setupForTests, C as executeTokens };
