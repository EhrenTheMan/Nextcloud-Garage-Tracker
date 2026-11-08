(function () {
	'use strict';

	const root = document.getElementById('auto-tracker');
	const base = OC.generateUrl('/apps/auto_tracker');
	const state = { vehicles: [], selected: null, tab: 'overview', busy: false };
	const categories = {
		specs: { label: 'Specifications', singular: 'specification', fields: [
			['name', 'Specification', 'text', true], ['value', 'Value', 'text', true],
		] },
		mods: { label: 'Modifications', singular: 'modification', fields: [
			['date', 'Date', 'date'], ['title', 'Modification', 'text', true], ['odometer', 'Odometer', 'number'], ['cost', 'Cost', 'number'], ['notes', 'Notes', 'textarea'],
		] },
		fuel: { label: 'Fuel', singular: 'fill-up', fields: [
			['date', 'Date', 'date', true], ['odometer', 'Odometer', 'number', true], ['volume', 'Fuel volume', 'number', true], ['cost', 'Total cost', 'number'], ['full', 'Full tank?', 'select', true, ['yes', 'no']], ['notes', 'Notes', 'textarea'],
		] },
		service: { label: 'Maintenance', singular: 'service record', fields: [
			['date', 'Date', 'date'], ['title', 'Service', 'text', true], ['odometer', 'Odometer', 'number'], ['cost', 'Cost', 'number'], ['notes', 'Notes', 'textarea'],
		] },
		issues: { label: 'Issues', singular: 'issue', fields: [
			['date', 'Date noticed', 'date'], ['title', 'Issue', 'text', true], ['status', 'Status', 'select', true, ['open', 'monitoring', 'resolved']], ['odometer', 'Odometer', 'number'], ['cost', 'Actual cost', 'number'], ['notes', 'Notes', 'textarea'],
		] },
		plans: { label: 'Plans', singular: 'plan', fields: [
			['date', 'Target date', 'date'], ['title', 'Plan', 'text', true], ['kind', 'Type', 'select', true, ['modification', 'repair', 'maintenance', 'other']], ['status', 'Status', 'select', true, ['planned', 'in progress', 'done', 'cancelled']], ['cost', 'Estimated cost', 'number'], ['notes', 'Notes', 'textarea'],
		] },
	};
	const profileFields = [
		['name', 'Vehicle name', 'text', true], ['year', 'Year', 'text'], ['make', 'Make', 'text'], ['model', 'Model', 'text'], ['vin', 'VIN', 'text'],
		['units', 'Units', 'select', true, ['us', 'metric']], ['currency', 'Currency code (e.g. USD)', 'text', true], ['notes', 'Notes', 'textarea'],
	];
	const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	const uid = () => crypto.randomUUID();
	const selected = () => state.vehicles.find(v => v.id === state.selected);
	const emptyVehicle = () => ({ name: '', year: '', make: '', model: '', vin: '', units: 'us', currency: 'USD', notes: '', specs: [], mods: [], fuel: [], service: [], issues: [], plans: [], photos: [] });
	const button = (label, action, attrs = '') => `<button type="button" data-action="${action}" ${attrs}>${esc(label)}</button>`;
	const today = () => new Date().toLocaleDateString('en-CA');
	const money = (value, currency) => value === '' ? '—' : `${esc(currency)} ${Number(value).toFixed(2)}`;

	async function request(path, options = {}) {
		const response = await fetch(base + path, {
			...options,
			headers: { 'Content-Type': 'application/json', requesttoken: OC.requestToken, ...options.headers },
		});
		const body = await response.json().catch(() => null);
		if (!response.ok) throw new Error(body?.error || `Request failed (${response.status}).`);
		return body;
	}

	function notice(message, error = false) {
		const area = root.querySelector('.at-notice');
		if (area) {
			area.textContent = message;
			area.className = `at-notice${error ? ' at-error' : ''}`;
		}
	}

	async function load() {
		try {
			state.vehicles = await request('/vehicles');
			if (!state.vehicles.some(v => v.id === state.selected)) state.selected = state.vehicles[0]?.id ?? null;
			render();
		} catch (error) {
			root.innerHTML = `<p class="at-error" role="alert">${esc(error.message)}</p>${button('Retry', 'reload')}`;
		}
	}

	function render() {
		const vehicle = selected();
		const sidebar = state.vehicles.map(v => `<button type="button" class="at-vehicle ${v.id === state.selected ? 'active' : ''}" data-action="select" data-id="${v.id}">${esc(v.data.name)}</button>`).join('');
		root.innerHTML = `<div class="at-layout"><aside class="at-sidebar"><h1>Auto Tracker</h1>${button('+ Add vehicle', 'add-vehicle', 'class="primary"')}<div class="at-vehicle-list">${sidebar || '<p>No vehicles yet.</p>'}</div></aside>
			<main class="at-main"><div class="at-notice" role="status" aria-live="polite"></div>${vehicle ? renderVehicle(vehicle) : '<div class="at-empty"><h2>Your garage is empty</h2><p>Add a vehicle to start tracking its history, specifications, and costs.</p></div>'}</main></div>
			<dialog class="at-dialog"><div class="at-dialog-content"></div></dialog>`;
	}

	function renderVehicle(vehicle) {
		const data = vehicle.data;
		const tabs = [['overview', 'Overview'], ...Object.entries(categories).map(([k, v]) => [k, v.label]), ['photos', 'Photos']];
		return `<header class="at-header"><div><h2>${esc(data.name)}</h2><p>${esc([data.year, data.make, data.model].filter(Boolean).join(' '))}</p></div><div class="at-actions">${button('Edit vehicle', 'edit-vehicle')}${button('Delete vehicle', 'delete-vehicle', 'class="at-danger"')}</div></header>
			<nav class="at-tabs" aria-label="Vehicle sections">${tabs.map(([key, label]) => button(label, 'tab', `data-tab="${key}" class="${state.tab === key ? 'active' : ''}" ${state.tab === key ? 'aria-current="page"' : ''}`)).join('')}</nav>
			<section class="at-content">${state.tab === 'overview' ? renderOverview(data) : state.tab === 'photos' ? renderPhotos(data) : renderRecords(data, state.tab)}</section>`;
	}

	function renderOverview(data) {
		const costs = group => data[group].reduce((sum, item) => sum + (item.cost === '' ? 0 : Number(item.cost)), 0);
		const currency = data.currency;
		const full = data.fuel.filter(f => f.full === 'yes').length;
		return `<h3>Overview</h3><div class="at-cards">
			<div><strong>${money(costs('fuel'), currency)}</strong><span>Fuel spent</span></div>
			<div><strong>${money(costs('mods'), currency)}</strong><span>Modifications spent</span></div>
			<div><strong>${money(costs('service'), currency)}</strong><span>Maintenance spent</span></div>
			<div><strong>${money(costs('issues'), currency)}</strong><span>Issue costs</span></div>
			<div><strong>${money(costs('plans'), currency)}</strong><span>Planned estimates</span></div>
			<div><strong>${data.issues.filter(i => i.status !== 'resolved').length}</strong><span>Open / monitoring issues</span></div>
		</div><dl class="at-details"><dt>VIN</dt><dd>${esc(data.vin || '—')}</dd><dt>Units</dt><dd>${data.units === 'us' ? 'Miles, gallons, MPG' : 'Kilometers, liters, L/100 km'}</dd><dt>Currency</dt><dd>${esc(currency)}</dd><dt>Notes</dt><dd>${esc(data.notes || '—')}</dd></dl>
		<p class="at-help">Fuel economy is calculated between consecutive full tanks, including any partial fill-ups between them. ${full < 2 ? 'Add at least two full tanks to see an economy result.' : ''}</p>
		<p class="at-help">Costs are summed as entered; planned estimates are separate. Avoid recording the same expense in more than one category.</p>`;
	}

	function renderRecords(data, group) {
		const config = categories[group];
		const entries = data[group];
		const economy = group === 'fuel' ? AutoTrackerEconomy.calculate(entries, data.units) : {};
		const fields = config.fields.filter(field => field[0] !== 'notes');
		const headings = fields.map(field => `<th scope="col">${esc(fieldLabel(field[0], field[1], data))}</th>`).join('');
		const rows = entries.map(entry => `<tr>${fields.map(([key]) => {
			let value = entry[key] || '—';
			if (key === 'cost') value = money(entry[key], data.currency);
			else value = esc(value);
			return `<td>${value}</td>`;
		}).join('')}${group === 'fuel' ? `<td>${economy[entry.id] === undefined ? '—' : economy[entry.id].toFixed(2)}</td>` : ''}<td class="at-row-actions">${button('Edit', 'edit-entry', `data-group="${group}" data-id="${esc(entry.id)}"`)}${button('Delete', 'delete-entry', `data-group="${group}" data-id="${esc(entry.id)}"`)}</td></tr>${entry.notes ? `<tr class="at-notes"><td colspan="${fields.length + (group === 'fuel' ? 2 : 1)}">${esc(entry.notes)}</td></tr>` : ''}`).join('');
		return `<div class="at-section-header"><h3>${esc(config.label)}</h3>${button(`+ Add ${config.singular}`, 'add-entry', `data-group="${group}" class="primary"`)}</div>
			${group === 'fuel' ? '<p class="at-help">Mark partial fill-ups as “no”. Economy appears at the next full tank; the first full tank is a baseline. Odometer decreases reset the baseline.</p>' : ''}
			${entries.length ? `<div class="at-table-wrap"><table><thead><tr>${headings}${group === 'fuel' ? `<th scope="col">${data.units === 'us' ? 'MPG' : 'L/100 km'}</th>` : ''}<th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p>No ${esc(config.label.toLowerCase())} recorded yet.</p>`}`;
	}

	function renderPhotos(data) {
		const images = data.photos.map(photo => `<figure><img src="${esc(OC.generateUrl('/core/preview') + '?fileId=' + encodeURIComponent(photo.fileId) + '&x=600&y=600')}" alt="${esc(photo.name)}" loading="lazy"><figcaption>${esc(photo.name)}</figcaption>${button('Remove link', 'delete-photo', `data-id="${esc(photo.id)}"`)}</figure>`).join('');
		return `<div class="at-section-header"><h3>Photos</h3>${button('+ Link photos from Files', 'photos', 'class="primary"')}</div><p class="at-help">Photos stay in their existing Files locations. Removing a link does not delete the file. If a file is deleted or access is removed, its preview will no longer be available.</p><div class="at-photos">${images || '<p>No photos linked yet.</p>'}</div>`;
	}

	function fieldLabel(key, label, data) {
		if (key === 'odometer') return `Odometer (${data.units === 'us' ? 'mi' : 'km'})`;
		if (key === 'volume') return `Fuel (${data.units === 'us' ? 'gal' : 'L'})`;
		if (key === 'cost') return `${label} (${data.currency})`;
		return label;
	}

	function formFields(fields, values, data) {
		return fields.map(([key, label, type, required, options]) => {
			const value = values[key] ?? '';
			const common = `name="${key}" id="at-field-${key}" ${required ? 'required' : ''}`;
			let control;
			if (type === 'select') control = `<select ${common}>${options.map(option => `<option value="${esc(option)}" ${value === option ? 'selected' : ''}>${esc(option === 'us' ? 'US (miles, gallons, MPG)' : option === 'metric' ? 'Metric (km, liters, L/100 km)' : option)}</option>`).join('')}</select>`;
			else if (type === 'textarea') control = `<textarea ${common} maxlength="10000">${esc(value)}</textarea>`;
			else control = `<input ${common} type="${type}" value="${esc(value)}" ${type === 'number' ? `min="${key === 'volume' ? '0.000001' : '0'}" step="any"` : ''} ${key === 'currency' ? 'pattern="[A-Z]{3}" maxlength="3"' : ''} ${type === 'text' && key !== 'currency' ? 'maxlength="10000"' : ''}>`;
			return `<label for="at-field-${key}">${esc(fieldLabel(key, label, data))}${required ? ' *' : ''}${control}</label>`;
		}).join('');
	}

	function dialog(html) {
		const element = root.querySelector('.at-dialog');
		element.querySelector('.at-dialog-content').innerHTML = html;
		element.showModal();
	}
	function closeDialog() { root.querySelector('.at-dialog').close(); }

	function openVehicleForm(vehicle) {
		const data = vehicle ? vehicle.data : emptyVehicle();
		dialog(`<h3>${vehicle ? 'Edit vehicle' : 'Add vehicle'}</h3><form id="at-form" data-form="vehicle"><div class="at-form-grid">${formFields(profileFields, data, data)}</div><p class="at-help">Units and currency cannot be changed after related records are added. Create a separate vehicle if you need a different unit or currency history.</p><div class="at-actions"><button type="submit" class="primary">Save</button>${button('Cancel', 'close')}</div></form>`);
	}

	function openEntryForm(group, id) {
		const data = selected().data;
		const config = categories[group];
		const existing = id ? data[group].find(item => item.id === id) : null;
		const defaults = { date: today(), full: 'yes', status: group === 'issues' ? 'open' : 'planned', kind: 'modification' };
		const values = existing || defaults;
		dialog(`<h3>${existing ? 'Edit' : 'Add'} ${esc(config.singular)}</h3><form id="at-form" data-form="entry" data-group="${group}" data-id="${esc(id || '')}"><div class="at-form-grid">${formFields(config.fields, values, data)}</div><div class="at-actions"><button type="submit" class="primary">Save</button>${button('Cancel', 'close')}</div></form>`);
	}

	async function saveVehicle(data, vehicle = selected()) {
		if (state.busy) throw new Error('A save is already in progress.');
		state.busy = true;
		try {
			const saved = vehicle
				? await request(`/vehicles/${vehicle.id}`, { method: 'PUT', body: JSON.stringify({ revision: vehicle.revision, data }) })
				: await request('/vehicles', { method: 'POST', body: JSON.stringify({ data }) });
			const index = state.vehicles.findIndex(v => v.id === saved.id);
			if (index < 0) state.vehicles.push(saved); else state.vehicles[index] = saved;
			state.selected = saved.id;
		} finally { state.busy = false; }
	}

	async function submitForm(form) {
		const values = Object.fromEntries(new FormData(form).entries());
		const vehicle = selected();
		if (form.dataset.form === 'vehicle') {
			const editing = form.dataset.editing === 'yes';
			const original = editing ? vehicle.data : emptyVehicle();
			if (editing && values.units !== original.units && ['fuel', 'mods', 'service', 'issues'].some(group => original[group].some(item => item.odometer !== ''))) throw new Error('Units cannot be changed while odometer or fuel records exist.');
			if (editing && values.currency !== original.currency && ['fuel', 'mods', 'service', 'issues', 'plans'].some(group => original[group].some(item => item.cost !== ''))) throw new Error('Currency cannot be changed while cost records exist.');
			await saveVehicle({ ...original, ...values }, editing ? vehicle : null);
		} else {
			const group = form.dataset.group;
			const data = structuredClone(vehicle.data);
			const entry = { ...values, id: form.dataset.id || uid() };
			const index = data[group].findIndex(item => item.id === entry.id);
			if (index < 0) data[group].push(entry); else data[group][index] = entry;
			await saveVehicle(data);
		}
		closeDialog();
		render();
		notice('Saved.');
	}

	async function browsePhotos(folder = 0, trail = []) {
		dialog('<h3>Choose photos from Files</h3><p>Loading...</p>');
		try {
			const entries = await request(`/files?folder=${folder}`);
			const current = selected().data.photos;
			const folders = entries.filter(entry => entry.folder);
			const images = entries.filter(entry => !entry.folder);
			const crumbs = [{ id: 0, name: 'Files' }, ...trail];
			const content = `<h3>Choose photos from Files</h3><p class="at-help">Select photos to link. Existing links remain in place.</p><div class="at-breadcrumbs">${crumbs.map((crumb, index) => button(crumb.name, 'browse-crumb', `data-index="${index}"`)).join(' / ')}</div>
				<div class="at-picker-folders">${folders.map(item => button(`📁 ${item.name}`, 'browse-folder', `data-id="${item.id}" data-name="${esc(item.name)}"`)).join('')}</div>
				<form id="at-form" data-form="photos"><div class="at-picker-images">${images.map(item => `<label><input type="checkbox" name="file" value="${item.id}" data-name="${esc(item.name)}" ${current.some(photo => photo.fileId === String(item.id)) ? 'disabled checked' : ''}><img loading="lazy" src="${esc(OC.generateUrl('/core/preview') + '?fileId=' + item.id + '&x=150&y=150')}" alt=""><span>${esc(item.name)}</span></label>`).join('') || '<p>No images in this folder.</p>'}</div><div class="at-actions"><button type="submit" class="primary">Link selected photos</button>${button('Cancel', 'close')}</div></form>`;
			const element = root.querySelector('.at-dialog');
			element.querySelector('.at-dialog-content').innerHTML = content;
			element._trail = trail;
		} catch (error) {
			root.querySelector('.at-dialog-content').innerHTML = `<h3>Choose photos from Files</h3><p class="at-error">${esc(error.message)}</p>${button('Close', 'close')}`;
		}
	}

	root.addEventListener('submit', async event => {
		if (event.target.id !== 'at-form') return;
		event.preventDefault();
		const form = event.target;
		if (state.busy) return;
		const submit = form.querySelector('[type=submit]');
		submit.disabled = true;
		try {
			if (form.dataset.form === 'photos') {
				const data = structuredClone(selected().data);
				form.querySelectorAll('input[name=file]:checked:not(:disabled)').forEach(input => data.photos.push({ id: uid(), fileId: input.value, name: input.dataset.name }));
				await saveVehicle(data);
				closeDialog(); render(); notice('Photos linked.');
			} else {
				await submitForm(form);
			}
		} catch (error) {
			let errorNode = form.querySelector('.at-form-error');
			if (!errorNode) { errorNode = document.createElement('p'); errorNode.className = 'at-error at-form-error'; errorNode.setAttribute('role', 'alert'); form.prepend(errorNode); }
			errorNode.textContent = error.message;
		} finally { submit.disabled = false; }
	});

	root.addEventListener('click', async event => {
		const target = event.target.closest('[data-action]');
		if (!target || state.busy) return;
		const { action, id, group, tab } = target.dataset;
		try {
			switch (action) {
				case 'reload': await load(); break;
				case 'select': state.selected = Number(id); state.tab = 'overview'; render(); break;
				case 'tab': state.tab = tab; render(); break;
				case 'add-vehicle': openVehicleForm(null); break;
				case 'edit-vehicle': openVehicleForm(selected()); root.querySelector('#at-form').dataset.editing = 'yes'; break;
				case 'close': closeDialog(); break;
				case 'add-entry': openEntryForm(group); break;
				case 'edit-entry': openEntryForm(group, id); break;
				case 'delete-vehicle': {
					const vehicle = selected();
					if (!confirm(`Delete ${vehicle.data.name} and all its records? Linked files will not be deleted.`)) break;
					state.busy = true;
					try { await request(`/vehicles/${vehicle.id}`, { method: 'DELETE', body: JSON.stringify({ revision: vehicle.revision }) }); }
					finally { state.busy = false; }
					state.vehicles = state.vehicles.filter(v => v.id !== vehicle.id);
					state.selected = state.vehicles[0]?.id ?? null; state.tab = 'overview'; render(); notice('Vehicle deleted.'); break;
				}
				case 'delete-entry':
				case 'delete-photo': {
					if (!confirm(action === 'delete-photo' ? 'Remove this photo link? The file will not be deleted.' : 'Delete this record?')) break;
					const data = structuredClone(selected().data);
					const key = action === 'delete-photo' ? 'photos' : group;
					data[key] = data[key].filter(item => item.id !== id);
					await saveVehicle(data); render(); notice('Removed.'); break;
				}
				case 'photos': await browsePhotos(); break;
				case 'browse-folder': {
					const trail = root.querySelector('.at-dialog')._trail;
					closeDialog(); await browsePhotos(Number(id), [...trail, { id: Number(id), name: target.dataset.name }]); break;
				}
				case 'browse-crumb': {
					const trail = root.querySelector('.at-dialog')._trail.slice(0, Number(target.dataset.index));
					closeDialog(); await browsePhotos(trail.at(-1)?.id ?? 0, trail); break;
				}
			}
		} catch (error) { notice(error.message, true); }
	});

	load();
})();
