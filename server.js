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

const port = process.env.PORT || 3000;

let eventJournal = loadEventJournal(); // Load events from local storage
let stopwatches = [];

server.listen(port, () => {
	console.log(`Server running on port ${port}`);
});

app.use('/timesync', timesyncServer.requestHandler); // Add timesync endpoint

io.on('connection', (socket) => {
	console.log('Client connected:', socket.id);

	// Send existing event journal to the client
	socket.emit('syncJournal', eventJournal);

	// Handle start event
	socket.on('start', (data) => {
		const stopwatchId = data.stopwatchId;
		const event = {
			id: generateEventId(),
			type: 'start',
			stopwatchId: stopwatchId,
			time: data.time,
			clientId: data.clientId,
			enabled: data.enabled,
		};

		socket.broadcast.emit('start', event);

		eventJournal.push(event);
		saveEventJournal(eventJournal);
	});

	// Handle stop event
	socket.on('stop', (data) => {
		const stopwatchId = data.stopwatchId;
		const event = {
			id: generateEventId(),
			type: 'stop',
			stopwatchId: stopwatchId,
			time: data.time,
			clientId: data.clientId,
			enabled: data.enabled,
		};

		socket.broadcast.emit('stop', event);

		eventJournal.push(event);
		saveEventJournal(eventJournal);
	});

	// Handle lap event
	socket.on('lap', (data) => {
		const stopwatchId = data.stopwatchId;
		const event = {
			id: generateEventId(),
			type: 'lap',
			stopwatchId: stopwatchId,
			time: data.time,
			clientId: data.clientId,
			enabled: data.enabled,
		};

		socket.broadcast.emit('lap', event);

		eventJournal.push(event);
		saveEventJournal(eventJournal);
	});

	// Handle remove event
	socket.on('remove', (data) => {
		const event = {
			id: generateEventId(),
			type: 'remove',
			stopwatchId: data.stopwatchId,
			time: data.time,
			clientId: data.clientId,
			enabled: data.enabled,
		}

		socket.broadcast.emit('remove', event);

		eventJournal.push(event);
		saveEventJournal(eventJournal);

		stopwatches = stopwatches.filter((e => e !== data.stopwatchId));

		// Check if all stopwatches are removed and clean the journal if so
		if (stopwatches.length === 0) {
			cleanJournal();
		}
	});

	// Handle add event
	socket.on('add', (data) => {
		//console.log(data);
		const event = {
			id: generateEventId(),
			type: 'add',
			stopwatchId: data.stopwatchId,
			time: data.time,
			name: data.name,
			clientId: data.clientId,
			enabled: data.enabled,
		}

		socket.broadcast.emit('add', event);

		eventJournal.push(event);
		saveEventJournal(eventJournal);
		stopwatches.push(data.stopwatchId);
	});

	// Handle lap event
	socket.on('reset', (data) => {
		const event = {
			id: generateEventId(),
			type: 'reset',
			stopwatchId: data.stopwatchId,
			time: data.time,
			clientId: data.clientId,
			enabled: data.enabled,
		};

		socket.broadcast.emit('reset', event);

		eventJournal.push(event);
		saveEventJournal(eventJournal);
	});

	// Handle lap event
	socket.on('toggleEvent', (data) => {
		const event = {
			id: generateEventId(),
			type: data.type,
			stopwatchId: data.stopwatchId,
			time: data.time,
			clientId: data.clientId,
			enabled: data.enabled,
		};

		socket.broadcast.emit('toggleEvent', event);

		eventJournal.push(event);
		saveEventJournal(eventJournal);
	});


	// Handle disconnect event
	socket.on('disconnect', () => {
		console.log('Client disconnected:', socket.id);
	});
});

// Function to generate a unique event ID
function generateEventId() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Function to load events from local storage
function loadEventJournal() {
	try {
		const data = fs.readFileSync('eventJournal.json', 'utf8');
		return JSON.parse(data) || [];
	} catch (error) {
		console.error('Error loading event journal:', error.message);
		return [];
	}
}

// Function to save events to local storage
function saveEventJournal(events) {
	try {
		fs.writeFileSync('eventJournal.json', JSON.stringify(events));
	} catch (error) {
		console.error('Error saving event journal:', error.message);
	}
}

// Function to clean the journal
function cleanJournal() {
	eventJournal = [];
	saveEventJournal(eventJournal);
	console.log('Journal cleaned');
}
