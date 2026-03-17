//#region src/nova-control-browser.ts
var e = 9600, t = Object.freeze({
	s1: 90,
	s2: 90,
	s3: 110,
	s4: 90,
	s5: 95
}), n = Object.freeze({
	s1: [45, 135],
	s2: [10, 170],
	s3: [40, 150],
	s4: [30, 180],
	s5: [20, 150]
}), r = Object.freeze({
	s1: (n.s1[1] - n.s1[0]) / 1e3,
	s2: (n.s2[1] - n.s2[0]) / 1e3,
	s3: (n.s3[1] - n.s3[0]) / 1e3,
	s4: (n.s4[1] - n.s4[0]) / 1e3,
	s5: (n.s5[1] - n.s5[0]) / 1e3
});
function i(e, t) {
	let [r, i] = n[t];
	return Math.max(r, Math.min(i, Math.round(e)));
}
function a(e) {
	return new Uint8Array([
		i(e.s4, "s4"),
		i(e.s3, "s3"),
		i(e.s2, "s2"),
		i(e.s1, "s1"),
		i(e.s5, "s5")
	]);
}
async function o(t) {
	if (!("serial" in navigator)) throw Error("Nova: Web Serial API is not supported in this browser");
	let n = navigator.serial, r = t instanceof EventTarget ? t : await n.requestPort(t ?? {});
	await r.open({ baudRate: e });
	let i = r.writable.getWriter();
	await new Promise((e) => setTimeout(e, 2e3));
	let a = !1;
	return {
		async write(e) {
			a || await i.write(e);
		},
		destroy() {
			if (!a) {
				a = !0;
				try {
					i.releaseLock();
				} catch {}
				r.close().catch(() => {});
			}
		}
	};
}
function s(e, t) {
	let n = Math.min(.499, Math.max(0, t)), r = 1 / (1 - n);
	if (e <= n) return r * e * e / (2 * n);
	if (e <= 1 - n) return r * (e - n / 2);
	let i = 1 - e;
	return 1 - r * i * i / (2 * n);
}
async function c(e, n) {
	let i = n?.StepIntervalMs ?? 20, c = n?.RampRatio ?? .25, l = await o(e), u = { ...t }, d, f = Promise.resolve();
	function p(e) {
		d = {
			...d ?? u,
			...e
		};
	}
	async function m() {
		let e = f;
		f = (async () => {
			try {
				await e;
			} catch {}
			for (; d != null;) {
				let e = d, t = !0, n = { ...u };
				for (let a of [
					"s1",
					"s2",
					"s3",
					"s4",
					"s5"
				]) {
					let o = e[a] - u[a], s = i > 0 ? r[a] * i : Infinity;
					Math.abs(o) > s ? (n[a] = u[a] + Math.sign(o) * s, t = !1) : n[a] = e[a];
				}
				t && (d = void 0), u = { ...n }, await l.write(a(n)), t || await new Promise((e) => setTimeout(e, i));
			}
		})(), await f;
	}
	async function h(e, t) {
		let n = f;
		f = (async () => {
			try {
				await n;
			} catch {}
			let r = { ...u }, o = i > 0 ? Math.max(1, Math.round(t / i)) : 1;
			d = void 0;
			for (let t = 1; t <= o; t++) {
				let n = s(t / o, c), d = { ...u };
				for (let t of Object.keys(e)) d[t] = Math.round(r[t] + (e[t] - r[t]) * n);
				u = d, await l.write(a(d)), t < o && await new Promise((e) => setTimeout(e, i));
			}
		})(), await f;
	}
	return {
		async home(e) {
			e != null && e > 0 ? await h({ ...t }, e) : (p({ ...t }), await m());
		},
		async shiftHeadTo(e, t) {
			t != null && t > 0 ? await h({ s1: e }, t) : (p({ s1: e }), await m());
		},
		async rollHeadTo(e, t) {
			t != null && t > 0 ? await h({ s2: e }, t) : (p({ s2: e }), await m());
		},
		async pitchHeadTo(e, t) {
			t != null && t > 0 ? await h({ s3: e }, t) : (p({ s3: e }), await m());
		},
		async liftHeadTo(e, t) {
			t != null && t > 0 ? await h({ s5: e }, t) : (p({ s5: e }), await m());
		},
		async rotateBodyTo(e, t) {
			t != null && t > 0 ? await h({ s4: e }, t) : (p({ s4: e }), await m());
		},
		async moveTo(e, t) {
			t != null && t > 0 ? await h(e, t) : (p(e), await m());
		},
		get State() {
			return structuredClone(d ?? u);
		},
		set State(e) {
			d = {
				...u,
				...e
			};
		},
		async sendServoState() {
			await m();
		},
		destroy() {
			l.destroy();
		}
	};
}
async function l(e, t) {
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
export { e as BaudRate, t as HomePosition, n as SafeRange, r as ServoSpeed, a as buildDirectPacket, c as openNova, l as runScript };
