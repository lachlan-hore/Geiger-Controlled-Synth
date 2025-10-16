let socket;
let running = false;
let pulseTime = 0;
let audioCtx, masterGain;
let waveType = "sine";

// Envelope parameters (seconds)
let attack = 1.0;
let sustain = 0.5;
let decay = 1.5;

// Envelope UI points
let envPoints = [];
let draggingPoint = null;

// Waveform options
let waveSelector;
let waveOptions = ["sine", "square", "sawtooth", "triangle"];

// Unlock audio context once
function unlockAudioOnce() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7; // global limiter
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  document.removeEventListener("click", unlockAudioOnce);
}
document.addEventListener("click", unlockAudioOnce);

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(16);

  // Initialize envelope graph points
  setupEnvelopePoints();

  // Socket setup
  socket = io();
  socket.on("state", (state) => (running = state));
  socket.on("pulse", () => {
    pulseTime = millis();
    triggerPulse();
  });

  // Wave selector (styled in canvas area)
  waveSelector = createSelect();
  for (let w of waveOptions) waveSelector.option(w);
  waveSelector.selected(waveType);
  waveSelector.position(30, height - 50);
  waveSelector.style("font-size", "14px");
  waveSelector.style("background", "#222");
  waveSelector.style("color", "#fff");
  waveSelector.style("border", "none");
  waveSelector.style("padding", "4px 8px");
}

function setupEnvelopePoints() {
  let x0 = 40;
  let y0 = 120;
  let w = 200;
  let h = 80;
  envPoints = [
    { label: "A", x: x0, y: y0 + h },            // start
    { label: "Peak", x: x0 + w * 0.3, y: y0 },   // attack peak
    { label: "S", x: x0 + w * 0.5, y: y0 + h * 0.4 }, // sustain
    { label: "D", x: x0 + w * 0.9, y: y0 + h },  // decay end
  ];
}

function draw() {
  background(15);

  // Pulse visual
  let elapsed = millis() - pulseTime;
  let fade = map(constrain(elapsed, 0, 200), 0, 200, 1, 0);
  let pulseSize = lerp(100, 300, fade);
  fill(255, 80 * fade, 80 * fade);
  ellipse(width / 2, height / 2, pulseSize);

  // Draw Input label + button
  fill(200);
  textAlign(LEFT, CENTER);
  text("Input:", 30, 30);
  drawToggleButton(100, 10);

  // Draw envelope UI
  drawEnvelopeGraph();

  // Labels
  textAlign(LEFT);
  fill(180);
  text("Envelope", 40, 90);
  text("Waveform", 30, height - 70);
}

function drawEnvelopeGraph() {
  stroke(255);
  noFill();

  // Line connecting envelope points
  beginShape();
  for (let p of envPoints) vertex(p.x, p.y);
  endShape();

  // Points
  noStroke();
  for (let p of envPoints) {
    fill(hovering(p) || draggingPoint === p ? "#33ff99" : "#888");
    ellipse(p.x, p.y, 10);
  }

  // Update ADS from positions
  let w = envPoints[3].x - envPoints[0].x;
  attack = map(envPoints[1].x - envPoints[0].x, 0, w, 0.01, 2);
  sustain = map(1 - (envPoints[2].y - envPoints[1].y) / 80, 0, 1, 0.1, 1);
  decay = map(envPoints[3].x - envPoints[2].x, 0, w, 0.1, 3);

  fill(180);
  textAlign(LEFT);
  textSize(13);
  text(`A: ${attack.toFixed(2)}s`, 260, 130);
  text(`S: ${sustain.toFixed(2)}`, 260, 150);
  text(`D: ${decay.toFixed(2)}s`, 260, 170);
}

function hovering(p) {
  return dist(mouseX, mouseY, p.x, p.y) < 10;
}

function mousePressed() {
  // Check button click
  let x = 100, y = 10, w = 80, h = 40;
  if (mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h) {
    running = !running;
    socket.emit("toggle", running);
    return;
  }

  // Envelope dragging
  for (let p of envPoints) {
    if (hovering(p)) {
      draggingPoint = p;
      break;
    }
  }
}

function mouseDragged() {
  if (draggingPoint) {
    draggingPoint.x = constrain(mouseX, 40, 260);
    draggingPoint.y = constrain(mouseY, 100, 200);
  }
}

function mouseReleased() {
  draggingPoint = null;
}

function drawToggleButton(x, y) {
  let btnWidth = 80;
  let btnHeight = 40;
  let hover = mouseX > x && mouseX < x + btnWidth && mouseY > y && mouseY < y + btnHeight;

  fill(running ? (hover ? "#33ff99" : "#00cc66") : (hover ? "#ff6666" : "#cc3333"));
  rect(x, y, btnWidth, btnHeight, 8);

  fill(0);
  textSize(16);
  textAlign(CENTER, CENTER);
  text(running ? "ON" : "OFF", x + btnWidth / 2, y + btnHeight / 2);
}

// --- Sound Logic ---
function triggerPulse() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = waveSelector.value();
  osc.frequency.setValueAtTime(random(200, 800), now);

  // Envelope
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + attack);
  gain.gain.linearRampToValueAtTime(0.3 * sustain, now + attack + sustain);
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + sustain + decay);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + attack + sustain + decay + 0.1);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  waveSelector.position(30, height - 50);
}