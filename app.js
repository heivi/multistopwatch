// app.js
const socket = io('http://localhost:3000');
let ts = timesync.create({
	server: 'http://localhost:3000/timesync', // endpoint for the timesync server
	interval: 60000, // sync interval in milliseconds
});
let clientId = localStorage.getItem('clientId') || generateUniqueId();
localStorage.setItem('clientId', clientId);
let stopwatches = [];

setInterval(() => {
	updateStopwatches();
}, 100);

// Sync event journal with the server
socket.on('syncJournal', (journal) => {
	// Handle syncing journal with the UI
	console.log('Syncing event journal with the UI:', journal);
});

// Handle a button click event and emit a start event
$(document).on('click', '.start-btn', function () {
    const stopwatchId = $(this).data('id');
    const stopwatchIndex = stopwatches.findIndex(stopwatch => stopwatch.id === stopwatchId);
    if (stopwatchIndex !== -1) {
        const stopwatch = stopwatches[stopwatchIndex];
        const startTime = new Date(ts.now());
        stopwatch.running = true;
        stopwatch.startTime = startTime;

        // Emit the start event with stopwatch data
        socket.emit('start', { stopwatchId, startTime: startTime.getTime(), clientId });
    }
});

// Handle a button click event and emit a stop event
$(document).on('click', '.stop-btn', function () {
    const stopwatchId = $(this).data('id');
    const stopwatchIndex = stopwatches.findIndex(stopwatch => stopwatch.id === stopwatchId);
    if (stopwatchIndex !== -1) {
        const stopwatch = stopwatches[stopwatchIndex];
        const stopTime = new Date(ts.now());
        stopwatch.running = false;
        stopwatch.stopTime = stopTime;

        // Emit the stop event with stopwatch data
        socket.emit('stop', { stopwatchId, stopTime: stopTime.getTime(), clientId });

        // Update the stopwatch time on the UI
        renderStopwatchTime(stopwatchId);
    }
});

// Handle a button click event and emit a lap event
$(document).on('click', '.lap-btn', function () {
    const stopwatchId = $(this).data('id');
    const stopwatchIndex = stopwatches.findIndex(stopwatch => stopwatch.id === stopwatchId);
    if (stopwatchIndex !== -1) {
        const stopwatch = stopwatches[stopwatchIndex];
        const lapTime = new Date(ts.now());

        // Emit the lap event with stopwatch data
        socket.emit('lap', { stopwatchId, lapTime: lapTime.getTime(), clientId });
    }
});

// Handle a button click event to remove a stopwatch
$(document).on('click', '.remove-btn', function () {
    const stopwatchId = $(this).data('id');
    const indexToRemove = stopwatches.findIndex(stopwatch => stopwatch.id === stopwatchId);
    if (indexToRemove !== -1) {
        stopwatches.splice(indexToRemove, 1);
        $(`#stopwatch-${stopwatchId}`).remove();
    }
});

// Handle a button click event to add a new stopwatch
$('#addStopwatchBtn').on('click', function () {
    const stopwatchName = $('#stopwatchName').val().trim();
    if (stopwatchName) {
        const stopwatchId = generateUniqueId(); // Generate a unique ID for the stopwatch
        stopwatches.push({ id: stopwatchId, name: stopwatchName, running: false, startTime: null, elapsedTime: 0 });
        const stopwatchHtml = `
            <div id="stopwatch-${stopwatchId}" class="stopwatch-container">
                <h4>${stopwatchName}</h4>
                <p class="stopwatch-time">00:00</p>
                <button class="btn btn-primary start-btn" data-id="${stopwatchId}">Start</button>
                <button class="btn btn-danger stop-btn" data-id="${stopwatchId}">Stop</button>
                <button class="btn btn-warning lap-btn" data-id="${stopwatchId}">Lap</button>
                <button class="btn btn-secondary remove-btn" data-id="${stopwatchId}">Remove</button>
            </div>
        `;
        $('#stopwatches-container').append(stopwatchHtml);
    }
});

// Handle a button click event to manually sync time
$('#syncTimeBtn').on('click', function () {
	const offset = parseInt($('#timeOffset').val(), 10) || 0;
	ts = timesync.create({
		now: function () {
			return Date.now() + offset;
		},
	});
});

// Function to render the stopwatch time for a specific stopwatch
function renderStopwatchTime(stopwatchId) {
	const stopwatch = stopwatches.find(stopwatch => stopwatch.id === stopwatchId);
	if (stopwatch) {
		const stopwatchContainer = $(`#stopwatch-${stopwatchId}`);
		stopwatchContainer.find('.stopwatch-time').text(formatTime(stopwatch.elapsedTime));
	}
}

// Function to update the stopwatch time for all stopwatches
function updateStopwatchTimes() {
	stopwatches.forEach((stopwatch) => {
		renderStopwatchTime(stopwatch.id);
	});
}

function updateStopwatches() {
	stopwatches.forEach((stopwatch) => {
		if (stopwatch.running) {
			const currentTime = new Date(ts.now()).getTime();
			const startTime = new Date(stopwatch.startTime).getTime();
			console.log(currentTime, startTime);
			stopwatch.elapsedTime = currentTime - startTime;
		}
	});

	updateStopwatchTimes()
}

// Function to format time in minutes, seconds, and milliseconds
function formatTime(milliseconds) {
	const totalSeconds = Math.floor(milliseconds / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	const millisecondsPart = milliseconds % 1000;

	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(millisecondsPart).padStart(3, '0')}`;
}

function getCurrentTime() {
	if (ts) {
		return ts.now();
	} else {
		return Date.now();
	}
}

// Function to generate a unique event ID
function generateUniqueId() {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }