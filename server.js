// server.js
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mic from 'mic';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

const PORT = 3000;

// Serve static files
app.use(express.static('./public'));

// Mic setup
let micInstance = null;
let micInputStream = null;

const THRESHOLD_MULTIPLIER = 5;
const WINDOW_SIZE = 1024;
const DEBOUNCE_MS = 50;

let recentAmps = [];
let lastSpikeTime = 0;

const startMic = () => {
  if (micInstance) return;

  micInstance = mic({
    rate: '48000',
    channels: '1',
    debug: false,
    encoding: 'signed-integer',
    bitwidth: 32,
    endian: 'little',
  });

  micInputStream = micInstance.getAudioStream();

  micInputStream.on('data', (data) => {
    const now = Date.now();

    for (let i = 0; i < data.length; i += 4) {
      const sample = data.readInt32LE(i);
      const absSample = Math.abs(sample);

      recentAmps.push(absSample);
      if (recentAmps.length > WINDOW_SIZE) recentAmps.shift();

      const avgAmp = recentAmps.reduce((a, b) => a + b, 0) / recentAmps.length;

      if (absSample > avgAmp * THRESHOLD_MULTIPLIER && now - lastSpikeTime > DEBOUNCE_MS) {
        io.emit('pulse');
        lastSpikeTime = now;
        break;
      }
    }
  });

  micInstance.start();
  console.log('Mic started...');
};

const stopMic = () => {
  if (!micInstance) return;

  micInstance.stop();
  micInstance = null;
  micInputStream = null;
  recentAmps = [];
  lastSpikeTime = 0;
  console.log('Mic stopped...');
};


//change
// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.emit('state', !!micInstance);

  stopMic();
  socket.on('toggle', (state) => {
    if (state) startMic();
    else stopMic();
  });

  socket.on('disconnect', () => console.log('Client disconnected'));
});

// Start server
if (!server.listening) {
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}