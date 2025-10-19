// ============================================================
// Geiger-Controlled Synth Visual + Audio Interface
// (Circular waveform redesign v6 — feathered ring, smooth motion)
// ============================================================

let socket, running = false;
let pulseTime = 0;
let audioCtx, masterGain, analyser, dataArray, bufferLength;
let waveType = "random", waveformColor = "#999999", lastRandomColor = "#999999";
let activeEnvelopes = [];

// Envelope defaults
let attack = 0.1, sustainTime = 0.1, sustainLevel = 0.5, decay = 0.7;
let envLevel = 0;

// Envelope UI
let envPoints = [], draggingPoint = null;
let envBox = { x: 40, y: 150, w: 220, h: 80 };

// Waveform options
let waveSelector;
const waveOptions = ["random", "sine", "square", "sawtooth", "triangle"];

// Smoothing buffer
let smoothAmps = [];

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
    smoothAmps = new Array(bufferLength).fill(0);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  document.removeEventListener("click", unlockAudioOnce);
}
document.addEventListener("click", unlockAudioOnce);

// ============================================================
// Setup
// ============================================================
function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
  textAlign(CENTER, CENTER);
  textSize(16);
  applyInitialEnvelopeValues();

  socket = io();
  socket.on("state", (state) => (running = state));
  socket.on("pulse", () => {
    pulseTime = millis();
    triggerPulse();
  });

  // Waveform selector
  waveSelector = createSelect();
  for (let w of waveOptions) waveSelector.option(w);
  waveSelector.selected(waveType);
  waveSelector.position(40, 80);
  waveSelector.style("font-size", "14px");
  waveSelector.style("background", "#222");
  waveSelector.style("color", "#999");
  waveSelector.style("border", "none");
  waveSelector.style("padding", "4px 8px");
  waveSelector.changed(() => {
    waveType = waveSelector.value();
    updateWaveColor();
  });

  updateWaveColor();
}

// ============================================================
// Envelope Setup
// ============================================================
function applyInitialEnvelopeValues() {
  const { x, y, w, h } = envBox;
  const totalTime = Math.max(0.0001, attack + sustainTime + decay);
  const yBottom = y + h;

  envPoints = [
    { label: "A", x: x, y: yBottom },
    { label: "Peak", x: x + (attack / totalTime) * w, y: y },
    { label: "S", x: x + ((attack + sustainTime) / totalTime) * w, y: y + h * (1 - sustainLevel) },
    { label: "D", x: x + w * 0.98, y: yBottom },
  ];
}

// ============================================================
// Draw Loop
// ============================================================
function draw() {
  background(15);
  updateEnvelopeLevel();
  if (analyser && dataArray) analyser.getByteTimeDomainData(dataArray);

  drawCircularWaveform();
  drawSmallPulseIndicator(width - 80, 30);
  drawToggleButton(75, 10);
  drawEnvelopeGraph();

  textAlign(LEFT);
  fill(180);
  text("Input:", 30, 30);
  text("Envelope", envBox.x - 10, envBox.y - 30);
  text("Waveform", 30, 70);
}

// ============================================================
// Circular Waveform Visualization (v10 - symmetric fade gradient)
// ============================================================
function drawCircularWaveform() {
  push();
  translate(width / 2, height / 2);

  const baseR = min(width, height) * 0.25;

  // --- Compute average intensity from audio data ---
  let avg = 0;
  if (dataArray && dataArray.length) {
    for (let i = 0; i < dataArray.length; i++) avg += Math.abs(dataArray[i] - 128);
    avg /= dataArray.length;
  }
  const intensity = constrain(avg / 100, 0, 1);
  const smoothIntensity = lerp(window._prevIntensity || 0, intensity, 0.15);
  window._prevIntensity = smoothIntensity;

  // --- Main ring radius ---
  const ringR = baseR * (1.0 + smoothIntensity * 2.2);

  // --- Determine waveform color ---
  const colorMap = {
    sine: "#01c0ff",
    square: "#fe0606",
    sawtooth: "#fc9300",
    triangle: "#00ff55",
    random: "#999999",
  };
  const mainColor = color(
    waveType === "random" && lastRandomColor ? lastRandomColor : colorMap[waveType] || "#999999"
  );
  const blended = lerpColor(color("#222"), mainColor, pow(smoothIntensity, 0.7));

  // --- Central dark gradient (black in middle) ---
  drawingContext.save();
  const innerGrad = drawingContext.createRadialGradient(0, 0, 0, 0, 0, ringR * 1.1);
  innerGrad.addColorStop(0, "rgba(0,0,0,1)");
  innerGrad.addColorStop(0.6, "rgba(0,0,0,0.8)");
  innerGrad.addColorStop(1, blended.toString());
  drawingContext.fillStyle = innerGrad;
  drawingContext.beginPath();
  drawingContext.arc(0, 0, ringR * 1.1, 0, TWO_PI);
  drawingContext.fill();
  drawingContext.restore();

  // --- Soft symmetric halo around main ring ---
  drawingContext.save();
  const haloGrad = drawingContext.createRadialGradient(0, 0, ringR * 0.6, 0, 0, ringR * 1.8);
  haloGrad.addColorStop(0, "rgba(0,0,0,0)");
  haloGrad.addColorStop(0.45, blended.toString());
  haloGrad.addColorStop(0.55, blended.toString());
  haloGrad.addColorStop(1, "rgba(0,0,0,0)");
  drawingContext.fillStyle = haloGrad;
  drawingContext.beginPath();
  drawingContext.arc(0, 0, ringR * 1.8, 0, TWO_PI);
  drawingContext.fill();
  drawingContext.restore();

  // --- Multi-ring waveform strokes ---
  const maxR = dist(0, 0, width / 2, height / 2) * 1.05;
  const minR = ringR * 0.2;
  const totalSpan = maxR - minR;
  const ringCount = 24;
  const step = totalSpan / ringCount;
  const len = bufferLength || 128;
  const angleOffset = frameCount * 0.1;

  for (let n = 0; n < ringCount; n++) {
    const rBase = minR + n * step;

    // Symmetric fade from main ring
    const distFromRing = abs(rBase - ringR);
    const fade = constrain(map(distFromRing, 0, ringR * 1.2, 1, 0), 0, 1);
    const opacity = pow(fade, 2.0);

    const weight = map(n, 0, ringCount - 1, 2, 6);
    const col = color(
      red(blended),
      green(blended),
      blue(blended),
      255 * opacity
    );

    stroke(col);
    strokeWeight(weight);
    noFill();

    beginShape();
    for (let i = 0; i <= len; i++) {
      const angle = map(i, 0, len, 0, TWO_PI) + angleOffset;
      const sample = dataArray?.[i % dataArray.length] || 128;
      const amp = (sample - 128) / 128.0;
      const smoothed = lerp(smoothAmps[i % len] || 0, amp, 0.25);
      smoothAmps[i % len] = smoothed;

      // All waves move outward (no inversion)
      const r = rBase + abs(smoothed) * 200 * smoothIntensity;
      vertex(r * cos(angle), r * sin(angle));
    }
    endShape(CLOSE);
  }

  pop();
}

// ============================================================
// Pulse Indicator
// ============================================================
function drawSmallPulseIndicator(x, y) {
  const active = millis() - pulseTime < (attack + sustainTime + decay) * 10;
  fill(active ? "#33ff99" : "#555");
  ellipse(x, y, 20);
  fill(180);
  textAlign(LEFT);
  text("Pulse", x + 20, y);
}

// ============================================================
// Envelope Graph
// ============================================================
function drawEnvelopeGraph() {
  const { x, y, w, h } = envBox;
  fill(50, 50);
  stroke(80);
  strokeWeight(5);
  rect(x - 10, y - 10, w + 20, h + 20, 6);

  stroke(255);
  strokeWeight(1);
  noFill();
  beginShape();
  for (const p of envPoints) vertex(p.x, p.y);
  endShape();

  noStroke();
  for (const p of envPoints) {
    fill(hovering(p) || draggingPoint === p ? "#33ff99" : "#888");
    ellipse(p.x, p.y, 10);
  }

  const totalW = envPoints[3].x - envPoints[0].x || w;
  attack = round(map(envPoints[1].x - envPoints[0].x, 0, totalW, 0.01, 4.0), 2);
  sustainTime = round(map(envPoints[2].x - envPoints[1].x, 0, totalW, 0.01, 4.0), 2);
  decay = round(map(envPoints[3].x - envPoints[2].x, 0, totalW, 0.01, 4.0), 2);
  sustainLevel = round(1 - constrain((envPoints[2].y - y) / h, 0, 1), 2);

  const boxW = 70, boxH = 36, boxY = y + h + 20, spacing = 10;
  const boxes = [
    { label: "A", value: `${attack.toFixed(2)}s` },
    { label: "S", value: `${sustainTime.toFixed(2)}s` },
    { label: "D", value: `${decay.toFixed(2)}s` },
  ];
  textAlign(CENTER, CENTER);
  textSize(14);
  boxes.forEach((b, i) => {
    const bx = x + i * (boxW + spacing) - 5;
    fill(30);
    stroke(90);
    strokeWeight(2);
    rect(bx, boxY, boxW, boxH, 6);
    noStroke();
    fill("#33ff99");
    text(b.label, bx + 10, boxY + boxH / 2);
    fill(200);
    textAlign(LEFT, CENTER);
    text(b.value, bx + 25, boxY + boxH / 2);
  });
}

// ============================================================
// Envelope Logic
// ============================================================
function updateEnvelopeLevel() {
  const now = millis();
  activeEnvelopes = activeEnvelopes.filter(e => now < e.endTime);

  let totalLevel = 0;
  for (const e of activeEnvelopes) {
    const t = (now - e.startTime) / 1000.0;
    let level = 0;
    if (t < attack) level = 1 - Math.exp(-4 * (t / attack));
    else if (t < attack + sustainTime) level = sustainLevel;
    else if (t < attack + sustainTime + decay)
      level = sustainLevel * Math.exp(-3 * ((t - attack - sustainTime) / decay));
    totalLevel += level;
  }
  envLevel = constrain(1 - Math.exp(-totalLevel * 0.8), 0, 1);
}

// ============================================================
// Interaction
// ============================================================
function hovering(p) { return dist(mouseX, mouseY, p.x, p.y) < 10; }
function mousePressed() {
  const btn = { x: 100, y: 10, w: 80, h: 40 };
  if (mouseX > btn.x && mouseX < btn.x + btn.w && mouseY > btn.y && mouseY < btn.y + btn.h) {
    running = !running;
    socket.emit("toggle", running);
    return;
  }
  for (const p of envPoints) if (hovering(p)) draggingPoint = p;
}
function mouseDragged() {
  if (draggingPoint) {
    draggingPoint.x = constrain(mouseX, envBox.x, envBox.x + envBox.w);
    draggingPoint.y = constrain(mouseY, envBox.y, envBox.y + envBox.h);
  }
}
function mouseReleased() { draggingPoint = null; }

function drawToggleButton(x, y) {
  const w = 80, h = 40;
  const hover = mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  fill(running ? (hover ? "#33ff99" : "#00cc66") : (hover ? "#ff6666" : "#cc3333"));
  rect(x, y, w, h, 8);
  fill(0);
  textSize(16);
  textAlign(CENTER, CENTER);
  text(running ? "ON" : "OFF", x + w / 2, y + h / 2);
}

// ============================================================
// Sound Logic
// ============================================================
function triggerPulse() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const millisNow = millis();

  activeEnvelopes.push({
    startTime: millisNow,
    endTime: millisNow + (attack + sustainTime + decay) * 1000,
  });

  let type = waveSelector ? waveSelector.value() : waveType;
  const types = ["sine", "square", "sawtooth", "triangle"];
  if (type === "random") {
    type = random(types);
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
  gain.gain.linearRampToValueAtTime(0.5 * sustainLevel, now + attack);
  gain.gain.setValueAtTime(0.5 * sustainLevel, now + attack + sustainTime);
  gain.gain.linearRampToValueAtTime(0.0001, now + attack + sustainTime + decay);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + attack + sustainTime + decay + 0.1);
}

// ============================================================
// Resize & Color
// ============================================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (waveSelector) waveSelector.position(40, 80);
}
function updateWaveColor() {
  const val = waveSelector ? waveSelector.value() : waveType;
  const colors = {
    sine: "#01c0ff",
    square: "#fe0606",
    sawtooth: "#fc9300",
    triangle: "#00ff55",
    random: "#999999",
  };
  waveformColor = colors[val] || "#999999";
  if (waveSelector?.style) waveSelector.style("color", waveformColor);
}