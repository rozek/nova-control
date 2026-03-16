#!/usr/bin/env node
import { fileURLToPath as e } from "node:url";
import { parseArgs as t } from "node:util";
import { Server as n } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport as r } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema as i, ListToolsRequestSchema as a } from "@modelcontextprotocol/sdk/types.js";
import { openNova as o } from "nova-control-node";
//#region src/nova-control-mcp-server.ts
function s() {
	try {
		let { values: e } = t({
			args: process.argv.slice(2),
			options: {
				port: {
					type: "string",
					short: "p"
				},
				baud: {
					type: "string",
					short: "b"
				}
			},
			strict: !0,
			allowPositionals: !1
		});
		return e.port ?? (process.stderr.write("nova-control-mcp: --port is required\n"), process.exit(1)), {
			Port: e.port,
			BaudRate: Number(e.baud ?? "9600")
		};
	} catch (e) {
		process.stderr.write(`nova-control-mcp: ${e.message ?? e}\n`), process.exit(1);
	}
}
var c = "", l = 9600, u;
async function d() {
	return u ??= await o(c, l), u;
}
function f() {
	u != null && (u.destroy(), u = void 0);
}
function p(e, t = 9600) {
	c = e, l = t;
}
function m() {
	f(), c = "", l = 9600;
}
var h = [
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
async function g() {
	return await (await d()).home(), "all servos moved to home positions";
}
async function _(e) {
	let t = {};
	if (e.shift_to != null && (t.s1 = Number(e.shift_to)), e.roll_to != null && (t.s2 = Number(e.roll_to)), e.pitch_to != null && (t.s3 = Number(e.pitch_to)), e.rotate_to != null && (t.s4 = Number(e.rotate_to)), e.lift_to != null && (t.s5 = Number(e.lift_to)), Object.keys(t).length === 0) throw Error("move: at least one of shift_to, roll_to, pitch_to, rotate_to, lift_to is required");
	let n = await d();
	return n.State = t, await n.sendServoState(), `servos updated: ${JSON.stringify(t)}`;
}
async function v(e) {
	let t = Number(e.deg), n = await d();
	return n.State = { s1: t }, await n.sendServoState(), `s1 (shift) → ${t}°`;
}
async function y(e) {
	let t = Number(e.deg), n = await d();
	return n.State = { s2: t }, await n.sendServoState(), `s2 (roll) → ${t}°`;
}
async function b(e) {
	let t = Number(e.deg), n = await d();
	return n.State = { s3: t }, await n.sendServoState(), `s3 (pitch) → ${t}°`;
}
async function x(e) {
	let t = Number(e.deg), n = await d();
	return n.State = { s4: t }, await n.sendServoState(), `s4 (rotate) → ${t}°`;
}
async function S(e) {
	let t = Number(e.deg), n = await d();
	return n.State = { s5: t }, await n.sendServoState(), `s5 (lift) → ${t}°`;
}
async function C(e) {
	let t = Number(e.ms);
	if (isNaN(t) || t < 0) throw Error(`wait: invalid duration '${e.ms}' — expected a non-negative number`);
	return await new Promise((e) => setTimeout(e, t)), `waited ${t} ms`;
}
async function w() {
	let e = await d();
	return JSON.stringify(e.State);
}
function T() {
	let e = new n({
		name: "nova-control-mcp-server",
		version: "0.0.1"
	}, { capabilities: { tools: {} } });
	return e.setRequestHandler(a, async () => ({ tools: h })), e.setRequestHandler(i, async (e) => {
		let t = e.params.name, n = e.params.arguments ?? {};
		try {
			let e;
			switch (t) {
				case "home":
					e = await g();
					break;
				case "move":
					e = await _(n);
					break;
				case "shift_to":
					e = await v(n);
					break;
				case "roll_to":
					e = await y(n);
					break;
				case "pitch_to":
					e = await b(n);
					break;
				case "rotate_to":
					e = await x(n);
					break;
				case "lift_to":
					e = await S(n);
					break;
				case "wait":
					e = await C(n);
					break;
				case "get_state":
					e = await w();
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
async function E() {
	let { Port: e, BaudRate: t } = s();
	c = e, l = t;
	let n = T(), i = new r();
	await n.connect(i);
	for (let e of ["SIGINT", "SIGTERM"]) process.on(e, () => {
		f(), process.exit(0);
	});
}
process.argv[1] === e(import.meta.url) && E().catch((e) => {
	process.stderr.write(`nova-control-mcp: fatal: ${e.message ?? e}\n`), process.exit(1);
});
//#endregion
export { m as _destroyForTests, p as _setupForTests, T as createServer };
