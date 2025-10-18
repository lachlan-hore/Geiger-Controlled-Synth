// server.js
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mic from 'mic';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

const PORT = 3000;
app.use(express.static('./public'));

// --- Pulse detection config ---
const THRESHOLD_MULTIPLIER = 8;
const WINDOW_SIZE = 1024;
const DEBOUNCE_MS = 50;

let micInstance = null;
let micInputStream = null;
let recentAmps = [];
let lastSpikeTime = 0;

function createMic() {
  return mic({
    rate: '48000',
    channels: '1',
    debug: false,
    encoding: 'signed-integer',
    bitwidth: 32,
    endian: 'little',
  });
}

function startMic() {
  if (micInstance) return;
  micInstance = createMic();
  micInputStream = micInstance.getAudioStream();

  micInputStream.on('error', (err) => console.error('Mic stream error:', err));

  micInputStream.on('data', (data) => {
    const now = Date.now();
    for (let i = 0; i + 4 <= data.length; i += 4) {
      const sample = data.readInt32LE(i);
      const absSample = Math.abs(sample);

      recentAmps.push(absSample);
      if (recentAmps.length > WINDOW_SIZE) recentAmps.shift();

      if (recentAmps.length < 8) continue; // wait until we have some history

      // use RMS to be a bit more robust
      const rms = Math.sqrt(recentAmps.reduce((s, v) => s + v * v, 0) / recentAmps.length);

      // minimum absolute floor to avoid tiny-rms issues
      const floor = 15000;
      const threshold = Math.max(rms * THRESHOLD_MULTIPLIER, floor);

      if (absSample > threshold && now - lastSpikeTime > DEBOUNCE_MS) {
        lastSpikeTime = now;
        io.emit('pulse');
        break; // proceed to next incoming chunk
      }
    }
  });

  micInstance.start();
  console.log('Mic started');
}

function stopMic() {
  if (!micInstance) return;
  try {
    micInstance.stop();
  } catch (e) { /* ignore */ }
  micInstance = null;
  micInputStream = null;
  recentAmps = [];
  lastSpikeTime = 0;
  console.log('Mic stopped');
}

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  // on connect tell client current state
  socket.emit('state', !!micInstance);

  socket.on('toggle', (state) => {
    if (state) startMic();
    else stopMic();
    io.emit('state', !!micInstance); // broadcast new state
  });

  socket.on('disconnect', () => console.log('Client disconnected', socket.id));
});

// --- Start server ---
if (!server.listening) {
  server.listen(PORT, () => console.log(`Server listening: http://localhost:${PORT}`));
}
