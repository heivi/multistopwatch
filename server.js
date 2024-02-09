// server.js
const MAX_SESSION_KEEP_TIME = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
//const MAX_SESSION_KEEP_TIME = 1000; // 1 sec

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const timesyncServer = require('timesync/server');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: '*',
	},
});

app.use(cors()); // Allow CORS for all origins
app.use(express.static('public'));

const port = process.env.PORT || 3000;

let eventJournals = loadEventJournals(); // Load event journals from disk
let changedSince = false;

server.listen(port, () => {
	console.log(`Server running on port ${port}`);
});

app.use('/timesync', timesyncServer.requestHandler); // Add timesync endpoint

io.on('connection', (socket) => {
	console.log('Client connected:', socket.id);
	socket.data.sessionId = "default";
	socket.data.userName = "anonymous";
	socket.join(socket.data.sessionId);

	// Handle session ID message from the client
	socket.on('sessionId', (data) => {
		if (socket.data.sessionId !== data.sessionId) {
			socket.leave(socket.data.sessionId);
			socket.join(data.sessionId);
			socket.data.sessionId = data.sessionId;
		}

		socket.data.userName = data.userName;

		// Create a new event journal for the session if it doesn't exist
		if (!eventJournals[socket.data.sessionId]) {
			eventJournals[socket.data.sessionId] = [];
			changedSince = true;
		}
		// Send existing event journal to the client for the session
		socket.emit('syncJournal', eventJournals[socket.data.sessionId]);
	});

	// Handle msg event
	socket.on('msg', (data) => {
		if (data.sessionId !== socket.data.sessionId) {
			socket.leave(socket.data.sessionId);
			socket.join(data.sessionId);
			socket.data.sessionId = data.sessionId;
		}
		// Push event to the event journal for the corresponding session
		eventJournals[data.sessionId].push(data);
		changedSince = true;
		// Broadcast the event to other clients in the same session
		socket.to(socket.data.sessionId).emit('msg', data);
	});

	// Handle disconnect event
	socket.on('disconnect', () => {
		console.log('Client disconnected:', socket.id, socket.data.sessionId, socket.data.userName);
		cleanEventJournals();
	});

});

// Function to load events from local storage
function loadEventJournals() {
	try {
		const data = fs.readFileSync('eventJournals.json', 'utf8');
		return JSON.parse(data) || {};
	} catch (error) {
		console.error('Error loading event journal:', error.message);
		return {};
	}
}

function saveEventJournals() {
	if (changedSince);
	try {
		fs.writeFileSync('eventJournals.json', JSON.stringify(eventJournals));
		console.log('Event journals saved to disk.');
		changedSince = false;
	} catch (error) {
		console.error('Error saving event journals:', error.message);
	}
}

const saveInterval = 60000; // Save interval in milliseconds (e.g., every minute)

// Start saving event journals to disk at regular intervals
setInterval(saveEventJournals, saveInterval);

// Function to clean event journals
function cleanEventJournals() {
	const currentTime = Date.now();
	for (const sessionId in eventJournals) {
		const sessionEvents = eventJournals[sessionId];
		const stopwatchesToRemove = new Set();

		// Iterate through session events to identify stopwatches to remove
		for (let i = 0; i < sessionEvents.length; i++) {
			const event = sessionEvents[i];
			if (event.type === "remove") {
				// Check if all events after removal event are for the same stopwatch
				let foundOtherEvents = false;
				let removetime = event.time;
				for (let j = i + 1; j < sessionEvents.length; j++) {
					const nextEvent = sessionEvents[j];
					if (nextEvent.stopwatchId === event.stopwatchId && nextEvent.type !== "remove") {
						foundOtherEvents = true;
						break;
					}
				}
				if (!foundOtherEvents && currentTime - removetime > MAX_SESSION_KEEP_TIME) {
					// If no other events found for the same stopwatch, mark for removal
					stopwatchesToRemove.add(event.stopwatchId);
				}
			}
		}

		// Remove stopwatches from event journal
		if (stopwatchesToRemove.size > 0) {
			eventJournals[sessionId] = sessionEvents.filter(event => {
				return !stopwatchesToRemove.has(event.stopwatchId);
			});
			changedSince = true; // Set the flag to indicate changes
			console.log(`Removed ${stopwatchesToRemove.size} stopwatches from session ${sessionId}.`);
		}
	}
}
