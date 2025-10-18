let socket;
let running = false;
let pulseTime = 0;
let envPulseTime = 0;
let audioCtx, masterGain, analyser, dataArray, bufferLength;
let waveType = "random";
let waveformColor = "#999999";
let lastRandomColor = "#999999";
let activeEnvelopes = []

// Envelope parameters
let attack = 1.0;
let sustain = 0.5;
let decay = 1.5;
let envLevel = 0; // visual envelope level

// Envelope UI
let envPoints = [];
let draggingPoint = null;
let envBox = { x: 40, y: 150, w: 220, h: 80 };

// Waveform UI
let waveSelector;
let waveOptions = ["random", "sine", "square", "sawtooth", "triangle"];

function unlockAudioOnce() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(audioCtx.destination);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    masterGain.connect(analyser);
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
  setupEnvelopePoints();

  socket = io();
  socket.on("state", (state) => (running = state));
  socket.on("pulse", () => {
    pulseTime = millis();
    envPulseTime = millis();
    triggerPulse();
  });

  waveSelector = createSelect();
  for (let w of waveOptions) waveSelector.option(w);
  waveSelector.selected(waveType);
  waveSelector.position(40, 80);
  waveSelector.style("font-size", "14px");
  waveSelector.style("background", "#222");
  waveSelector.style("color", "#fff");
  waveSelector.style("border", "none");
  waveSelector.style("padding", "4px 8px");
  waveSelector.changed(updateWaveColor);
}

function updateWaveColor() {
  const val = waveSelector.value();
  const colors = {
    sine: "#01c0ff",
    square: "#fe0606",
    sawtooth: "#fc9300",
    triangle: "#00ff55",
    random: "#888888",
  };
  waveformColor = colors[val] || "#888888";
}

function setupEnvelopePoints() {
  let { x, y, w, h } = envBox;
  envPoints = [
    { label: "A", x: x, y: y + h },
    { label: "Peak", x: x + w * 0.3, y: y },
    { label: "S", x: x + w * 0.5, y: y + h * 0.4 },
    { label: "D", x: x + w * 0.9, y: y + h },
  ];
}

function draw() {
  background(15);

  // Update visual envelope level
  updateEnvelopeLevel();

  drawAudioLinkedPulse();
  drawSmallPulseIndicator(width - 80, 30);
  drawToggleButton(75, 10);
  drawEnvelopeGraph();

  textAlign(LEFT);
  fill(180);
  text("Input:", 30, 30);
  text("Envelope", envBox.x - 10, envBox.y - 30);
  text("Waveform", 30, 70);
}

// --- Visual Pulse Rendering ---
function drawAudioLinkedPulse() {
  push();
  translate(width / 2, height / 2);

  const baseR = width * 0.15;
  const radius = baseR * (0.6 + envLevel * 0.9); // radius tracks envelope

  // Waveform color
  const currentWave = waveSelector.value();
  const colors = {
    sine: "#01c0ff",
    square: "#fe0606",
    sawtooth: "#fc9300",
    triangle: "#00ff55",
    random: "#999999",
  };
  let col = color(colors[currentWave]);
  if (currentWave === "random" && lastRandomColor) col = color(lastRandomColor);

  // Color intensity follows envelope
  const intensity = map(envLevel, 0, 1, 20, 255);

  // Feathered glow ring
  for (let r = radius * 1.4; r > radius * 0.9; r -= 1.5) {
    const alpha = map(r, radius * 0.9, radius * 1.4, intensity * 0.6, 0);
    fill(red(col), green(col), blue(col), alpha);
    ellipse(0, 0, r * 2);
  }

  // Black inner gradient (darkest centre)
  drawingContext.save();
  const gradient = drawingContext.createRadialGradient(0, 0, 0, 0, 0, radius * 1.4);
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(0.6, "rgba(0,0,0,0.6)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  drawingContext.fillStyle = gradient;
  ellipse(0, 0, radius * 2.3);
  drawingContext.restore();

  pop();
}
function updateEnvelopeLevel() {
  const now = millis();
  // Remove finished envelopes
  activeEnvelopes = activeEnvelopes.filter(e => now < e.endTime);

  // Calculate combined level
  let totalLevel = 0;
  for (let e of activeEnvelopes) {
    const t = (now - e.startTime) / 1000.0;
    let level = 0;

    if (t < attack) {
      // Exponential attack
      level = 1 - Math.exp(-4 * (t / attack));
    } else if (t < attack + sustain) {
      // Sustain hold
      level = 1;
    } else if (t < attack + sustain + decay) {
      // Exponential decay
      const d = t - (attack + sustain);
      level = Math.exp(-3 * (d / decay));
    } else {
      level = 0;
    }

    totalLevel += level;
  }

  // Soft compression so large overlaps don’t blow out visuals
  envLevel = 1 - Math.exp(-totalLevel * 0.8);
}


function drawSmallPulseIndicator(x, y) {
  let elapsed = millis() - pulseTime;
  let active = elapsed < (attack + sustain + decay) * 100;
  fill(active ? "#33ff99" : "#444");
  ellipse(x, y, 20);
  fill(180);
  textAlign(LEFT);
  text("Pulse", x + 20, y);
}

function drawEnvelopeGraph() {
  let { x, y, w, h } = envBox;

  fill(50, 50);
  stroke(80);
  strokeWeight(5);
  rect(x - 10, y - 10, w + 20, h + 20, 6);

  stroke(255);
  strokeWeight(1);
  noFill();
  beginShape();
  for (let p of envPoints) vertex(p.x, p.y);
  endShape();

  noStroke();
  for (let p of envPoints) {
    fill(hovering(p) || draggingPoint === p ? "#33ff99" : "#888");
    ellipse(p.x, p.y, 10);
  }

  attack = round(map(envPoints[1].x - envPoints[0].x, 0, w, 0.05, 2), 2);
  sustain = round(map(1 - (envPoints[2].y - envPoints[1].y) / h, 0, 1, 0.1, 1), 2);
  decay = round(map(envPoints[3].x - envPoints[2].x, 0, w, 0.2, 3), 2);

  fill(200);
  textAlign(LEFT);
  text(`A: ${attack}s`, x, y + h + 25);
  text(`S: ${sustain}`, x + w / 3 + 2, y + h + 25);
  text(`D: ${decay}s`, x + w - w / 3, y + h + 25);
}

function hovering(p) {
  return dist(mouseX, mouseY, p.x, p.y) < 10;
}

function mousePressed() {
  let x = 100, y = 10, w = 80, h = 40;
  if (mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h) {
    running = !running;
    socket.emit("toggle", running);
    return;
  }

  for (let p of envPoints) {
    if (hovering(p)) {
      draggingPoint = p;
      break;
    }
  }
}

function mouseDragged() {
  if (draggingPoint) {
    draggingPoint.x = constrain(mouseX, envBox.x, envBox.x + envBox.w);
    draggingPoint.y = constrain(mouseY, envBox.y, envBox.y + envBox.h);
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
  const millisNow = millis();

  // Track envelope visually
  activeEnvelopes.push({
    startTime: millisNow,
    endTime: millisNow + (attack + sustain + decay) * 1000,
  });

  // --- existing oscillator code below ---
  let type = waveSelector.value();
  const choices = ["sine", "square", "sawtooth", "triangle"];
  if (type === "random") {
    type = random(choices);
    const colorMap = {
      sine: "#01c0ff",
      square: "#fe0606",
      sawtooth: "#fc9300",
      triangle: "#00ff55",
    };
    lastRandomColor = colorMap[type];
  }
  updateWaveColor();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(random(200, 800), now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + attack);
  gain.gain.linearRampToValueAtTime(0.3 * sustain, now + attack + sustain);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + sustain + decay);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + attack + sustain + decay + 0.1);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  waveSelector.position(40, 80);
}