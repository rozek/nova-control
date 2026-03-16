#!/usr/bin/env node
import { fileURLToPath as e } from "node:url";
import { realpathSync as t } from "node:fs";
import { createServer as n } from "node:http";
import { parseArgs as r } from "node:util";
import { Server as i } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport as a } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport as o } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema as s, ListToolsRequestSchema as c } from "@modelcontextprotocol/sdk/types.js";
import { openNova as l } from "nova-control-node";
//#region src/nova-control-mcp-server.ts
function u() {
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
var d = "", f = 9600, p;
async function m() {
	return p ??= await l(d, f), p;
}
function h() {
	p != null && (p.destroy(), p = void 0);
}
function g(e, t = 9600) {
	d = e, f = t;
}
function _() {
	h(), d = "", f = 9600;
}
var v = [
	{
		name: "home",
		description: "send all servos to their home positions",
		inputSchema: {
			type: "object",
			properties: {}
		}
	},
	{
		name: "move",
		description: "set one or more servo positions atomically — at least one of shift_to, roll_to, pitch_to, rotate_to, lift_to is required",
		inputSchema: {
			type: "object",
			properties: {
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
		description: "shift head forward (>90°) or back (<90°) — s1",
		inputSchema: {
			type: "object",
			properties: { deg: {
				type: "number",
				description: "target angle in degrees"
			} },
			required: ["deg"]
		}
	},
	{
		name: "roll_to",
		description: "roll head clockwise (>90°) or counter-clockwise (<90°) — s2",
		inputSchema: {
			type: "object",
			properties: { deg: {
				type: "number",
				description: "target angle in degrees"
			} },
			required: ["deg"]
		}
	},
	{
		name: "pitch_to",
		description: "pitch head up (>110°) or down (<110°) — s3",
		inputSchema: {
			type: "object",
			properties: { deg: {
				type: "number",
				description: "target angle in degrees"
			} },
			required: ["deg"]
		}
	},
	{
		name: "rotate_to",
		description: "rotate body around Z-axis — s4",
		inputSchema: {
			type: "object",
			properties: { deg: {
				type: "number",
				description: "target angle in degrees"
			} },
			required: ["deg"]
		}
	},
	{
		name: "lift_to",
		description: "lift head on secondary axis, range 20°–150° — s5",
		inputSchema: {
			type: "object",
			properties: { deg: {
				type: "number",
				description: "target angle in degrees"
			} },
			required: ["deg"]
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
	}
];
async function y() {
	return await (await m()).home(), "all servos moved to home positions";
}
async function b(e) {
	let t = {};
	if (e.shift_to != null && (t.s1 = Number(e.shift_to)), e.roll_to != null && (t.s2 = Number(e.roll_to)), e.pitch_to != null && (t.s3 = Number(e.pitch_to)), e.rotate_to != null && (t.s4 = Number(e.rotate_to)), e.lift_to != null && (t.s5 = Number(e.lift_to)), Object.keys(t).length === 0) throw Error("move: at least one of shift_to, roll_to, pitch_to, rotate_to, lift_to is required");
	let n = await m();
	return n.State = t, await n.sendServoState(), `servos updated: ${JSON.stringify(t)}`;
}
async function x(e) {
	let t = Number(e.deg), n = await m();
	return n.State = { s1: t }, await n.sendServoState(), `s1 (shift) → ${t}°`;
}
async function S(e) {
	let t = Number(e.deg), n = await m();
	return n.State = { s2: t }, await n.sendServoState(), `s2 (roll) → ${t}°`;
}
async function C(e) {
	let t = Number(e.deg), n = await m();
	return n.State = { s3: t }, await n.sendServoState(), `s3 (pitch) → ${t}°`;
}
async function w(e) {
	let t = Number(e.deg), n = await m();
	return n.State = { s4: t }, await n.sendServoState(), `s4 (rotate) → ${t}°`;
}
async function T(e) {
	let t = Number(e.deg), n = await m();
	return n.State = { s5: t }, await n.sendServoState(), `s5 (lift) → ${t}°`;
}
async function E(e) {
	let t = Number(e.ms);
	if (isNaN(t) || t < 0) throw Error(`wait: invalid duration '${e.ms}' — expected a non-negative number`);
	return await new Promise((e) => setTimeout(e, t)), `waited ${t} ms`;
}
async function D() {
	let e = await m();
	return JSON.stringify(e.State);
}
function O() {
	let e = new i({
		name: "nova-control-mcp-server",
		version: "0.0.4"
	}, { capabilities: { tools: {} } });
	return e.setRequestHandler(c, async () => ({ tools: v })), e.setRequestHandler(s, async (e) => {
		let t = e.params.name, n = e.params.arguments ?? {};
		try {
			let e;
			switch (t) {
				case "home":
					e = await y();
					break;
				case "move":
					e = await b(n);
					break;
				case "shift_to":
					e = await x(n);
					break;
				case "roll_to":
					e = await S(n);
					break;
				case "pitch_to":
					e = await C(n);
					break;
				case "rotate_to":
					e = await w(n);
					break;
				case "lift_to":
					e = await T(n);
					break;
				case "wait":
					e = await E(n);
					break;
				case "get_state":
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
async function k(e) {
	let t = new a();
	await e.connect(t);
	for (let e of ["SIGINT", "SIGTERM"]) process.on(e, () => {
		h(), process.exit(0);
	});
}
async function A(e, t) {
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
		await r.close(), i.close(), h(), process.exit(0);
	});
}
async function j() {
	let { Port: e, BaudRate: t, Transport: n, ListenPort: r } = u();
	d = e, f = t;
	let i = O();
	n === "http" ? await A(i, r) : await k(i);
}
t(process.argv[1]) === e(import.meta.url) && j().catch((e) => {
	process.stderr.write(`nova-control-mcp: fatal: ${e.message ?? e}\n`), process.exit(1);
});
//#endregion
export { _ as _destroyForTests, g as _setupForTests, O as createServer };
