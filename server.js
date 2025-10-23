import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mic from 'mic';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);
const PORT = 3000;

app.use(express.static('./public'));

// -------------------------------
// CONFIGURATION
// -------------------------------
const SAMPLE_RATE = 44100;       // 44.1kHz is fine for Geiger audio
const BIT_DEPTH = 16;            // 16-bit is plenty; faster processing
const DEBOUNCE_MS = 100;         // Minimum time between pulses
const BASE_FLOOR = 3000;         // Minimum absolute amplitude to be considered
const SPIKE_MULTIPLIER = 5;      // Must exceed smoothed baseline by this factor
const BASELINE_DECAY = 0.999;    // Long-term baseline smoothing (0.99–0.999 typical)
const STARTUP_IGNORE_MS = 1000;  // Ignore first second after starting mic

// -------------------------------
// STATE
// -------------------------------
let micInstance = null;
let micInputStream = null;
let baseline = 0;
let lastPulseTime = 0;
let startedAt = 0;
let clientCount = 0;

// -------------------------------
// MIC SETUP
// -------------------------------
function createMic() {
  return mic({
    rate: String(SAMPLE_RATE),
    channels: '1',
    bitwidth: BIT_DEPTH,
    encoding: 'signed-integer',
    endian: 'little',
    debug: false,
  });
}

function startMic() {
  if (micInstance) return;
  baseline = 0;
  lastPulseTime = 0;
  startedAt = Date.now();

  micInstance = createMic();
  micInputStream = micInstance.getAudioStream();

  micInputStream.on('error', (err) => console.error('Mic error:', err));

  micInputStream.on('data', (data) => {
    const now = Date.now();
    if (now - startedAt < STARTUP_IGNORE_MS) return; // ignore startup noise

    // Process 16-bit samples
    for (let i = 0; i + 2 <= data.length; i += 2) {
      const sample = Math.abs(data.readInt16LE(i));

      // Update baseline using exponential smoothing (ignores sudden spikes)
      baseline = BASELINE_DECAY * baseline + (1 - BASELINE_DECAY) * sample;

      const dynamicThreshold = Math.max(BASE_FLOOR, baseline * SPIKE_MULTIPLIER);

      // Trigger pulse if clearly above dynamic threshold
      if (sample > dynamicThreshold && now - lastPulseTime > DEBOUNCE_MS) {
        lastPulseTime = now;
        io.emit('pulse');
        break; // one pulse per chunk
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
  } catch (e) {}
  micInstance = null;
  micInputStream = null;
  baseline = 0;
  lastPulseTime = 0;
  console.log('Mic stopped');
}

// -------------------------------
// SOCKET CONNECTION
// -------------------------------
io.on('connection', (socket) => {
  clientCount++;
  console.log(`Client connected: ${socket.id} (${clientCount} total)`);

  socket.emit('state', !!micInstance);

  socket.on('toggle', (state) => {
    if (state) startMic();
    else stopMic();
    io.emit('state', !!micInstance);
  });

  socket.on('disconnect', () => {
    clientCount--;
    console.log(`Client disconnected: ${socket.id} (${clientCount} left)`);
    if (clientCount <= 0) {
      stopMic();
      io.emit('state', false);
    }
  });
});

// -------------------------------
// START SERVER
// -------------------------------
server.listen(PORT, () => {
  console.log(`Server listening: http://localhost:${PORT}`);
});