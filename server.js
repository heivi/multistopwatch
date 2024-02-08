// server.js
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
    const event = {
      id: generateEventId(),
      type: 'start',
      stopwatchName: data.stopwatchName,
      startTime: data.startTime,
      clientId: socket.id,
    };

    eventJournal.push(event);
    saveEventJournal(eventJournal);

    io.emit('start', event);
  });

  // Handle stop event
  socket.on('stop', (data) => {
    const event = {
      id: generateEventId(),
      type: 'stop',
      stopwatchName: data.stopwatchName,
      stopTime: data.stopTime,
      clientId: socket.id,
    };

    eventJournal.push(event);
    saveEventJournal(eventJournal);

    io.emit('stop', event);
  });

  // Handle lap event
  socket.on('lap', (data) => {
    const event = {
      id: generateEventId(),
      type: 'lap',
      stopwatchName: data.stopwatchName,
      lapTime: data.lapTime,
      clientId: socket.id,
    };

    eventJournal.push(event);
    saveEventJournal(eventJournal);

    io.emit('lap', event);
  });

  // Handle remove event
  socket.on('removeEvent', (eventId) => {
    const index = eventJournal.findIndex((event) => event.id === eventId);
    if (index !== -1) {
      eventJournal.splice(index, 1);
      saveEventJournal(eventJournal);
      io.emit('eventRemoved', eventId);
    }
  });

  // Handle disconnect event
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Function to generate a unique event ID
function generateEventId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
