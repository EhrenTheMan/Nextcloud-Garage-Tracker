(function (root, factory) {
	if (typeof module === 'object' && module.exports) {
		module.exports = factory();
	} else {
		root.AutoTrackerEconomy = factory();
	}
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
	'use strict';

	function calculate(entries, units) {
		const sorted = entries.slice().sort((a, b) =>
			a.date.localeCompare(b.date) || Number(a.odometer) - Number(b.odometer));
		const results = {};
		let previousFull = null;
		let lastOdometer = null;
		let volume = 0;
		for (const entry of sorted) {
			const odometer = Number(entry.odometer);
			const amount = Number(entry.volume);
			if (!Number.isFinite(odometer) || !Number.isFinite(amount) || amount <= 0 ||
				entry.odometer === '' || entry.date === '') {
				previousFull = null;
				lastOdometer = null;
				volume = 0;
				continue;
			}
			if (lastOdometer !== null && odometer < lastOdometer) {
				previousFull = null;
				volume = 0;
			}
			if (previousFull !== null) volume += amount;
			if (entry.full === 'yes') {
				if (previousFull !== null && odometer > previousFull && volume > 0) {
					const distance = odometer - previousFull;
					results[entry.id] = units === 'metric' ? 100 * volume / distance : distance / volume;
				}
				previousFull = odometer;
				volume = 0;
			}
			lastOdometer = odometer;
		}
		return results;
	}

	return { calculate };
});
