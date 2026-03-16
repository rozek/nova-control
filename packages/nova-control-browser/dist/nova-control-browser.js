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
async function s(e, n) {
	let i = n?.StepIntervalMs ?? 20, s = await o(e), c = { ...t }, l, u = Promise.resolve();
	function d(e) {
		l = {
			...l ?? c,
			...e
		};
	}
	async function f() {
		let e = u;
		u = (async () => {
			try {
				await e;
			} catch {}
			for (; l != null;) {
				let e = l, t = !0, n = { ...c };
				for (let a of [
					"s1",
					"s2",
					"s3",
					"s4",
					"s5"
				]) {
					let o = e[a] - c[a], s = i > 0 ? r[a] * i : Infinity;
					Math.abs(o) > s ? (n[a] = c[a] + Math.sign(o) * s, t = !1) : n[a] = e[a];
				}
				t && (l = void 0), c = { ...n }, await s.write(a(n)), t || await new Promise((e) => setTimeout(e, i));
			}
		})(), await u;
	}
	return {
		async home() {
			d({ ...t }), await f();
		},
		async shiftHeadTo(e) {
			d({ s1: e }), await f();
		},
		async rollHeadTo(e) {
			d({ s2: e }), await f();
		},
		async pitchHeadTo(e) {
			d({ s3: e }), await f();
		},
		async liftHeadTo(e) {
			d({ s5: e }), await f();
		},
		async rotateBodyTo(e) {
			d({ s4: e }), await f();
		},
		get State() {
			return structuredClone(l ?? c);
		},
		set State(e) {
			l = {
				...c,
				...e
			};
		},
		async sendServoState() {
			await f();
		},
		destroy() {
			s.destroy();
		}
	};
}
//#endregion
export { e as BaudRate, t as HomePosition, n as SafeRange, r as ServoSpeed, a as buildDirectPacket, s as openNova };
