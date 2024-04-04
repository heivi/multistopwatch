# Multi-Stopwatch App
The Multi-Stopwatch App is a simple web application that allows users to create and manage multiple stopwatches simultaneously. Users can start, stop, and reset individual stopwatches, as well as record lap times.

Made using ChatGPT

## Features
- Create multiple stopwatches
- Start, stop, and reset individual stopwatches
- Record lap times
- View a journal of events for each stopwatch
- Toggle event visibility in the journal
- Remove stopwatches
- Recover deleted stopwatches
- Synchronize stopwatches and events across multiple clients

## Technologies Used
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Real-time Communication: Socket.IO
- Time Synchronization: TimeSync
- Persistence: Local Storage
- UI Framework: Bootstrap
- Icons: Font Awesome

## Getting Started
To get started with the Stopwatch App, follow these steps:

1. Clone this repository to your local machine.
1. Install Node.js if you haven't already.
1. Navigate to the project directory in your terminal.
1. Install dependencies by running npm install.
1. Start the server by running node server.js.
1. Open your web browser and go to http://localhost:3000 to access the app.

## Usage
- Creating a Stopwatch: Enter a name for your stopwatch in the input field and click the "Add" button.
- Starting/Stopping a Stopwatch: Click the "Start" button to start the stopwatch and the "Stop" button to stop it.
- Recording Lap Times: Click the "Lap" button to record a lap time while the stopwatch is running.
- Resetting a Stopwatch: Click the "Reset" button to reset the stopwatch to zero.
- Viewing Journal Events: Click the "Journal" button to view a list of events for the stopwatch.
- Toggling Event Visibility: In the journal view, click on each event to toggle its visibility.
- Removing a Stopwatch: Click the "Remove" button to delete the stopwatch.
- Recovering Deleted Stopwatches: Click the "Deleted Stopwatches" button to view and recover deleted stopwatches.

## Contributing
Contributions are welcome! If you find any bugs or have suggestions for improvements, please open an issue or submit a pull request.

## TODO
- Fill sessionId based on URL
- Indicate when offline
- When starting offline, adjust times by the offset after sync
- 

## License
This project is licensed under the MIT License - see the LICENSE file for details.

