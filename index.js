import mic from 'mic';

const micInstance = mic({
  rate: '48000',
  channels: '1',
  debug: false,
  encoding: 'signed-integer',
  bitwidth: 32,
  endian: 'little',
});

const micInputStream = micInstance.getAudioStream();

const THRESHOLD_MULTIPLIER = 5; // spike must be N times larger than local average
const WINDOW_SIZE = 1024;       // number of samples to average
const DEBOUNCE_MS = 5;         // ignore new spikes within 50ms of last spike

let recentAmps = [];
let lastSpikeTime = 0;

micInputStream.on('data', (data) => {
  const now = Date.now();

  for (let i = 0; i < data.length; i += 4) {
    const sample = data.readInt32LE(i);
    const absSample = Math.abs(sample);

    recentAmps.push(absSample);
    if (recentAmps.length > WINDOW_SIZE) recentAmps.shift();

    const avgAmp = recentAmps.reduce((a, b) => a + b, 0) / recentAmps.length;

    if (absSample > avgAmp * THRESHOLD_MULTIPLIER && now - lastSpikeTime > DEBOUNCE_MS) {
      console.log(`⚡ Spike detected! Amplitude: ${sample} | Time: ${new Date().toISOString()}`);
      lastSpikeTime = now;
      recentAmps = []; // reset average so we don't trigger multiple logs
      break; // move to next chunk
    }
  }
});

micInstance.start();
console.log('Listening for Geiger pulses...');