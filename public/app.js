// app.js

if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./sw.js");
}

const socket = io('/');
let ts = timesync.create({
	server: '/timesync', // endpoint for the timesync server
	interval: 60000, // sync interval in milliseconds
});

ts.on('change', (offset) => {
	$("#offset").html(offset + " ms");
});

let clientId = localStorage.getItem('clientId');
if (!clientId) {
	clientId = generateUniqueId();
	localStorage.setItem('clientId', clientId);
}
let stopwatches = { 'default': [] };
let userName = "";

$('#userName').on('change', (e) => {
	console.log(e);
	localStorage.setItem('userName', e.target.value.trim());
	userName = e.target.value.trim();
});

// Set the user's name in the input field
$('#userName').val(userName);

let sessionId = "default";

$('#sessionId').on('change', (e) => {
	let newId = e.target.value.trim()
	if (newId == sessionId) return;

	// clear screen
	$(".stopwatches-container").empty();

	console.log(e);
	localStorage.setItem('sessionId', newId);
	sessionId = newId;

	// Render local stopwatches
	(stopwatches[sessionId] || []).forEach(stopwatch => {
		// Check if the stopwatch is already rendered
		if (!$(`#stopwatch-${stopwatch.id}`).length) {
			renderStopwatch(stopwatch);
			renderStopwatchTime(stopwatch.id);
		}
	});

	// send sessionId message to update
	socket.emit("sessionId", { sessionId, userName });
});

// Set the user's name in the input field
$('#sessionId').val(sessionId);

// send sessionId message to update
socket.emit("sessionId", { sessionId, userName });

// Load stopwatches from localStorage
const storedStopwatches = JSON.parse(localStorage.getItem('stopwatches'));
if (storedStopwatches) {
	stopwatches = storedStopwatches;
	// Render loaded stopwatches
	(stopwatches[sessionId] || []).forEach(stopwatch => {
		// Check if the stopwatch is already rendered
		if (!$(`#stopwatch-${stopwatch.id}`).length) {
			renderStopwatch(stopwatch);
			renderStopwatchTime(stopwatch.id);
		}
	});
}

function oncePerSecondAnim(callback) {
	var frameFunc = function () {
		// get the current time rounded down to a whole second (with a 10% margin)
		var now = 100 * Math.floor(Date.now() / 100 + 0.1);
		// run the callback
		callback(now);
		// wait for the next whole second
		setTimeout(timerFunc, now + 100 - Date.now());
	}, timerFunc = function () {
		requestAnimationFrame(frameFunc);
	};
	timerFunc();
}

// Update times on roughly even times
oncePerSecondAnim(function (now) {
	updateStopwatches();
});

// Function to render deleted stopwatches list
function renderDeletedStopwatches() {
	const deletedStopwatches = JSON.parse(localStorage.getItem('deletedStopwatches')) || [];
	const container = $('#deletedStopwatchesContainer');
	container.empty();

	if (deletedStopwatches.length > 0) {
		container.append('<h3>Deleted Stopwatches</h3>');
		deletedStopwatches.forEach(stopwatch => {
			const source = stopwatch.source || "local"; // Default source is "local"
			const session = stopwatch.sessionId || "default"; // Default session is "default"
			const stopwatchHtml = `
                <div>
                    <span>${session} - ${stopwatch.name} (${source})</span>
                    <button class="btn btn-success recover-btn" data-id="${stopwatch.id}"><i class="fa-solid fa-recycle"></i></button>
                </div>
            `;
			container.append(stopwatchHtml);
		});

		// Add button to clear deleted stopwatches
		container.append('<button id="clearDeletedBtn" class="btn btn-danger"><i class="fa-solid fa-trash"></i></button>');
	} else {
		container.append('<p>No deleted stopwatches.</p>');
	}
}

// Handle click event for showing deleted stopwatches
$(document).on('click', '#showDeletedBtn', function () {
	renderDeletedStopwatches();
	$('#deletedStopwatchesContainer').toggle();
});

// Handle click event for recovering a stopwatch
$(document).on('click', '.recover-btn', function () {
	const stopwatchId = $(this).data('id');
	const deletedStopwatches = JSON.parse(localStorage.getItem('deletedStopwatches')) || [];
	const indexToRemove = deletedStopwatches.findIndex(stopwatch => stopwatch.id === stopwatchId);

	if (indexToRemove !== -1) {
		const recoveredStopwatch = deletedStopwatches.splice(indexToRemove, 1)[0];
		localStorage.setItem('deletedStopwatches', JSON.stringify(deletedStopwatches));

		recoveredStopwatch.journal.sort((a, b) => a.time - b.time);

		const existingStopwatchIndex = (stopwatches[sessionId] || []).findIndex(stopwatch => stopwatch.id === stopwatchId);
		if (existingStopwatchIndex !== -1) {
			stopwatches[sessionId][existingStopwatchIndex].journal.sort((a, b) => a.time - b.time);
			// Merge the recovered stopwatch's journal with the existing one
			stopwatches[sessionId][existingStopwatchIndex].journal = mergeSortedJournals(stopwatches[sessionId][existingStopwatchIndex].journal, recoveredStopwatch.journal);
			renderStopwatchTime(stopwatchId);
		} else {
			// Add the recovered stopwatch to stopwatches array
			if (typeof (stopwatches[sessionId]) === 'undefined') stopwatches[sessionId] = [];
			stopwatches[sessionId].push(recoveredStopwatch);
			renderStopwatch(recoveredStopwatch);
		}

		renderDeletedStopwatches();

		// Iterate through the recovered stopwatch's journal and emit each event to the server
		recoveredStopwatch.journal.forEach(event => {
			socket.emit(event.type, { ...event, clientId, sessionId, userName });
		});

		// send recover message
		socket.emit("msg", { stopwatchId, type: "recover", clientId, sessionId, userName, time: new Date(ts.now()).getTime() });

		// Update localStorage with the modified stopwatches array
		updateLocalStopwatches();
	}
});

// Handle click event for clearing deleted stopwatches
$(document).on('click', '#clearDeletedBtn', function () {
	localStorage.removeItem('deletedStopwatches');
	renderDeletedStopwatches();
});

// Load stopwatches from the event journal
function loadStopwatchesFromJournal(journal) {
	const stopwatchMap = new Map();

	journal.forEach(event => {
		const { stopwatchId, type } = event;
		let stopwatch = stopwatchMap.get(stopwatchId);

		if (!stopwatch) {
			stopwatch = {
				id: stopwatchId,
				name: '',
				running: false,
				journal: []
			};
			stopwatchMap.set(stopwatchId, stopwatch);
		}

		// Update the stopwatch state based on the event type
		stopwatch.journal.push({ ...event, source: "syncJournal" });

		if (type == 'toggleEvent') {
			// TODO: Toggle based on journal
		}

		if (type == 'add') {
			stopwatch.name = event.name;

			// remove from deleted, if re-added
			const deletedStopwatches = JSON.parse(localStorage.getItem('deletedStopwatches')) || [];
			const existingDeletedIndex = deletedStopwatches.findIndex(stopwatch => stopwatch.id === stopwatchId);
			if (existingDeletedIndex !== -1) {
				deletedStopwatches.splice(existingDeletedIndex, 1);
				localStorage.setItem('deletedStopwatches', JSON.stringify(deletedStopwatches));
			}
		}

		if (type == 'remove') {
			stopwatchMap.delete(stopwatchId);
			const existingStopwatchIndex = (stopwatches[sessionId] || []).findIndex(stopwatch => stopwatch.id === stopwatchId);
			if (existingStopwatchIndex !== -1) {
				const deletedStopwatches = JSON.parse(localStorage.getItem('deletedStopwatches')) || [];
				const existingDeletedIndex = deletedStopwatches.findIndex(stopwatch => stopwatch.id === stopwatchId);
				if (existingDeletedIndex === -1) {
					stopwatches[sessionId][existingStopwatchIndex].source = "reload";
					deletedStopwatches.push(stopwatches[existingStopwatchIndex]);
					localStorage.setItem('deletedStopwatches', JSON.stringify(deletedStopwatches));
				}
				// remove local version
				stopwatches[sessionId].splice(existingStopwatchIndex, 1);
			}
		}

	});

	// Convert the map of stopwatches to an array
	return Array.from(stopwatchMap.values());
}

// Sync event journal with the server
socket.on('syncJournal', (journal) => {

	// Sort chronologically
	journal.sort((a, b) => a.time - b.time);

	// Handle syncing journal with the UI
	console.log('Syncing event journal with the UI:', journal);

	// Load stopwatches from the event journal
	const loadedStopwatches = loadStopwatchesFromJournal(journal);

	if (typeof (stopwatches[sessionId]) === 'undefined') stopwatches[sessionId] = [];

	// Merge loaded stopwatches with existing stopwatches
	loadedStopwatches.forEach(loadedStopwatch => {
		const existingStopwatchIndex = stopwatches[sessionId].findIndex(stopwatch => stopwatch.id === loadedStopwatch.id);
		if (existingStopwatchIndex !== -1) {
			// Merge the journals of existing and loaded stopwatches
			const existingStopwatch = stopwatches[sessionId][existingStopwatchIndex];
			//console.log("Merge", JSON.parse(JSON.stringify(existingStopwatch.journal)), JSON.parse(JSON.stringify(loadedStopwatch.journal)));
			existingStopwatch.journal = mergeSortedJournals(existingStopwatch.journal, loadedStopwatch.journal);
			//console.log("Merged", existingStopwatch.journal);
		} else {
			stopwatches[sessionId].push(loadedStopwatch);
		}
	});

	// Store stopwatches locally
	localStorage.setItem('stopwatches', JSON.stringify(stopwatches));

	// Render loaded stopwatches
	stopwatches[sessionId].forEach(stopwatch => {
		// Check if the stopwatch is already rendered
		if (!$(`#stopwatch-${stopwatch.id}`).length) {
			renderStopwatch(stopwatch);
			renderStopwatchTime(stopwatch.id);
		} else {
			updateLaps(stopwatch.id, false);
			updateJournalList(stopwatch.id, false);
		}
	});
});

function updateLocalStopwatches() {
	// Store stopwatches locally
	localStorage.setItem('stopwatches', JSON.stringify(stopwatches));
}

// Listen for msg event
socket.on('msg', (event) => {
	const { stopwatchId, type } = event;
	if (typeof (stopwatches[sessionId]) === 'undefined') stopwatches[sessionId] = [];

	if (type == 'add') {
		const existingStopwatchIndex = stopwatches[sessionId].findIndex(stopwatch => stopwatch.id === stopwatchId);
		if (existingStopwatchIndex !== -1) {
			// If stopwatch already exists, update its name and merge the journals
			const existingStopwatch = stopwatches[sessionId][existingStopwatchIndex];
			existingStopwatch.name = event.name;

			// Merge the event to journal
			existingStopwatch.journal.sort((a, b) => a.time - b.time);
			existingStopwatch.journal = mergeSortedJournals(existingStopwatch.journal, [{ ...event, source: "socketio" }]);

			// Render the stopwatch time on the UI
			renderStopwatchTime(stopwatchId);
		} else {
			// Create a new stopwatch if it doesn't exist
			const newStopwatch = {
				id: stopwatchId,
				name: event.name,
				running: false,
				journal: [{ ...event, source: "socketio" }]
			};
			stopwatches[sessionId].push(newStopwatch);
			renderStopwatch(newStopwatch);
		}
		// Update localStorage with the modified stopwatches array
		updateLocalStopwatches();
		updateJournalList(stopwatchId, false);

	} else if (type == "remove") {
		// Add stopwatch to deleted, if found
		const indexToRemove = stopwatches[sessionId].findIndex(stopwatch => stopwatch.id === stopwatchId);
		if (indexToRemove !== -1) {
			const deletedStopwatches = JSON.parse(localStorage.getItem('deletedStopwatches')) || [];
			stopwatches[sessionId][indexToRemove].source = "remote";
			deletedStopwatches.push(stopwatches[sessionId][indexToRemove]);
			localStorage.setItem('deletedStopwatches', JSON.stringify(deletedStopwatches));

			stopwatches[sessionId].splice(indexToRemove, 1);
			$(`#stopwatch-${stopwatchId}`).remove();

			updateLocalStopwatches();
		}
	} else if (type == "toggleEvent") {
		// Find the stopwatch in the local stopwatches array
		const stopwatchIndex = stopwatches[sessionId].findIndex(stopwatch => stopwatch.id === stopwatchId);
		if (stopwatchIndex !== -1) {
			// Find the event in the stopwatch's journal based on time and type
			const eventIndex = stopwatches[sessionId][stopwatchIndex].journal.findIndex(journalEvent => journalEvent.time === event.eventTime && journalEvent.type === event.eventType);
			if (eventIndex !== -1) {
				// Update the enabled status of the event
				stopwatches[sessionId][stopwatchIndex].journal[eventIndex].enabled = event.enabled;

				// Update local storage with the modified stopwatches array
				updateLocalStopwatches();

				updateJournalList(stopwatchId, false);
				updateLaps(stopwatchId, false);
			}
		}
	} else {
		const stopwatch = stopwatches[sessionId].find(stopwatch => stopwatch.id === stopwatchId);
		if (stopwatch) {
			stopwatch.journal.push({ ...event, source: "socketio" });
			stopwatch.journal.sort((a, b) => a.time - b.time);
			renderStopwatchTime(stopwatchId);
			updateLocalStopwatches();
			updateJournalList(stopwatchId, false);
			updateLaps(stopwatchId, false);
		}
	}
});

// Separate stopwatch HTML rendering function
function renderStopwatch(stopwatch) {
	const stopwatchHtml = `
	<div id="stopwatch-${stopwatch.id}" class="stopwatch-container">
		<h4 class="stopwatch-name">${stopwatch.name}</h4>
		<p class="stopwatch-time">00:00:000</p>
		<div class="stopwatch-buttons">
			<button class="start-btn btn-success" data-id="${stopwatch.id}"><i class="fa-solid fa-play"></i></button>
			<button class="stop-btn btn-warning" data-id="${stopwatch.id}"><i class="fa-solid fa-stop"></i></button>
			<button class="lap-btn btn-secondary" data-id="${stopwatch.id}"><i class="fa-solid fa-plus"></i></button>
		</div>
		<div class="stopwatch-buttons stopwatch-buttons-smaller">
			<button class="reset-btn btn-warning" data-id="${stopwatch.id}"><i class="fa-solid fa-redo"></i></button>
			<button class="remove-btn btn-danger" data-id="${stopwatch.id}"><i class="fa-solid fa-trash"></i></button>
			<button class="journal-btn btn-info" data-id="${stopwatch.id}"><i class="fa-solid fa-history"></i></button>
			<button class="lap-times-btn btn-dark" data-id="${stopwatch.id}"><i class="fa-solid fa-list"></i></button>
		</div>
		<ul class="journal-list" style="display:none" id="journal-list-${stopwatch.id}" data-id="${stopwatch.id}"></ul>
		<div id="lap-times-container-${stopwatch.id}" style="display:none"></div>
	</div>
    `;
	$('#stopwatches-container').append(stopwatchHtml);
}

// Handle click event for showing lap times
$(document).on('click', '.lap-times-btn', function () {
	const stopwatchId = $(this).data('id');
	updateLaps(stopwatchId, true);
});

function updateLaps(stopwatchId, toggle) {
	const stopwatch = (stopwatches[sessionId] || []).find(stopwatch => stopwatch.id === stopwatchId);
	if (stopwatch) {
		const lapTimesContainer = document.getElementById(`lap-times-container-${stopwatchId}`);
		//console.log(lapTimesContainer, `#lap-times-container-${stopwatchId}`);

		const lapTimes = calculateLapTimes(stopwatch.journal);
		stopwatch.lapTimes = lapTimes;

		let lapItems = "";
		let cumulativeElapsedTime = 0; // Initialize cumulative elapsed time
		// Calculate lap time and cumulative elapsed time for each lap
		for (let i = 0; i < stopwatch.lapTimes.length; i++) {
			const lapTime = stopwatch.lapTimes[i];
			cumulativeElapsedTime += lapTime; // Add lap time to cumulative elapsed time
			lapItems += `<p>Lap ${i + 1}: ${formatTime(lapTime, "milliseconds")} - ${formatTime(cumulativeElapsedTime, "milliseconds")}</p>`;
		}
		lapTimesContainer.innerHTML = lapItems;

		// Hide elapsed time container if not toggled
		toggle && $(lapTimesContainer).toggle();
	}
}

// Handle click event for showing the journal list
$(document).on('click', '.journal-btn', function () {
	const stopwatchId = $(this).data('id');
	updateJournalList(stopwatchId, true);
});

function updateJournalList(stopwatchId, toggle) {
	const stopwatch = (stopwatches[sessionId] || []).find(stopwatch => stopwatch.id === stopwatchId);
	if (stopwatch) {
		const journalList = document.getElementById(`journal-list-${stopwatchId}`);
		//console.log(journalList);

		let items = "";
		stopwatch.journal.forEach((event, index) => {
			if (event.type == 'toggleEvent') return;
			const checked = event.enabled ? 'checked' : '';
			const listItem = `<li class="list-group-item" data-index="${index}"><input type="checkbox" ${checked}> ${event.type} - ${new Date(event.time).toLocaleString()} - ${event.clientId == clientId ? "Me" : event.clientId} - ${event.source || ""}</li>`;
			items = items.concat(listItem);
		});
		journalList.innerHTML = items;
		toggle && $(journalList).toggle();
	}
}

// Handle click event for toggling journal item
$(document).on('change', '.journal-list li', function () {
	const toggleTime = new Date(ts.now()).getTime();
	const stopwatchId = $(this).closest('ul').data('id');
	const index = $(this).data('index');
	const stopwatch = (stopwatches[sessionId] || []).find(stopwatch => stopwatch.id === stopwatchId);
	if (stopwatch && stopwatch.journal[index]) {
		stopwatch.journal[index].enabled = !stopwatch.journal[index].enabled;
		//console.log("Journal toggle", stopwatch.journal[index]);
		updateLocalStopwatches();
		updateLaps(stopwatchId, false);
		// Emit event to server to synchronize status
		socket.emit('msg', { stopwatchId, sessionId, time: toggleTime, type: 'toggleEvent', eventTime: stopwatch.journal[index].time, eventType: stopwatch.journal[index].type, enabled: stopwatch.journal[index].enabled, clientId, userName });
	}
});

// Handle a button click event and emit a start event
$(document).on('click', '.start-btn', function () {
	const startTime = new Date(ts.now());
	const stopwatchId = $(this).data('id');
	const stopwatchIndex = (stopwatches[sessionId] || []).findIndex(stopwatch => stopwatch.id === stopwatchId);
	if (stopwatchIndex !== -1) {
		const stopwatch = stopwatches[sessionId][stopwatchIndex];
		let event = {
			stopwatchId,
			type: 'start',
			sessionId,
			time: startTime.getTime(),
			enabled: true,
			clientId,
			userName,
			source: 'local',
		};
		stopwatch.journal.push(event);

		// Emit the start event with stopwatch data
		socket.emit('msg', event);
		updateLocalStopwatches();
		updateJournalList(stopwatchId, false);
	}
});

// Handle a button click event and emit a stop event
$(document).on('click', '.stop-btn', function () {
	const stopTime = new Date(ts.now());
	const stopwatchId = $(this).data('id');
	const stopwatchIndex = (stopwatches[sessionId] || []).findIndex(stopwatch => stopwatch.id === stopwatchId);
	if (stopwatchIndex !== -1) {
		const stopwatch = stopwatches[sessionId][stopwatchIndex];
		let event = {
			stopwatchId,
			type: 'stop',
			sessionId,
			time: stopTime.getTime(),
			enabled: true,
			clientId,
			userName,
			source: 'local',
		};
		stopwatch.journal.push(event);

		// Emit the stop event with stopwatch data
		socket.emit('msg', event);

		// Update the stopwatch time on the UI
		renderStopwatchTime(stopwatchId);
		updateLocalStopwatches();
		updateJournalList(stopwatchId, false);
	}
});

// Handle a button click event and emit a lap event
$(document).on('click', '.lap-btn', function () {
	const lapTime = new Date(ts.now());
	const stopwatchId = $(this).data('id');
	const stopwatchIndex = (stopwatches[sessionId] || []).findIndex(stopwatch => stopwatch.id === stopwatchId);
	if (stopwatchIndex !== -1) {
		const stopwatch = stopwatches[sessionId][stopwatchIndex];
		let event = {
			stopwatchId,
			type: 'lap',
			sessionId,
			time: lapTime.getTime(),
			enabled: true,
			clientId,
			userName,
			source: 'local',
		};
		stopwatch.journal.push(event);

		// Emit the lap event with stopwatch data
		socket.emit('msg', event);
		updateLocalStopwatches();
		updateLaps(stopwatchId, false);
		updateJournalList(stopwatchId, false);
	}
});

// Handle a button click event to remove a stopwatch
$(document).on('click', '.remove-btn', function () {
	const removeTime = new Date(ts.now());
	const stopwatchId = $(this).data('id');
	const indexToRemove = (stopwatches[sessionId] || []).findIndex(stopwatch => stopwatch.id === stopwatchId);
	if (indexToRemove !== -1) {
		const deletedStopwatches = JSON.parse(localStorage.getItem('deletedStopwatches')) || [];
		stopwatches[sessionId][indexToRemove].source = "local";
		deletedStopwatches.push(stopwatches[sessionId][indexToRemove]);
		localStorage.setItem('deletedStopwatches', JSON.stringify(deletedStopwatches));

		stopwatches[sessionId].splice(indexToRemove, 1);
		$(`#stopwatch-${stopwatchId}`).remove();

		let event = {
			stopwatchId,
			type: 'remove',
			sessionId,
			time: removeTime.getTime(),
			enabled: true,
			clientId,
			userName,
			source: 'local',
		};

		// Emit remove event with stopwatchId
		socket.emit('msg', event);

		updateLocalStopwatches();
		updateJournalList(stopwatchId, false);
	}
});

// Handle a button click event to add a new stopwatch
$('#addStopwatchBtn').on('click', function () {
	const addTime = new Date(ts.now()).getTime();
	const stopwatchName = $('#stopwatchName').val().trim();
	if (stopwatchName) {
		const stopwatchId = generateUniqueId(); // Generate a unique ID for the stopwatch
		let event = {
			stopwatchId,
			type: 'add',
			time: addTime,
			sessionId,
			name: stopwatchName,
			enabled: true,
			clientId,
			userName,
			source: "local",
		};

		const newStopwatch = {
			id: stopwatchId,
			name: stopwatchName,
			running: false,
			journal: [event]
		};
		if (typeof (stopwatches[sessionId]) === 'undefined') stopwatches[sessionId] = [];
		stopwatches[sessionId].push(newStopwatch);
		renderStopwatch(newStopwatch);

		// Update localStorage with new stopwatch
		localStorage.setItem('stopwatches', JSON.stringify(stopwatches));

		// Emit add event with stopwatch data
		socket.emit('msg', event);
		updateJournalList(stopwatchId, false);
	}
});

// Handle a button click event to reset a stopwatch
$(document).on('click', '.reset-btn', function () {
	const resetTime = new Date(ts.now());
	const stopwatchId = $(this).data('id');
	const stopwatchIndex = (stopwatches[sessionId] || []).findIndex(stopwatch => stopwatch.id === stopwatchId);
	if (stopwatchIndex !== -1) {
		const stopwatch = stopwatches[sessionId][stopwatchIndex];
		let event = {
			stopwatchId,
			type: 'reset',
			sessionId,
			time: resetTime.getTime(),
			enabled: true,
			clientId,
			userName,
			source: 'local',
		};
		stopwatch.journal.push(event);

		// Emit the reset event with stopwatch data
		socket.emit('msg', event);

		// Update the stopwatch time on the UI
		renderStopwatchTime(stopwatchId);
		updateLocalStopwatches();
		updateJournalList(stopwatchId, false);
	}
});

// TODO: Handle a button click event to manually sync time
/*
$('#syncTimeBtn').on('click', function () {
	const offset = parseInt($('#timeOffset').val(), 10) || 0;
	ts = timesync.create({
		now: function () {
			return Date.now() + offset;
		},
	});
});
*/

// Function to render the stopwatch time for a specific stopwatch
function renderStopwatchTime(stopwatchId) {
	const stopwatch = (stopwatches[sessionId] || []).find(stopwatch => stopwatch.id === stopwatchId);
	if (stopwatch) {
		const stopwatchContainer = $(`#stopwatch-${stopwatchId}`);
		stopwatchContainer.find('.stopwatch-time').text(formatTime(getStopwatchElapsedTime(stopwatch)));
	}
}

// Function to calculate lap times
function calculateLapTimes(journal) {
	const lapTimes = [];
	let lastStartTime = null;
	let lastLapTime = null;
	let running = false;

	journal.forEach(event => {
		if (!event.enabled) return;

		if (event.type === 'start') {
			lastStartTime = event.time;
			lastLapTime = event.time;
			running = true;
		} else if (event.type === 'lap' && running) {
			if (lastStartTime !== null) {
				const lapTime = event.time - lastLapTime;
				lapTimes.push(lapTime);
				lastLapTime = event.time;
			}
		} else if (event.type === 'stop') {
			// TODO: don't create a lap time from stop, except the last one
			if (lastStartTime !== null) {
				lapTimes.push(event.time - lastLapTime);
				running = false;
			}
		} else if (event.type === 'reset') {
			lastStartTime = null;
			lastLapTime = null;
			lapTimes.length = 0;
			running = false;
		}
	});

	return lapTimes;
}


// Function to get the elapsed time for a specific stopwatch
function getStopwatchElapsedTime(stopwatch) {
	let elapsedTime = 0;
	let running = false;
	let lastStartTime = null;

	// TODO: make calculation lighter by storing intermediate elapsed time to the last stop
	stopwatch.journal.forEach((event, index) => {
		if (event.enabled) {
			if (event.type === 'start' && !running) {
				running = true;
				lastStartTime = event.time;
			} else if (event.type === 'stop' && running) {
				elapsedTime += event.time - lastStartTime;
				running = false;
			} else if (event.type === 'reset') {
				// If the stopwatch is reset, reset the state
				running = false;
				lastStartTime = null;
				elapsedTime = 0;
			}
		}
	});

	// If the stopwatch is still running, calculate the elapsed time up to the current time
	if (running) {
		elapsedTime += ts.now() - lastStartTime;
	}

	return elapsedTime;
}


function formatTime(milliseconds, format = "tenths") {
	const totalSeconds = Math.floor(milliseconds / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const tenthPart = Math.floor(milliseconds / 100) % 10;
	const millisecondsPart = Math.floor(milliseconds) % 1000;

	if (format == "milliseconds") {
		if (hours > 0) {
			return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millisecondsPart).padStart(3, '0')}`;
		} else {
			return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millisecondsPart).padStart(3, '0')}`;
		}
	} else {


		if (hours > 0) {
			return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(tenthPart).padStart(1, '0')}`;
		} else {
			return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(tenthPart).padStart(1, '0')}`;
		}
	}
}


// Function to generate a unique event ID
function generateUniqueId() {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Initial rendering of stopwatches
(stopwatches[sessionId] || []).forEach(stopwatch => {
	renderStopwatchTime(stopwatch.id);
});

// Function to update the stopwatch time for all stopwatches
function updateStopwatchTimes() {
	(stopwatches[sessionId] || []).forEach(stopwatch => {
		renderStopwatchTime(stopwatch.id);
	});
}

// Function to update stopwatches based on events in the journal
function updateStopwatches() {
	(stopwatches[sessionId] || []).forEach(stopwatch => {
		renderStopwatchTime(stopwatch.id);
	});
}

function mergeSortedJournals(journal1, journal2) {
	const mergedJournal = [];
	let i = 0, j = 0;

	// Filter duplicates from journal1
	const filteredJournal1 = filterDuplicates(journal1);

	// Filter duplicates from journal2
	const filteredJournal2 = filterDuplicates(journal2);

	while (i < filteredJournal1.length && j < filteredJournal2.length) {
		if (filteredJournal1[i].time < filteredJournal2[j].time) {
			mergedJournal.push(filteredJournal1[i++]);
		} else if (filteredJournal1[i].time == filteredJournal2[j].time) {
			// Same time, check for same type?
			if (filteredJournal1[i].type == filteredJournal2[j].type) {
				mergedJournal.push(filteredJournal1[i++]);
				// skip the same from 2
				j++;
				continue;
			} else {
				console.log("Merge: same time?");
				mergedJournal.push(filteredJournal1[i++]);
			}
		} else {
			mergedJournal.push(filteredJournal2[j++]);
		}
	}

	// Add remaining events from journal1
	while (i < filteredJournal1.length) {
		mergedJournal.push(filteredJournal1[i++]);
	}

	// Add remaining events from journal2
	while (j < filteredJournal2.length) {
		mergedJournal.push(filteredJournal2[j++]);
	}

	return mergedJournal;
}

function filterDuplicates(journal) {
	const filteredJournal = [];

	for (let i = 0; i < journal.length; i++) {
		const currentEvent = journal[i];
		const nextEvent = i < journal.length - 1 ? journal[i + 1] : false;

		// Check if next event exists and has the same time and type as the current event
		if (nextEvent && nextEvent.time === currentEvent.time && nextEvent.type === currentEvent.type) {
			// Skip the current event if the next event is the same
			continue;
		}

		// Add the current event if it's unique or the last occurrence of its type
		filteredJournal.push(currentEvent);
	}

	return filteredJournal;
}
