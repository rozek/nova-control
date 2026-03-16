#!/usr/bin/env node
import { fileURLToPath as e } from "node:url";
import { Command as t } from "commander";
import { openNova as n } from "nova-control-node";
import r from "node:readline";
import i from "node:fs/promises";
//#region src/CommandTokenizer.ts
function a(e) {
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
async function o(e, t) {
	let n = process.stdin.isTTY, i = n ? `\x1b[1m${e}>\x1b[0m ` : `${e}> `, o = r.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: n,
		prompt: i
	});
	n && (process.stdout.write("NOVA interactive shell — type \"help [command]\" for help, \"exit\" to quit\n"), o.prompt());
	for await (let r of o) {
		let i = r.trim();
		if (i === "" || i.startsWith("#")) {
			n && o.prompt();
			continue;
		}
		if (i === "exit" || i === "quit") break;
		let s = a(i);
		if (s.length === 0) {
			n && o.prompt();
			continue;
		}
		try {
			await t(s);
		} catch (t) {
			process.stderr.write(`${e}: ${t.message}\n`);
		}
		n && o.prompt();
	}
	o.close();
}
//#endregion
//#region src/ScriptRunner.ts
async function s(e, t, n) {
	let o;
	if (t === "-") o = process.stdin;
	else try {
		o = (await i.open(t)).createReadStream();
	} catch {
		return process.stderr.write(`nova-control: cannot open script '${t}'\n`), 2;
	}
	let s = r.createInterface({
		input: o,
		terminal: !1
	}), l = 0;
	for await (let t of s) {
		let r = t.trim();
		if (r === "" || r.startsWith("#")) continue;
		let i = a(r);
		if (i.length === 0) continue;
		let o = 0;
		try {
			o = await n(i);
		} catch (e) {
			o = 1, process.stderr.write(`nova-control: ${e.message}\n`);
		}
		if (o !== 0) switch (l = o, e) {
			case "stop": return s.close(), o;
			case "continue": break;
			case "ask":
				if (!await c()) return s.close(), o;
				break;
		}
	}
	return s.close(), l;
}
async function c() {
	return process.stdin.isTTY ? new Promise((e) => {
		let t = r.createInterface({
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
var l = {
	OK: 0,
	GeneralError: 1,
	UsageError: 2
}, u = class extends Error {
	ExitCode;
	constructor(e, t = l.GeneralError) {
		super(e), this.name = "NovaCommandError", this.ExitCode = t;
	}
}, d = "nova-control", f, p = 9600, m = "stop", h;
async function g() {
	if (f == null) throw new u("--port is required — specify the serial port (e.g. /dev/ttyACM0 or COM3)", l.UsageError);
	return h ??= await n(f, p), h;
}
function _() {
	h != null && (h.destroy(), h = void 0);
}
function v(e, t = 9600, n = "stop") {
	f = e, p = t, m = n;
}
function y() {
	_(), f = void 0, p = 9600, m = "stop";
}
function b(e) {
	e.exitOverride(), e.configureOutput({ writeErr: () => {} });
	for (let t of e.commands) b(t);
}
function x(e = !1) {
	let n = new t(d);
	return n.description("NOVA robot arm CLI").allowUnknownOption(!1).configureOutput({ writeErr: () => {} }), e || (n.option("--port <path>", "serial port path (e.g. /dev/ttyACM0 on Linux/macOS, COM3 on Windows)").option("--baud <rate>", "baud rate (default: 9600)", "9600").option("--on-error <mode>", "script error mode: stop | continue | ask (default: stop)"), n.hook("preAction", (e, t) => {
		let n = t.optsWithGlobals();
		f = n.port, p = Number(n.baud ?? "9600"), m = n.onError ?? "stop";
	})), n.command("home").description("send all servos to their home positions").action(async () => {
		await (await g()).home();
	}), n.command("move").description("set one or more servo positions without interrupting the others").option("--shift-to <deg>", "shift head forward (>90°) or back (<90°) — s1").option("--roll-to <deg>", "roll head clockwise (>90°) or counter-clockwise (<90°) — s2").option("--pitch-to <deg>", "pitch head up (>110°) or down (<110°) — s3").option("--rotate-to <deg>", "rotate body around Z-axis — s4").option("--lift-to <deg>", "lift head on secondary axis, range 20°–150° — s5").action(async (e) => {
		let t = {};
		if (e.shiftTo != null && (t.s1 = Number(e.shiftTo)), e.rollTo != null && (t.s2 = Number(e.rollTo)), e.pitchTo != null && (t.s3 = Number(e.pitchTo)), e.rotateTo != null && (t.s4 = Number(e.rotateTo)), e.liftTo != null && (t.s5 = Number(e.liftTo)), Object.keys(t).length === 0) throw new u("move: specify at least one servo option (--shift-to, --roll-to, --pitch-to, --rotate-to, --lift-to)", l.UsageError);
		let n = await g();
		n.State = t, await n.sendServoState();
	}), n.command("shift-to").description("shift head forward (>90°) or back (<90°) — s1").argument("<deg>", "target angle in degrees").action(async (e) => {
		let t = await g();
		t.State = { s1: Number(e) }, await t.sendServoState();
	}), n.command("roll-to").description("roll head clockwise (>90°) or counter-clockwise (<90°) — s2").argument("<deg>", "target angle in degrees").action(async (e) => {
		let t = await g();
		t.State = { s2: Number(e) }, await t.sendServoState();
	}), n.command("pitch-to").description("pitch head up (>110°) or down (<110°) — s3").argument("<deg>", "target angle in degrees").action(async (e) => {
		let t = await g();
		t.State = { s3: Number(e) }, await t.sendServoState();
	}), n.command("rotate-to").description("rotate body around Z-axis — s4").argument("<deg>", "target angle in degrees").action(async (e) => {
		let t = await g();
		t.State = { s4: Number(e) }, await t.sendServoState();
	}), n.command("lift-to").description("lift head on secondary axis, range 20°–150° — s5").argument("<deg>", "target angle in degrees").action(async (e) => {
		let t = await g();
		t.State = { s5: Number(e) }, await t.sendServoState();
	}), n.command("wait").description("pause for <ms> milliseconds before the next command").argument("<ms>", "duration in milliseconds (non-negative number)").action(async (e) => {
		let t = Number(e);
		if (isNaN(t) || t < 0) throw new u(`wait: invalid duration '${e}' — expected a non-negative number`, l.UsageError);
		await new Promise((e) => setTimeout(e, t));
	}), n.command("state").description("print the current servo state as JSON").action(async () => {
		let e = await g();
		process.stdout.write(JSON.stringify(e.State) + "\n");
	}), e || (n.command("shell").description("start an interactive REPL").action(async () => {
		await o(d, (e) => S(e));
	}), n.option("--script <file>", "run commands from a script file (use - for stdin)").action(async (e) => {
		if (e.script != null) {
			let t = await s(m, e.script, S);
			process.exit(t);
		} else process.stdout.write(n.helpInformation()), process.exit(l.OK);
	}), n.addHelpCommand(!0)), n;
}
async function S(e) {
	if (e.length === 0) return l.OK;
	let t = x(!0);
	b(t);
	try {
		return await t.parseAsync([
			"node",
			d,
			...e
		]), l.OK;
	} catch (t) {
		let n = t;
		return n.code === "commander.help" || n.code === "commander.helpDisplayed" ? l.OK : n.code === "commander.unknownCommand" ? (process.stderr.write(`${d}: unknown command '${e[0]}' — try '${d} help'\n`), l.UsageError) : n.code === "commander.unknownOption" || n.code === "commander.missingArgument" || n.code === "commander.missingMandatoryOptionValue" ? (process.stderr.write(`${d}: ${n.message}\n`), l.UsageError) : t instanceof u ? (process.stderr.write(`${d}: ${t.message}\n`), t.ExitCode) : (process.stderr.write(`${d}: ${t.message ?? String(t)}\n`), l.GeneralError);
	}
}
async function C() {
	let e = x();
	b(e);
	try {
		await e.parseAsync(process.argv);
	} catch (t) {
		let n = t;
		(n.code === "commander.help" || n.code === "commander.helpDisplayed" || n.code === "commander.version") && process.exit(l.OK), (n.code === "commander.unknownCommand" || n.code === "commander.unknownOption" || n.code === "commander.missingArgument" || n.code === "commander.missingMandatoryOptionValue") && (process.stderr.write(`${d}: ${n.message}\n\n`), process.stderr.write(e.helpInformation()), process.exit(l.UsageError)), t instanceof u && (process.stderr.write(`${d}: ${t.message}\n`), process.exit(t.ExitCode)), process.stderr.write(`${d}: ${t.message ?? String(t)}\n`), process.exit(l.GeneralError);
	} finally {
		_();
	}
}
process.argv[1] === e(import.meta.url) && C().catch((e) => {
	process.stderr.write(`${d}: fatal: ${e.message ?? e}\n`), process.exit(l.GeneralError);
});
//#endregion
export { y as _destroyForTests, v as _setupForTests, S as executeTokens };
