let cfg = {
	frequency: 100,
}
function potential(charge, distance) {
	return (Math.cos(cfg.frequency * distance) * charge) / (4 * Math.PI * distance)
}
function delta_potential(charge, x, w) {
  return charge * (w * x * Math.sin(w * x) + Math.cos(w * x)) / (4. * Math.PI * x * x);
}
function distance_delta_potential(charge, dx, dy) {
	return delta_potential(charge, (dx ** 2 + dy ** 2)**0.5, cfg.frequency)
}
function new_charge() {
	return {
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		q: 0,
	}
}
let pots = []
function set_potential_at(x, y, v) {
	while (pots.length <= x) {
		pots.push([])
	}
	while (pots[x].length <= y) {
		pots[x].push(0)
	}
	pots[x][y] = v
}
let charges = [
]

function push(q1, q2, dt) {
	let p = distance_delta_potential(q1.q * q2.q, q1.x - q2.x, q1.y - q2.y);
	if (p == Number("Infinity") || p == Number("-Infinity")) {
		// :(
		return;
	}
	let theta = Math.atan2((q2.y - q1.y), (q2.x - q1.x))
	// F = ma, and integral a*dt = v, thus, v = integral (F/m dt)
	q1.vx += Math.sin(theta) * p * dt / q1.m
	q1.vy += Math.cos(theta) * p * dt / q1.m
}
function tick(q, dt) {
	q.x += q.vx * dt
	q.y += q.vy * dt
}

function push_all(dt) {
	for (var i = 0; i < charges.length; i++) {
		if (cfg.edge) {
			let right = cfg.scaleY * 0.9
			let left = cfg.scaleY * 0.1
			let top = cfg.scaleX * 0.1
			let bottom = cfg.scaleX * 0.9
			if (charges[i].x > right) {
				charges[i].vx -= Math.log(1 + Math.abs(charges[i].x - right))
			}
			if (charges[i].x < left) {
				charges[i].vx += Math.log(1 + Math.abs(charges[i].x - left))
			}
			if (charges[i].y > bottom) {
				charges[i].vy -= Math.log(1 + Math.abs(charges[i].y - bottom))
			}
			if (charges[i].y < top) {
				charges[i].vy += Math.log(1 + Math.abs(charges[i].y - top))
			}
		}
		for (var j = 0; j < charges.length; j++) {
			if (i != j) {
				push(charges[i], charges[j], dt)
			}
		}	
	}
}
function tick_all(dt) {
	for (var i = 0; i < charges.length; i++) {
		tick(charges[i], dt)
	}
}

function recalc(data) {
	let width = data.width;
	let height = data.height;
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < height; y++) {
			let x_1 = x
			let y_1 = y
			var p = 0
			for (charge of charges) {
				let x_2 = x_1 - charge.x
				let y_2 = y_1 - charge.y
				r = (x_2 ** 2 + y_2 ** 2)**0.5
				p += potential(charge.q, r)
			}
			set_potential_at(x, y, p)
		}
	}
}
onmessage = function(e) {
	for (a of ["scaleX", "scaleY", "particle_charge", "particle_mass", "frequency", "speed_factor", "delay_interval", "edge"]) {
		if (e.data[a] !== undefined) {
			cfg[a] = e.data[a]
		}
	}
	if (e.data.scaleX) {
		scaleX = e.data.scaleY
	}
	if (e.data.scaleY) {
		scaleY = e.data.scaleY
	}
	if (e.data.action == "recalc") {
		recalc(e.data)
	} else if (e.data.action == "tick") {
		push_all(e.data.dt)
		tick_all(e.data.dt)
	} else if (e.data.action == "add") {
		e.data.charge.id = charges.length
		charges.push(e.data.charge)
	} else if (e.data.action == "change") {
		charges[e.data.charge.id] = e.data.charge
	}
	postMessage({ pots: pots, charges: charges })
}