const socket = io();
const toggleButton = document.getElementById('toggleButton');
const restartButton = document.getElementById('restartButton');
const pulseIndicator = document.getElementById('pulseIndicator');

let running = false; // mic-off by default

// Server tells us the actual state (on connect or sync)
socket.on('state', (state) => {
  running = state;
  toggleButton.textContent = running ? 'ON' : 'OFF';
});

// When user clicks the button
toggleButton.addEventListener('click', () => {
  running = !running; // flip local state
  toggleButton.textContent = running ? 'ON' : 'OFF';
  socket.emit('toggle', running); // tell server
});

// Create one shared audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function unlockAudio() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  // Only need to run once, so remove listener
  document.removeEventListener("click", unlockAudio);
}
document.addEventListener("click", unlockAudio);

function playPulseSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // Short high-pitched blip
  osc.type = "square";
  osc.frequency.setValueAtTime(1000, audioCtx.currentTime);

  // Quick envelope (short click-like sound)
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime); // start volume
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

// Pulse indicator + sound
socket.on('pulse', () => {
  pulseIndicator.style.background = 'yellow';
  setTimeout(() => pulseIndicator.style.background = 'grey', 100);

  // play pulse synth
  playPulseSound();
});

// Optional: alert client if server is restarting
socket.on('server-restarting', () => {
  alert('Server is restarting. Please refresh the page.');
});