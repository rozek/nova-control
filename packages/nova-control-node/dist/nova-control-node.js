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
async function c(e, r = t, a) {
	let c = a?.StepIntervalMs ?? 20, l = await s(e, r), u = { ...n }, d, f = Promise.resolve();
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
				for (let r of [
					"s1",
					"s2",
					"s3",
					"s4",
					"s5"
				]) {
					let a = e[r] - u[r], o = c > 0 ? i[r] * c : Infinity;
					Math.abs(a) > o ? (n[r] = u[r] + Math.sign(a) * o, t = !1) : n[r] = e[r];
				}
				t && (d = void 0), u = { ...n }, await l.write(o(n)), t || await new Promise((e) => setTimeout(e, c));
			}
		})(), await f;
	}
	return {
		async home() {
			p({ ...n }), await m();
		},
		async shiftHeadTo(e) {
			p({ s1: e }), await m();
		},
		async rollHeadTo(e) {
			p({ s2: e }), await m();
		},
		async pitchHeadTo(e) {
			p({ s3: e }), await m();
		},
		async liftHeadTo(e) {
			p({ s5: e }), await m();
		},
		async rotateBodyTo(e) {
			p({ s4: e }), await m();
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
//#endregion
export { t as BaudRate, n as HomePosition, r as SafeRange, i as ServoSpeed, o as buildDirectPacket, c as openNova };
