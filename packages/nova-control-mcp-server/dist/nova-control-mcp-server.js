#!/usr/bin/env node
import { fileURLToPath as e } from "node:url";
import { realpathSync as t } from "node:fs";
import { createServer as n } from "node:http";
import { parseArgs as r } from "node:util";
import { Server as i } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport as a } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport as o } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema as s, ListToolsRequestSchema as c } from "@modelcontextprotocol/sdk/types.js";
import { openNova as l, runScript as u } from "nova-control-node";
//#region src/nova-control-mcp-server.ts
function d() {
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
var f = "", p = 9600, m;
async function h() {
	return m ??= await l(f, p), m;
}
function g() {
	m != null && (m.destroy(), m = void 0);
}
function _(e, t = 9600) {
	f = e, p = t;
}
function v() {
	g(), f = "", p = 9600;
}
var y = [
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
		description: "execute a multi-line movement script — one command per line; blank lines and lines starting with # are ignored; commands: home | shift-to <angle> | roll-to <angle> | pitch-to <angle> | rotate-to <angle> | lift-to <angle> | move [shift-to <angle>] [roll-to <angle>] [pitch-to <angle>] [rotate-to <angle>] [lift-to <angle>] | wait <ms>",
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
];
async function b(e) {
	let t = e.within_ms == null ? void 0 : Number(e.within_ms);
	return await (await h()).home(t), "all servos moved to home positions";
}
async function x(e) {
	let t = {};
	if (e.shift_to != null && (t.s1 = Number(e.shift_to)), e.roll_to != null && (t.s2 = Number(e.roll_to)), e.pitch_to != null && (t.s3 = Number(e.pitch_to)), e.rotate_to != null && (t.s4 = Number(e.rotate_to)), e.lift_to != null && (t.s5 = Number(e.lift_to)), Object.keys(t).length === 0) throw Error("move: at least one of shift_to, roll_to, pitch_to, rotate_to, lift_to is required");
	let n = e.within_ms == null ? void 0 : Number(e.within_ms);
	return await (await h()).moveTo(t, n), `servos updated: ${JSON.stringify(t)}`;
}
async function S(e) {
	let t = Number(e.angle), n = e.within_ms == null ? void 0 : Number(e.within_ms);
	return await (await h()).shiftHeadTo(t, n), `s1 (shift) → ${t}°`;
}
async function C(e) {
	let t = Number(e.angle), n = e.within_ms == null ? void 0 : Number(e.within_ms);
	return await (await h()).rollHeadTo(t, n), `s2 (roll) → ${t}°`;
}
async function w(e) {
	let t = Number(e.angle), n = e.within_ms == null ? void 0 : Number(e.within_ms);
	return await (await h()).pitchHeadTo(t, n), `s3 (pitch) → ${t}°`;
}
async function T(e) {
	let t = Number(e.angle), n = e.within_ms == null ? void 0 : Number(e.within_ms);
	return await (await h()).rotateBodyTo(t, n), `s4 (rotate) → ${t}°`;
}
async function E(e) {
	let t = Number(e.angle), n = e.within_ms == null ? void 0 : Number(e.within_ms);
	return await (await h()).liftHeadTo(t, n), `s5 (lift) → ${t}°`;
}
async function D() {
	return m == null ? "not connected" : (g(), "disconnected");
}
async function O(e) {
	let t = Number(e.within_ms);
	if (isNaN(t) || t <= 0) throw Error("move_to: within_ms must be a positive number");
	let n = {};
	if (e.s1 != null && (n.s1 = Number(e.s1)), e.s2 != null && (n.s2 = Number(e.s2)), e.s3 != null && (n.s3 = Number(e.s3)), e.s4 != null && (n.s4 = Number(e.s4)), e.s5 != null && (n.s5 = Number(e.s5)), Object.keys(n).length === 0) throw Error("move_to: at least one servo target (s1–s5) must be specified");
	return await (await h()).moveTo(n, t), "move completed";
}
async function k(e) {
	let t = Number(e.ms);
	if (isNaN(t) || t < 0) throw Error(`wait: invalid duration '${e.ms}' — expected a non-negative number`);
	return await new Promise((e) => setTimeout(e, t)), `waited ${t} ms`;
}
async function A() {
	let e = await h();
	return JSON.stringify(e.State);
}
async function j(e) {
	let t = String(e.script ?? "");
	return await u(await h(), t), "script executed successfully";
}
function M() {
	let e = new i({
		name: "nova-control-mcp-server",
		version: "0.0.6"
	}, { capabilities: { tools: {} } });
	return e.setRequestHandler(c, async () => ({ tools: y })), e.setRequestHandler(s, async (e) => {
		let t = e.params.name, n = e.params.arguments ?? {};
		try {
			let e;
			switch (t) {
				case "home":
					e = await b(n);
					break;
				case "move":
					e = await x(n);
					break;
				case "shift_to":
					e = await S(n);
					break;
				case "roll_to":
					e = await C(n);
					break;
				case "pitch_to":
					e = await w(n);
					break;
				case "rotate_to":
					e = await T(n);
					break;
				case "lift_to":
					e = await E(n);
					break;
				case "move_to":
					e = await O(n);
					break;
				case "wait":
					e = await k(n);
					break;
				case "get_state":
					e = await A();
					break;
				case "run_script":
					e = await j(n);
					break;
				case "disconnect":
					e = await D();
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
					text: e instanceof Error ? e.message : String(e)
				}],
				isError: !0
			};
		}
	}), e;
}
async function N(e) {
	let t = new a();
	await e.connect(t);
	for (let e of ["SIGINT", "SIGTERM"]) process.on(e, () => {
		g(), process.exit(0);
	});
}
async function P(e, t) {
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
		await r.close(), i.close(), g(), process.exit(0);
	});
}
async function F() {
	let { Port: e, BaudRate: t, Transport: n, ListenPort: r } = d();
	f = e, p = t;
	let i = M();
	n === "http" ? await P(i, r) : await N(i);
}
t(process.argv[1]) === e(import.meta.url) && F().catch((e) => {
	process.stderr.write(`nova-control-mcp: fatal: ${e.message ?? e}\n`), process.exit(1);
});
//#endregion
export { v as _destroyForTests, _ as _setupForTests, M as createServer };
