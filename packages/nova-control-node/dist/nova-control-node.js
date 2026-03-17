import { SerialPort as e } from "serialport";
//#region src/nova-control-node.ts
var t = 9600, n = Object.freeze({
	s1: 90,
	s2: 90,
	s3: 110,
	s4: 90,
	s5: 95
}), r = Object.freeze({
	s1: [45, 135],
	s2: [10, 170],
	s3: [40, 150],
	s4: [30, 180],
	s5: [20, 150]
}), i = Object.freeze({
	s1: (r.s1[1] - r.s1[0]) / 1e3,
	s2: (r.s2[1] - r.s2[0]) / 1e3,
	s3: (r.s3[1] - r.s3[0]) / 1e3,
	s4: (r.s4[1] - r.s4[0]) / 1e3,
	s5: (r.s5[1] - r.s5[0]) / 1e3
});
function a(e, t) {
	let [n, i] = r[t];
	return Math.max(n, Math.min(i, Math.round(e)));
}
function o(e) {
	return new Uint8Array([
		a(e.s4, "s4"),
		a(e.s3, "s3"),
		a(e.s2, "s2"),
		a(e.s1, "s1"),
		a(e.s5, "s5")
	]);
}
async function s(t, n) {
	let r = new e({
		path: t,
		baudRate: n,
		autoOpen: !1
	});
	return await new Promise((e, t) => {
		r.open((n) => {
			n == null ? e() : t(n);
		});
	}), await new Promise((e) => setTimeout(e, 2e3)), {
		async write(e) {
			await new Promise((t, n) => {
				r.write(Buffer.from(e), (e) => {
					e == null ? t() : n(e);
				});
			}), await new Promise((e, t) => {
				r.drain((n) => {
					n == null ? e() : t(n);
				});
			});
		},
		destroy() {
			r.close();
		}
	};
}
function c(e, t) {
	let n = Math.min(.499, Math.max(0, t)), r = 1 / (1 - n);
	if (e <= n) return r * e * e / (2 * n);
	if (e <= 1 - n) return r * (e - n / 2);
	let i = 1 - e;
	return 1 - r * i * i / (2 * n);
}
async function l(e, r = t, a) {
	let l = a?.StepIntervalMs ?? 20, u = a?.RampRatio ?? .25, d = await s(e, r), f = { ...n }, p, m = Promise.resolve();
	function h(e) {
		p = {
			...p ?? f,
			...e
		};
	}
	async function g() {
		let e = m;
		m = (async () => {
			try {
				await e;
			} catch {}
			for (; p != null;) {
				let e = p, t = !0, n = { ...f };
				for (let r of [
					"s1",
					"s2",
					"s3",
					"s4",
					"s5"
				]) {
					let a = e[r] - f[r], o = l > 0 ? i[r] * l : Infinity;
					Math.abs(a) > o ? (n[r] = f[r] + Math.sign(a) * o, t = !1) : n[r] = e[r];
				}
				t && (p = void 0), f = { ...n }, await d.write(o(n)), t || await new Promise((e) => setTimeout(e, l));
			}
		})(), await m;
	}
	async function _(e, t) {
		let n = m;
		m = (async () => {
			try {
				await n;
			} catch {}
			let r = { ...f }, i = l > 0 ? Math.max(1, Math.round(t / l)) : 1;
			p = void 0;
			for (let t = 1; t <= i; t++) {
				let n = c(t / i, u), a = { ...f };
				for (let t of Object.keys(e)) a[t] = Math.round(r[t] + (e[t] - r[t]) * n);
				f = a, await d.write(o(a)), t < i && await new Promise((e) => setTimeout(e, l));
			}
		})(), await m;
	}
	return {
		async home(e) {
			e != null && e > 0 ? await _({ ...n }, e) : (h({ ...n }), await g());
		},
		async shiftHeadTo(e, t) {
			t != null && t > 0 ? await _({ s1: e }, t) : (h({ s1: e }), await g());
		},
		async rollHeadTo(e, t) {
			t != null && t > 0 ? await _({ s2: e }, t) : (h({ s2: e }), await g());
		},
		async pitchHeadTo(e, t) {
			t != null && t > 0 ? await _({ s3: e }, t) : (h({ s3: e }), await g());
		},
		async liftHeadTo(e, t) {
			t != null && t > 0 ? await _({ s5: e }, t) : (h({ s5: e }), await g());
		},
		async rotateBodyTo(e, t) {
			t != null && t > 0 ? await _({ s4: e }, t) : (h({ s4: e }), await g());
		},
		async moveTo(e, t) {
			t != null && t > 0 ? await _(e, t) : (h(e), await g());
		},
		get State() {
			return structuredClone(p ?? f);
		},
		set State(e) {
			p = {
				...f,
				...e
			};
		},
		async sendServoState() {
			await g();
		},
		destroy() {
			d.destroy();
		}
	};
}
async function u(e, t) {
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
export { t as BaudRate, n as HomePosition, r as SafeRange, i as ServoSpeed, o as buildDirectPacket, l as openNova, u as runScript };
