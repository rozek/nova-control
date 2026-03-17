#!/usr/bin/env node
import { fileURLToPath as e } from "node:url";
import { realpathSync as t } from "node:fs";
import { createServer as n } from "node:http";
import { parseArgs as r } from "node:util";
import { Server as i } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport as a } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport as o } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema as s, ListToolsRequestSchema as c } from "@modelcontextprotocol/sdk/types.js";
import { z as l } from "zod";
import { SerialPort as u } from "serialport";
//#region ../nova-control-node/dist/nova-control-node.js
var d = 9600, f = Object.freeze({
	s1: 90,
	s2: 90,
	s3: 110,
	s4: 90,
	s5: 95
}), p = Object.freeze({
	s1: [45, 135],
	s2: [10, 170],
	s3: [40, 150],
	s4: [30, 180],
	s5: [20, 150]
}), m = Object.freeze({
	s1: (p.s1[1] - p.s1[0]) / 1e3,
	s2: (p.s2[1] - p.s2[0]) / 1e3,
	s3: (p.s3[1] - p.s3[0]) / 1e3,
	s4: (p.s4[1] - p.s4[0]) / 1e3,
	s5: (p.s5[1] - p.s5[0]) / 1e3
});
function h(e, t) {
	let [n, r] = p[t];
	return Math.max(n, Math.min(r, Math.round(e)));
}
function g(e) {
	return new Uint8Array([
		h(e.s4, "s4"),
		h(e.s3, "s3"),
		h(e.s2, "s2"),
		h(e.s1, "s1"),
		h(e.s5, "s5")
	]);
}
async function _(e, t) {
	let n = new u({
		path: e,
		baudRate: t,
		autoOpen: !1
	});
	return await new Promise((e, t) => {
		n.open((n) => {
			n == null ? e() : t(n);
		});
	}), await new Promise((e) => setTimeout(e, 2e3)), {
		async write(e) {
			await new Promise((t, r) => {
				n.write(Buffer.from(e), (e) => {
					e == null ? t() : r(e);
				});
			}), await new Promise((e, t) => {
				n.drain((n) => {
					n == null ? e() : t(n);
				});
			});
		},
		destroy() {
			n.close();
		}
	};
}
function v(e, t) {
	let n = Math.min(.499, Math.max(0, t)), r = 1 / (1 - n);
	if (e <= n) return r * e * e / (2 * n);
	if (e <= 1 - n) return r * (e - n / 2);
	let i = 1 - e;
	return 1 - r * i * i / (2 * n);
}
async function y(e, t = d, n) {
	let r = n?.StepIntervalMs ?? 20, i = n?.RampRatio ?? .25, a = await _(e, t), o = { ...f }, s, c = Promise.resolve();
	function l(e) {
		s = {
			...s ?? o,
			...e
		};
	}
	async function u() {
		let e = c;
		c = (async () => {
			try {
				await e;
			} catch {}
			for (; s != null;) {
				let e = s, t = !0, n = { ...o };
				for (let i of [
					"s1",
					"s2",
					"s3",
					"s4",
					"s5"
				]) {
					let a = e[i] - o[i], s = r > 0 ? m[i] * r : Infinity;
					Math.abs(a) > s ? (n[i] = o[i] + Math.sign(a) * s, t = !1) : n[i] = e[i];
				}
				t && (s = void 0), o = { ...n }, await a.write(g(n)), t || await new Promise((e) => setTimeout(e, r));
			}
		})(), await c;
	}
	async function p(e, t) {
		let n = c;
		c = (async () => {
			try {
				await n;
			} catch {}
			let c = { ...o }, l = r > 0 ? Math.max(1, Math.round(t / r)) : 1;
			s = void 0;
			for (let t = 1; t <= l; t++) {
				let n = v(t / l, i), s = { ...o };
				for (let t of Object.keys(e)) s[t] = Math.round(c[t] + (e[t] - c[t]) * n);
				o = s, await a.write(g(s)), t < l && await new Promise((e) => setTimeout(e, r));
			}
		})(), await c;
	}
	return {
		async home(e) {
			e != null && e > 0 ? await p({ ...f }, e) : (l({ ...f }), await u());
		},
		async shiftHeadTo(e, t) {
			t != null && t > 0 ? await p({ s1: e }, t) : (l({ s1: e }), await u());
		},
		async rollHeadTo(e, t) {
			t != null && t > 0 ? await p({ s2: e }, t) : (l({ s2: e }), await u());
		},
		async pitchHeadTo(e, t) {
			t != null && t > 0 ? await p({ s3: e }, t) : (l({ s3: e }), await u());
		},
		async liftHeadTo(e, t) {
			t != null && t > 0 ? await p({ s5: e }, t) : (l({ s5: e }), await u());
		},
		async rotateBodyTo(e, t) {
			t != null && t > 0 ? await p({ s4: e }, t) : (l({ s4: e }), await u());
		},
		async moveTo(e, t) {
			t != null && t > 0 ? await p(e, t) : (l(e), await u());
		},
		get State() {
			return structuredClone(s ?? o);
		},
		set State(e) {
			s = {
				...o,
				...e
			};
		},
		async sendServoState() {
			await u();
		},
		destroy() {
			a.destroy();
		}
	};
}
async function b(e, t) {
	let n = t.split("\n");
	for (let t = 0; t < n.length; t++) {
		let r = n[t].trim(), i = t + 1;
		if (r === "" || r.startsWith("#")) continue;
		let a = r.split(/\s+/), o = a[0].toLowerCase();
		switch (!0) {
			case o === "home": {
				let t = a[1] == null ? void 0 : Number(a[1]);
				if (t != null && isNaN(t)) throw Error(`line ${i}: home: within_ms must be a number, got '${a[1]}'`);
				await e.home(t);
				break;
			}
			case o === "shift-to": {
				let t = Number(a[1]);
				if (isNaN(t)) throw Error(`line ${i}: shift-to requires a numeric angle, got '${a[1]}'`);
				let n = a[2] == null ? void 0 : Number(a[2]);
				if (n != null && isNaN(n)) throw Error(`line ${i}: shift-to: within_ms must be a number, got '${a[2]}'`);
				await e.shiftHeadTo(t, n);
				break;
			}
			case o === "roll-to": {
				let t = Number(a[1]);
				if (isNaN(t)) throw Error(`line ${i}: roll-to requires a numeric angle, got '${a[1]}'`);
				let n = a[2] == null ? void 0 : Number(a[2]);
				if (n != null && isNaN(n)) throw Error(`line ${i}: roll-to: within_ms must be a number, got '${a[2]}'`);
				await e.rollHeadTo(t, n);
				break;
			}
			case o === "pitch-to": {
				let t = Number(a[1]);
				if (isNaN(t)) throw Error(`line ${i}: pitch-to requires a numeric angle, got '${a[1]}'`);
				let n = a[2] == null ? void 0 : Number(a[2]);
				if (n != null && isNaN(n)) throw Error(`line ${i}: pitch-to: within_ms must be a number, got '${a[2]}'`);
				await e.pitchHeadTo(t, n);
				break;
			}
			case o === "rotate-to": {
				let t = Number(a[1]);
				if (isNaN(t)) throw Error(`line ${i}: rotate-to requires a numeric angle, got '${a[1]}'`);
				let n = a[2] == null ? void 0 : Number(a[2]);
				if (n != null && isNaN(n)) throw Error(`line ${i}: rotate-to: within_ms must be a number, got '${a[2]}'`);
				await e.rotateBodyTo(t, n);
				break;
			}
			case o === "lift-to": {
				let t = Number(a[1]);
				if (isNaN(t)) throw Error(`line ${i}: lift-to requires a numeric angle, got '${a[1]}'`);
				let n = a[2] == null ? void 0 : Number(a[2]);
				if (n != null && isNaN(n)) throw Error(`line ${i}: lift-to: within_ms must be a number, got '${a[2]}'`);
				await e.liftHeadTo(t, n);
				break;
			}
			case o === "move": {
				let t = {}, n;
				for (let e = 1; e < a.length; e += 2) {
					let r = a[e].toLowerCase(), o = Number(a[e + 1]);
					if (r === "within-ms") {
						if (isNaN(o)) throw Error(`line ${i}: within-ms requires a numeric value, got '${a[e + 1]}'`);
						n = o;
						break;
					}
					if (isNaN(o)) throw Error(`line ${i}: '${r}' requires a numeric angle, got '${a[e + 1]}'`);
					switch (r) {
						case "shift-to":
							t.s1 = o;
							break;
						case "roll-to":
							t.s2 = o;
							break;
						case "pitch-to":
							t.s3 = o;
							break;
						case "rotate-to":
							t.s4 = o;
							break;
						case "lift-to":
							t.s5 = o;
							break;
						default: throw Error(`line ${i}: unknown move argument '${r}'`);
					}
				}
				if (Object.keys(t).length === 0) throw Error(`line ${i}: move requires at least one servo argument`);
				await e.moveTo(t, n);
				break;
			}
			case o === "wait": {
				let e = Number(a[1]);
				if (isNaN(e) || e < 0) throw Error(`line ${i}: wait requires a non-negative number in ms, got '${a[1]}'`);
				await new Promise((t) => setTimeout(t, e));
				break;
			}
			default: throw Error(`line ${i}: unknown command '${o}'`);
		}
	}
}
//#endregion
//#region src/nova-control-mcp-server.ts
function x() {
	try {
		let { values: e } = r({
			args: process.argv.slice(2),
			options: {
				port: {
					type: "string",
					short: "p"
				},
				baud: {
					type: "string",
					short: "b"
				},
				transport: {
					type: "string",
					short: "t"
				},
				listen: {
					type: "string",
					short: "l"
				}
			},
			strict: !0,
			allowPositionals: !1
		});
		e.port ?? (process.stderr.write("nova-control-mcp: --port is required\n"), process.exit(1));
		let t = e.transport ?? "stdio";
		return t !== "stdio" && t !== "http" && (process.stderr.write(`nova-control-mcp: --transport must be 'stdio' or 'http', got '${t}'\n`), process.exit(1)), {
			Port: e.port,
			BaudRate: Number(e.baud ?? "9600"),
			Transport: t,
			ListenPort: Number(e.listen ?? "3000")
		};
	} catch (e) {
		process.stderr.write(`nova-control-mcp: ${e.message ?? e}\n`), process.exit(1);
	}
}
var S = "", C = 9600, w;
async function T() {
	return w ??= await y(S, C), w;
}
function E() {
	w != null && (w.destroy(), w = void 0);
}
function D(e, t = 9600) {
	S = e, C = t;
}
function O() {
	E(), S = "", C = 9600;
}
var k = [
	{
		name: "home",
		description: "send all servos to their home positions — pass within_ms for smooth, fluid motion with automatic velocity ramp-up and ramp-down; without within_ms the robot moves at constant maximum speed",
		inputSchema: {
			type: "object",
			properties: { within_ms: {
				type: "number",
				description: "duration in milliseconds for smooth motion with trapezoidal ramp-up and ramp-down — servos glide gradually to the target instead of jumping; omit for constant-speed movement"
			} }
		}
	},
	{
		name: "move",
		description: "set one or more servo positions atomically — at least one of shift_to, roll_to, pitch_to, rotate_to, lift_to is required; pass within_ms for smooth, fluid motion with automatic velocity ramp-up and ramp-down",
		inputSchema: {
			type: "object",
			properties: {
				within_ms: {
					type: "number",
					description: "duration in milliseconds for smooth motion with trapezoidal ramp-up and ramp-down — servos glide gradually to their targets instead of jumping; omit for constant-speed movement"
				},
				shift_to: {
					type: "number",
					description: "shift head forward (>90°) or back (<90°) — s1"
				},
				roll_to: {
					type: "number",
					description: "roll head clockwise (>90°) or counter-clockwise (<90°) — s2"
				},
				pitch_to: {
					type: "number",
					description: "pitch head up (>110°) or down (<110°) — s3"
				},
				rotate_to: {
					type: "number",
					description: "rotate body around Z-axis — s4"
				},
				lift_to: {
					type: "number",
					description: "lift head on secondary axis, range 20°–150° — s5"
				}
			}
		}
	},
	{
		name: "shift_to",
		description: "shift head forward (>90°) or back (<90°) — s1; pass within_ms for smooth motion with trapezoidal velocity profile (ramp-up → constant speed → ramp-down)",
		inputSchema: {
			type: "object",
			properties: {
				angle: {
					type: "number",
					description: "target angle in degrees"
				},
				within_ms: {
					type: "number",
					description: "duration in milliseconds for smooth motion with trapezoidal ramp-up and ramp-down; omit for constant-speed movement"
				}
			},
			required: ["angle"]
		}
	},
	{
		name: "roll_to",
		description: "roll head clockwise (>90°) or counter-clockwise (<90°) — s2; pass within_ms for smooth motion with trapezoidal velocity profile",
		inputSchema: {
			type: "object",
			properties: {
				angle: {
					type: "number",
					description: "target angle in degrees"
				},
				within_ms: {
					type: "number",
					description: "duration in milliseconds for smooth motion with trapezoidal ramp-up and ramp-down; omit for constant-speed movement"
				}
			},
			required: ["angle"]
		}
	},
	{
		name: "pitch_to",
		description: "pitch head up (>110°) or down (<110°) — s3; pass within_ms for smooth motion with trapezoidal velocity profile",
		inputSchema: {
			type: "object",
			properties: {
				angle: {
					type: "number",
					description: "target angle in degrees"
				},
				within_ms: {
					type: "number",
					description: "duration in milliseconds for smooth motion with trapezoidal ramp-up and ramp-down; omit for constant-speed movement"
				}
			},
			required: ["angle"]
		}
	},
	{
		name: "rotate_to",
		description: "rotate body around Z-axis — s4; pass within_ms for smooth motion with trapezoidal velocity profile",
		inputSchema: {
			type: "object",
			properties: {
				angle: {
					type: "number",
					description: "target angle in degrees"
				},
				within_ms: {
					type: "number",
					description: "duration in milliseconds for smooth motion with trapezoidal ramp-up and ramp-down; omit for constant-speed movement"
				}
			},
			required: ["angle"]
		}
	},
	{
		name: "lift_to",
		description: "lift head on secondary axis, range 20°–150° — s5; pass within_ms for smooth motion with trapezoidal velocity profile",
		inputSchema: {
			type: "object",
			properties: {
				angle: {
					type: "number",
					description: "target angle in degrees"
				},
				within_ms: {
					type: "number",
					description: "duration in milliseconds for smooth motion with trapezoidal ramp-up and ramp-down; omit for constant-speed movement"
				}
			},
			required: ["angle"]
		}
	},
	{
		name: "move_to",
		description: "move one or more servos smoothly to their target positions, completing the movement in the specified number of milliseconds using a trapezoidal ramp-up/ramp-down profile",
		inputSchema: {
			type: "object",
			properties: {
				within_ms: {
					type: "number",
					description: "total movement duration in milliseconds (must be > 0)"
				},
				s1: {
					type: "number",
					description: "head shift target angle (optional)"
				},
				s2: {
					type: "number",
					description: "head roll target angle (optional)"
				},
				s3: {
					type: "number",
					description: "head pitch target angle (optional)"
				},
				s4: {
					type: "number",
					description: "body rotate target angle (optional)"
				},
				s5: {
					type: "number",
					description: "head lift target angle (optional)"
				}
			},
			required: ["within_ms"]
		}
	},
	{
		name: "wait",
		description: "pause for a given number of milliseconds before the next action",
		inputSchema: {
			type: "object",
			properties: { ms: {
				type: "number",
				description: "duration in milliseconds (non-negative)"
			} },
			required: ["ms"]
		}
	},
	{
		name: "get_state",
		description: "return the current servo positions as a JSON object with keys s1–s5",
		inputSchema: {
			type: "object",
			properties: {}
		}
	},
	{
		name: "run_script",
		description: "execute a multi-line movement script — one command per line; blank lines and lines starting with # are ignored; each command is fully awaited before the next begins; commands: home [<within_ms>] | shift-to <angle> [<within_ms>] | roll-to <angle> [<within_ms>] | pitch-to <angle> [<within_ms>] | rotate-to <angle> [<within_ms>] | lift-to <angle> [<within_ms>] | move [shift-to <angle>] [roll-to <angle>] [pitch-to <angle>] [rotate-to <angle>] [lift-to <angle>] [within-ms <ms>] | wait <ms>",
		inputSchema: {
			type: "object",
			properties: { script: {
				type: "string",
				description: "multi-line movement script"
			} },
			required: ["script"]
		}
	},
	{
		name: "disconnect",
		description: "close the serial connection to the robot — call this when you are done to free the serial port; the connection reopens automatically on the first subsequent movement command",
		inputSchema: {
			type: "object",
			properties: {}
		}
	}
], A = l.number().finite(), j = l.number().positive(), M = l.object({ within_ms: j.optional() }), N = l.object({
	angle: A,
	within_ms: j.optional()
}), P = l.object({
	shift_to: A.optional(),
	roll_to: A.optional(),
	pitch_to: A.optional(),
	rotate_to: A.optional(),
	lift_to: A.optional(),
	within_ms: j.optional()
}).superRefine((e, t) => {
	e.shift_to == null && e.roll_to == null && e.pitch_to == null && e.rotate_to == null && e.lift_to == null && t.addIssue({
		code: l.ZodIssueCode.custom,
		message: "move: at least one of shift_to, roll_to, pitch_to, rotate_to, lift_to is required"
	});
}), F = l.object({
	within_ms: j,
	s1: A.optional(),
	s2: A.optional(),
	s3: A.optional(),
	s4: A.optional(),
	s5: A.optional()
}).superRefine((e, t) => {
	e.s1 == null && e.s2 == null && e.s3 == null && e.s4 == null && e.s5 == null && t.addIssue({
		code: l.ZodIssueCode.custom,
		message: "move_to: at least one servo target (s1–s5) must be specified"
	});
}), I = l.object({ ms: l.number().finite().nonnegative() }), L = l.object({ script: l.string() });
function R(e) {
	return e.issues.map((e) => `${e.path.length > 0 ? `${e.path.join(".")}: ` : ""}${e.message}`).join("; ");
}
async function z(e) {
	let { within_ms: t } = M.parse(e);
	return await (await T()).home(t), "all servos moved to home positions";
}
async function B(e) {
	let t = P.parse(e), n = {};
	return t.shift_to != null && (n.s1 = t.shift_to), t.roll_to != null && (n.s2 = t.roll_to), t.pitch_to != null && (n.s3 = t.pitch_to), t.rotate_to != null && (n.s4 = t.rotate_to), t.lift_to != null && (n.s5 = t.lift_to), await (await T()).moveTo(n, t.within_ms), `servos updated: ${JSON.stringify(n)}`;
}
async function V(e) {
	let { angle: t, within_ms: n } = N.parse(e);
	return await (await T()).shiftHeadTo(t, n), `s1 (shift) → ${t}°`;
}
async function H(e) {
	let { angle: t, within_ms: n } = N.parse(e);
	return await (await T()).rollHeadTo(t, n), `s2 (roll) → ${t}°`;
}
async function U(e) {
	let { angle: t, within_ms: n } = N.parse(e);
	return await (await T()).pitchHeadTo(t, n), `s3 (pitch) → ${t}°`;
}
async function W(e) {
	let { angle: t, within_ms: n } = N.parse(e);
	return await (await T()).rotateBodyTo(t, n), `s4 (rotate) → ${t}°`;
}
async function G(e) {
	let { angle: t, within_ms: n } = N.parse(e);
	return await (await T()).liftHeadTo(t, n), `s5 (lift) → ${t}°`;
}
async function K() {
	return w == null ? "not connected" : (E(), "disconnected");
}
async function q(e) {
	let t = F.parse(e), n = {};
	return t.s1 != null && (n.s1 = t.s1), t.s2 != null && (n.s2 = t.s2), t.s3 != null && (n.s3 = t.s3), t.s4 != null && (n.s4 = t.s4), t.s5 != null && (n.s5 = t.s5), await (await T()).moveTo(n, t.within_ms), "move completed";
}
async function J(e) {
	let t;
	try {
		t = I.parse(e);
	} catch {
		throw Error(`wait: invalid duration '${e.ms}' — expected a non-negative number`);
	}
	return await new Promise((e) => setTimeout(e, t.ms)), `waited ${t.ms} ms`;
}
async function Y() {
	let e = await T();
	return JSON.stringify(e.State);
}
async function X(e) {
	let { script: t } = L.parse(e);
	return await b(await T(), t), "script executed successfully";
}
function Z() {
	let e = new i({
		name: "nova-control-mcp-server",
		version: "0.0.8"
	}, { capabilities: { tools: {} } });
	return e.setRequestHandler(c, async () => ({ tools: k })), e.setRequestHandler(s, async (e) => {
		let t = e.params.name, n = e.params.arguments ?? {};
		try {
			let e;
			switch (t) {
				case "home":
					e = await z(n);
					break;
				case "move":
					e = await B(n);
					break;
				case "shift_to":
					e = await V(n);
					break;
				case "roll_to":
					e = await H(n);
					break;
				case "pitch_to":
					e = await U(n);
					break;
				case "rotate_to":
					e = await W(n);
					break;
				case "lift_to":
					e = await G(n);
					break;
				case "move_to":
					e = await q(n);
					break;
				case "wait":
					e = await J(n);
					break;
				case "get_state":
					e = await Y();
					break;
				case "run_script":
					e = await X(n);
					break;
				case "disconnect":
					e = await K();
					break;
				default: return {
					content: [{
						type: "text",
						text: `unknown tool: ${t}`
					}],
					isError: !0
				};
			}
			return { content: [{
				type: "text",
				text: e
			}] };
		} catch (e) {
			return {
				content: [{
					type: "text",
					text: e instanceof l.ZodError ? R(e) : e instanceof Error ? e.message : String(e)
				}],
				isError: !0
			};
		}
	}), e;
}
async function Q(e) {
	let t = new a();
	await e.connect(t);
	for (let e of ["SIGINT", "SIGTERM"]) process.on(e, () => {
		E(), process.exit(0);
	});
}
async function $(e, t) {
	let r = new o({ sessionIdGenerator: void 0 });
	await e.connect(r);
	let i = n(async (e, t) => {
		e.url === "/mcp" ? await r.handleRequest(e, t) : (t.writeHead(404, { "Content-Type": "text/plain" }), t.end("not found"));
	});
	await new Promise((e, n) => {
		i.listen(t, () => {
			process.stderr.write(`nova-control-mcp: HTTP transport listening on port ${t} — POST /mcp\n`), e();
		}), i.once("error", n);
	});
	for (let e of ["SIGINT", "SIGTERM"]) process.on(e, async () => {
		await r.close(), i.close(), E(), process.exit(0);
	});
}
async function ee() {
	let { Port: e, BaudRate: t, Transport: n, ListenPort: r } = x();
	S = e, C = t;
	let i = Z();
	n === "http" ? await $(i, r) : await Q(i);
}
t(process.argv[1]) === e(import.meta.url) && ee().catch((e) => {
	process.stderr.write(`nova-control-mcp: fatal: ${e.message ?? e}\n`), process.exit(1);
});
//#endregion
export { O as _destroyForTests, D as _setupForTests, Z as createServer };
