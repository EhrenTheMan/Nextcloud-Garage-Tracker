const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate } = require('../js/economy.js');

const fill = (id, date, odometer, volume, full = 'yes') => ({
	id, date, odometer: String(odometer), volume: String(volume), full,
});

test('US economy uses fuel after the baseline and includes partial fills', () => {
	const records = [
		fill('c', '2026-03-01', 1300, 7),
		fill('a', '2026-01-01', 1000, 12),
		fill('b', '2026-02-01', 1100, 3, 'no'),
	];
	assert.deepEqual(calculate(records, 'us'), { c: 30 });
	assert.equal(records[0].id, 'c');
});

test('metric economy uses liters per 100 km', () => {
	assert.deepEqual(calculate([fill('a', '2026-01-01', 1000, 40), fill('b', '2026-02-01', 1500, 35)], 'metric'), { b: 7 });
});

test('requires a full baseline and resets if the odometer decreases', () => {
	const records = [
		fill('a', '2026-01-01', 500, 10, 'no'),
		fill('b', '2026-01-02', 600, 10),
		fill('c', '2026-01-03', 100, 4, 'no'),
		fill('d', '2026-01-04', 200, 8),
		fill('e', '2026-01-05', 400, 10),
	];
	assert.deepEqual(calculate(records, 'us'), { e: 20 });
});

test('same-day fills are ordered by odometer and zero distance is not reported', () => {
	const records = [fill('c', '2026-01-01', 200, 5), fill('b', '2026-01-01', 100, 5), fill('a', '2026-01-01', 100, 5)];
	const results = calculate(records, 'us');
	assert.equal(Object.keys(results).length, 1);
	assert.equal(results.c, 20);
});

test('invalid fuel interrupts the interval rather than producing a misleading result', () => {
	assert.deepEqual(calculate([fill('a', '2026-01-01', 100, 10), fill('b', '2026-01-02', 150, 0, 'no'), fill('c', '2026-01-03', 200, 10)], 'us'), {});
});
