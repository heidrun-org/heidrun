import type { FolderActivityReportData } from './folder_activity_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ReportBuilder — creates a folder activity animation
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Creates the self-contained animated folder view for a report. */
export class ReportBuilder {
	/**
	 * Builds a page that shows folders as animated circles on a ten-minute timeline.
	 * @param reportData The selected workspace, time range, and grouped activity.
	 * @returns A complete HTML document with inline styles and activity data.
	 */
	static build(reportData: FolderActivityReportData): string {
		const data = JSON.stringify(reportData).replaceAll('</script', '<\\/script');
		return /* html */`<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Work by folder over time</title>
	<style>
		:root {
			color-scheme: dark;
			font-family: "Avenir Next", Avenir, "Segoe UI", sans-serif;
			background: #101a19;
			color: #edf0e5;
			font-synthesis: none;
			text-rendering: optimizeLegibility;
			--field: #101a19;
			--soft-text: #94a59a;
			--mint: #74d6b0;
			--amber: #f3bf69;
			--coral: #fa7e70;
		}
		* { box-sizing: border-box; }
		body { min-width: 320px; min-height: 100vh; margin: 0; }
		button, input, select { font: inherit; }
		button { color: inherit; }
		button:focus-visible, input:focus-visible, select:focus-visible {
			outline: 2px solid var(--mint);
			outline-offset: 4px;
		}
		.app-shell {
			min-height: 100vh;
			padding: 24px clamp(18px, 4vw, 64px) 190px;
			background:
				radial-gradient(ellipse at 50% 46%, rgba(46, 81, 68, .24), transparent 58%),
				var(--field);
		}
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 24px;
			min-height: 44px;
		}
		.brand { display: flex; align-items: center; gap: 12px; color: #d6e2d5; font-size: 14px; font-weight: 650; }
		.brand-mark { width: 10px; height: 10px; border-radius: 50%; background: var(--mint); box-shadow: 0 0 18px rgba(116, 214, 176, .7); }
		.workspace-note { max-width: 55%; overflow: hidden; color: #9caea2; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
		main { width: min(1120px, 100%); margin: 0 auto; }
		.location { margin: 46px 0 0; }
		.location h1 { margin: 0; font-size: clamp(25px, 3.5vw, 38px); font-weight: 560; letter-spacing: -.04em; }
		.crumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
		.crumb { padding: 0; border: 0; background: transparent; color: #a7b6a8; cursor: pointer; }
		.crumb[aria-current="page"] { color: #edf0e5; cursor: default; }
		.slash { color: #64736a; font-size: .75em; }
		.location p { margin: 10px 0 0; color: var(--soft-text); font-size: 14px; }
		.activity-stamp { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; margin-top: 28px; padding-bottom: 12px; border-bottom: 1px solid rgba(184, 206, 187, .12); }
		.activity-stamp strong { font-size: 16px; font-weight: 550; }
		.activity-stamp span { color: var(--soft-text); font-size: 13px; }
		.orb-field {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			grid-auto-rows: 220px;
			align-items: center;
			gap: 12px;
			min-height: 410px;
			padding: 44px 8px 32px;
		}
		.folder-node { display: grid; place-items: center; height: 220px; }
		.folder-orb {
			--orb-color: var(--mint);
			--orb-size: 148px;
			--glow: 7px;
			--pulse-time: 3.8s;
			display: grid;
			place-items: center;
			position: relative;
			width: var(--orb-size);
			max-width: 100%;
			aspect-ratio: 1;
			padding: 12px;
			border: 1px solid color-mix(in srgb, var(--orb-color) 45%, transparent);
			border-radius: 50%;
			background: radial-gradient(circle at 37% 31%, color-mix(in srgb, var(--orb-color) 28%, #23312c), #17211f 68%);
			box-shadow: 0 0 var(--glow) color-mix(in srgb, var(--orb-color) 26%, transparent), inset 0 0 26px color-mix(in srgb, var(--orb-color) 10%, transparent);
			text-align: center;
			cursor: pointer;
			animation: folder-breathe var(--pulse-time) ease-in-out infinite;
			animation-play-state: paused;
			transition: width .45s ease, border-color .45s ease, box-shadow .45s ease, background .45s ease, filter .45s ease;
		}
		.playing .folder-orb { animation-play-state: running; }
		.folder-orb:hover { border-color: var(--orb-color); }
		.folder-orb:focus-visible { outline-offset: 8px; }
		.folder-orb[data-level="idle"] { --orb-color: #63736b; --glow: 0px; filter: saturate(.45); }
		.folder-orb[data-level="quiet"] { --orb-color: var(--mint); }
		.folder-orb[data-level="steady"] { --orb-color: var(--amber); }
		.folder-orb[data-level="busy"] { --orb-color: var(--coral); }
		.folder-orb__name { max-width: 100%; overflow-wrap: anywhere; font-size: 15px; font-weight: 570; letter-spacing: -.025em; }
		.folder-orb__detail { margin-top: 7px; color: #b8c4b7; font-size: 12px; }
		.folder-orb__hint { position: absolute; bottom: 22px; color: color-mix(in srgb, var(--orb-color) 82%, white); font-size: 10px; opacity: .82; }
		@keyframes folder-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
		.empty-folders { max-width: 460px; color: var(--soft-text); text-align: center; line-height: 1.6; }
		.timeline { position: fixed; z-index: 5; right: 0; bottom: 0; left: 0; padding: 18px clamp(18px, 4vw, 64px) 22px; border-top: 1px solid rgba(184, 206, 187, .13); background: rgba(16, 26, 25, .94); backdrop-filter: blur(18px); }
		.timeline-inner { width: min(1120px, 100%); margin: 0 auto; }
		.timeline-readout { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 9px; }
		.timeline-date { font-variant-numeric: tabular-nums; font-size: 14px; }
		.timeline-range { color: var(--soft-text); font-size: 12px; }
		.scrubber { display: block; width: 100%; margin: 0; accent-color: var(--mint); cursor: ew-resize; }
		.controls { display: flex; align-items: center; gap: 9px; margin-top: 13px; }
		.control { min-height: 36px; padding: 0 13px; border: 1px solid #405149; border-radius: 7px; background: #1a2825; font-size: 12px; cursor: pointer; transition: background .15s ease, border-color .15s ease; }
		.control:hover { border-color: #7fa994; background: #243631; }
		.control-main { border-color: #91d7b7; background: #c0ebd1; color: #13231d; font-weight: 650; }
		.control-main:hover { border-color: #c8f1d8; background: #d5f4df; }
		.control:disabled { color: #708077; cursor: default; }
		.speed-label { margin-left: auto; color: var(--soft-text); font-size: 12px; }
		.speed { min-height: 36px; padding: 0 30px 0 10px; border: 1px solid #405149; border-radius: 7px; background: #1a2825; color: inherit; }
		.loop-option { display: flex; align-items: center; gap: 7px; color: var(--soft-text); font-size: 12px; cursor: pointer; }
		.loop-option input { accent-color: var(--mint); }
		@media (max-width: 660px) {
			.app-shell { padding-bottom: 215px; }
			.location { margin-top: 36px; }
			.orb-field { min-height: 360px; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); grid-auto-rows: 190px; gap: 8px; }
			.folder-node { height: 190px; }
			.timeline { padding: 14px 16px 18px; }
			.controls { gap: 6px; }
			.control { padding-inline: 10px; }
			.loop-option { margin-left: auto; }
		}
		@media (prefers-reduced-motion: reduce) { .folder-orb { animation: none; } * { scroll-behavior: auto !important; } }
		[hidden] { display: none !important; }
	</style>
</head>
<body>
	<div class="app-shell" id="app-shell">
		<header>
			<div class="brand"><span class="brand-mark"></span><span>Folder activity</span></div>
			<div class="workspace-note" id="workspace-note"></div>
		</header>
		<main>
			<section class="location" aria-label="Current folder">
				<h1 class="crumbs" id="breadcrumbs"></h1>
				<p>Each circle is a folder. Its size, color, and glow show activity in each ten-minute interval.</p>
			</section>
			<section class="activity-stamp" aria-live="polite">
				<strong id="time-summary"></strong>
				<span id="folder-summary"></span>
			</section>
			<section class="orb-field" id="orb-field" aria-label="Folders in this folder"></section>
		</main>
	</div>
	<section class="timeline" aria-label="Time controls">
		<div class="timeline-inner">
			<div class="timeline-readout">
				<time class="timeline-date" id="current-time"></time>
				<span class="timeline-range" id="range-label"></span>
			</div>
			<input class="scrubber" id="scrubber" type="range" min="0" step="1" value="0" aria-label="Choose a ten-minute interval">
			<div class="controls">
				<button class="control" id="stop-button" type="button" title="Stop and return to the first interval">Stop</button>
				<button class="control control-main" id="play-button" type="button">Play</button>
				<button class="control" id="previous-button" type="button" title="Previous ten-minute interval">−10 min</button>
				<button class="control" id="next-button" type="button" title="Next ten-minute interval">+10 min</button>
				<label class="speed-label" for="speed-select">Speed</label>
				<select class="speed" id="speed-select" aria-label="Playback speed">
					<option value="1">1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option>
					<option value="16">16×</option><option value="32">32×</option><option value="64">64×</option>
				</select>
				<label class="loop-option"><input id="loop-checkbox" type="checkbox"> Loop</label>
			</div>
		</div>
	</section>
	<script>
		const report = ${data};
		const intervalMilliseconds = 10 * 60 * 1000;
		const firstInterval = Math.floor(Date.parse(report.startTime) / intervalMilliseconds) * intervalMilliseconds;
		const lastInterval = Math.floor((Date.parse(report.endTime) - 1) / intervalMilliseconds) * intervalMilliseconds;
		const intervals = [];
		for (let value = firstInterval; value <= lastInterval; value += intervalMilliseconds) intervals.push(new Date(value));
		const intervalIndexes = new Map(intervals.map((date, index) => [date.toISOString(), index]));
		const emptyActivity = () => Array(intervals.length).fill(null).map(() => ({ lines: 0, commits: 0 }));
		const root = { name: 'workspace', path: '', children: new Map(), direct: emptyActivity() };
		const nodesByPath = new Map([['', root]]);
		for (const folderPath of report.workspaceFolders) {
			let parent = root;
			let currentPath = '';
			for (const part of folderPath.split('/')) {
				currentPath = currentPath ? currentPath + '/' + part : part;
				if (!parent.children.has(part)) {
					parent.children.set(part, { name: part, path: currentPath, children: new Map(), direct: emptyActivity() });
				}
				parent = parent.children.get(part);
				nodesByPath.set(currentPath, parent);
			}
		}
		for (const folder of report.folders) {
			const node = folder.folderPath === '.' ? root : nodesByPath.get(folder.folderPath);
			if (node === undefined) continue;
			for (const slot of folder.slots) {
				const index = intervalIndexes.get(slot.utcStart);
				if (index !== undefined) node.direct[index] = { lines: slot.changedLines, commits: slot.commitCount };
			}
		}
		const totalsFor = (node, index) => {
			let lines = node.direct[index].lines;
			let commits = node.direct[index].commits;
			for (const child of node.children.values()) {
				const childTotals = totalsFor(child, index);
				lines += childTotals.lines;
				commits += childTotals.commits;
			}
			return { lines, commits };
		};
		const appShell = document.getElementById('app-shell');
		const breadcrumb = document.getElementById('breadcrumbs');
		const timeSummary = document.getElementById('time-summary');
		const folderSummary = document.getElementById('folder-summary');
		const orbField = document.getElementById('orb-field');
		const currentTime = document.getElementById('current-time');
		const rangeLabel = document.getElementById('range-label');
		const scrubber = document.getElementById('scrubber');
		const playButton = document.getElementById('play-button');
		const previousButton = document.getElementById('previous-button');
		const nextButton = document.getElementById('next-button');
		const speedSelect = document.getElementById('speed-select');
		const loopCheckbox = document.getElementById('loop-checkbox');
		document.getElementById('workspace-note').textContent = report.workspaceFolder;
		scrubber.max = String(intervals.length - 1);
		let currentNode = root;
		let currentPath = [];
		let intervalIndex = 0;
		let playbackTimer = null;
		let isPlaying = false;
		let renderedPath = null;
		const formatTime = (date) => new Intl.DateTimeFormat('en', {
			weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
		}).format(date);
		const levelFor = (intensity) => intensity === 0 ? 'idle' : intensity < .34 ? 'quiet' : intensity < .7 ? 'steady' : 'busy';
		const pause = () => {
			isPlaying = false;
			appShell.classList.remove('playing');
			playButton.textContent = 'Play';
			if (playbackTimer !== null) { window.clearInterval(playbackTimer); playbackTimer = null; }
		};
		const render = () => {
			const visibleFolders = [...currentNode.children.values()];
			const selectedTime = intervals[intervalIndex];
			const activeCount = visibleFolders.filter((folder) => totalsFor(folder, intervalIndex).lines > 0).length;
			const crumbNodes = [root, ...currentPath.map((_, index) => currentPath.slice(0, index + 1).reduce((node, name) => node.children.get(name), root))];
			breadcrumb.replaceChildren();
			for (const [index, node] of crumbNodes.entries()) {
				if (index > 0) { const slash = document.createElement('span'); slash.className = 'slash'; slash.textContent = '/'; breadcrumb.append(slash); }
				const crumb = document.createElement('button');
				crumb.className = 'crumb'; crumb.type = 'button'; crumb.textContent = node === root ? report.workspaceFolder.split('/').at(-1) : node.name;
				if (index === crumbNodes.length - 1) { crumb.setAttribute('aria-current', 'page'); crumb.disabled = true; }
				crumb.addEventListener('click', () => { currentPath = currentPath.slice(0, index); currentNode = crumbNodes[index]; renderedPath = null; render(); });
				breadcrumb.append(crumb);
			}
			timeSummary.textContent = formatTime(selectedTime);
			folderSummary.textContent = visibleFolders.length === 0 ? 'No folders with activity in this range' : activeCount + ' of ' + visibleFolders.length + ' folders active · 10-minute steps';
			currentTime.textContent = formatTime(selectedTime);
			rangeLabel.textContent = formatTime(new Date(report.startTime)) + ' — ' + formatTime(new Date(report.endTime));
			scrubber.value = String(intervalIndex);
			previousButton.disabled = intervalIndex === 0;
			nextButton.disabled = intervalIndex === intervals.length - 1;
			const pathKey = currentPath.join('/');
			if (renderedPath !== pathKey) {
				orbField.replaceChildren();
				if (visibleFolders.length === 0) {
					const empty = document.createElement('p'); empty.className = 'empty-folders';
					empty.textContent = 'There are no child folders with Git activity in this time range. Use the path above to return to a parent folder.';
					orbField.append(empty);
				}
				for (const folder of visibleFolders) {
					const node = document.createElement('div'); node.className = 'folder-node'; node.dataset.folderPath = folder.path;
					const orb = document.createElement('button'); orb.className = 'folder-orb'; orb.type = 'button';
					const name = document.createElement('span'); name.className = 'folder-orb__name'; name.textContent = folder.name;
					const detail = document.createElement('span'); detail.className = 'folder-orb__detail';
					const hint = document.createElement('span'); hint.className = 'folder-orb__hint'; hint.textContent = folder.children.size > 0 ? 'open folder' : 'folder';
					orb.append(name, detail, hint);
					if (folder.children.size > 0) orb.addEventListener('click', () => { currentNode = folder; currentPath = folder.path.split('/'); renderedPath = null; render(); });
					else { orb.disabled = true; }
					node.append(orb); orbField.append(node);
				}
				renderedPath = pathKey;
			}
			const maximumLines = Math.max(1, ...visibleFolders.map((folder) => totalsFor(folder, intervalIndex).lines));
			for (const folder of visibleFolders) {
				const orb = orbField.querySelector('[data-folder-path="' + CSS.escape(folder.path) + '"] .folder-orb');
				const detail = orb.querySelector('.folder-orb__detail');
				const totals = totalsFor(folder, intervalIndex);
				const intensity = totals.lines === 0 ? 0 : Math.sqrt(totals.lines / maximumLines);
				orb.dataset.level = levelFor(intensity);
				orb.style.setProperty('--orb-size', (122 + intensity * 58) + 'px');
				orb.style.setProperty('--glow', (intensity * 34) + 'px');
				orb.style.setProperty('--pulse-time', (4.4 - intensity * 2.8) + 's');
				orb.setAttribute('aria-label', folder.name + ': ' + totals.lines + ' changed lines and ' + totals.commits + ' commits in the ten minutes ending ' + formatTime(selectedTime));
				detail.textContent = totals.lines === 0 ? 'quiet' : totals.lines + ' lines · ' + totals.commits + ' commits';
			}
		};
		const play = () => {
			if (intervalIndex === intervals.length - 1) { intervalIndex = 0; render(); }
			isPlaying = true; appShell.classList.add('playing'); playButton.textContent = 'Pause';
			playbackTimer = window.setInterval(() => {
				if (intervalIndex >= intervals.length - 1) {
					if (loopCheckbox.checked) { intervalIndex = 0; render(); return; }
					pause(); return;
				}
				intervalIndex += 1; render();
			}, 1000 / Number(speedSelect.value));
		};
		playButton.addEventListener('click', () => isPlaying ? pause() : play());
		document.getElementById('stop-button').addEventListener('click', () => { pause(); intervalIndex = 0; render(); });
		previousButton.addEventListener('click', () => { pause(); intervalIndex = Math.max(0, intervalIndex - 1); render(); });
		nextButton.addEventListener('click', () => { pause(); intervalIndex = Math.min(intervals.length - 1, intervalIndex + 1); render(); });
		scrubber.addEventListener('input', () => { pause(); intervalIndex = Number(scrubber.value); render(); });
		speedSelect.addEventListener('change', () => { if (isPlaying) { pause(); play(); } });
		render();
	</script>
</body>
</html>
`;
	}
}
