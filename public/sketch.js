let socket, running = false;
let pulseTime = 0;
let audioCtx, masterGain, analyser, dataArray, bufferLength;
let activeEnvelopes = [];

// Master output & CPM tracking
let masterSlider;
let pulseHistory = [];
let cpm = 0;
let outputAmplitude = 0;

// Envelope defaults
let attack = 0.1, sustainTime = 0.1, sustainLevel = 0.5, decay = 0.7;
let envLevel = 0;

// Envelope UI
let envPoints = [], draggingPoint = null;
let envBox = { x: 40, y: 180, w: 220, h: 80 };

// Waveform options
let waveSelector;
const waveOptions = ["random", "sine", "square", "sawtooth", "triangle"];
let lastWaveType = "sine";

// Pitch selection
const SEMITONES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
let enabledNotes = new Array(12).fill(true);

let enabledOctaves = new Array(10).fill(false);
for (let i = 1; i <= 5; i++) enabledOctaves[i] = true;

let noteFlashTimers = new Array(12).fill(0);
let octaveFlashTimers = new Array(10).fill(0);
const BASE_FREQ = 440; // A4 reference

let pitchModuleX, pitchModuleY;

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

// Setup
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

  // --- Waveform toggle buttons ---
  const waveChoices = ["sine", "square", "sawtooth", "triangle"];
  let buttonX = 40, buttonY = 90, buttonW = 80, buttonH = 32, spacing = 12;
  waveButtons = {};
  activeWaves = { sine: true, square: true, sawtooth: false, triangle: false };

  for (let w of waveChoices) {
    const btn = createButton(w);
    btn.position(buttonX, buttonY);
    btn.size(buttonW, buttonH);
    btn.style("background", "#222");
    btn.style("color", activeWaves[w] ? "#fff" : "#999");
    btn.style("border", "none");
    btn.style("border-radius", "6px");
    btn.style("font-size", "14px");
    btn.style("cursor", "pointer");

    btn.mousePressed(() => {
      activeWaves[w] = !activeWaves[w];
      updateWaveButtonStyles();
    });

    btn.mouseOver(() => btn.style("filter", "brightness(1.3)"));
    btn.mouseOut(() => btn.style("filter", "brightness(1)"));

    waveButtons[w] = btn;
    buttonX += buttonW + spacing;
  }

  updateWaveButtonStyles();

  pitchModuleX = 120;
  pitchModuleY = height - 130;
  // --- Master Output Vertical Slider ---
  const sliderHeight = 220;
  masterSlider = new VerticalSlider(width - 60, height - 50, sliderHeight, 0, 1, 0.7, "OUT");
}

// Envelope Setup
function applyInitialEnvelopeValues() {
  const { x, y, w, h } = envBox;
  const yBottom = y + h;

  envPoints = [
    { label: "A", x: x, y: yBottom },
    { label: "Peak", x: x + w * 0.25, y: y },
    { label: "S", x: x + w * 0.6, y: y + h * 0.4 },
    { label: "D", x: x + w, y: yBottom },
  ];
}

// Draw Loop
function draw() {
  background(15);
  updateEnvelopeLevel();
  if (analyser && dataArray) analyser.getByteTimeDomainData(dataArray);
  
  drawPulseTimeline();
  drawCircularWaveform();
  drawToggleButton(80, 10);
  drawEnvelopeGraph();
  drawPitchModule();

  updateCPM();

  // --- Master Output Slider ---
  masterSlider.update();
  masterSlider.draw(outputAmplitude);
  if (masterGain) masterGain.gain.value = masterSlider.value;

  // --- Text Labels with Bounding Boxes ---
  drawLabelBox(10, 10, "Input:");
  drawLabelBox(envBox.x - 10, envBox.y - 45, "Envelope");
  drawLabelBox(30, 55, "Waveform");
  drawLabelBox(width - 100, 17, "    Pulse");
  drawLabelBox(width - 100, 50, "     CPM");
  drawLabelBox(30, height - 245, "Pitch Control");

  drawSmallPulseIndicator(width - 85, 30);
  // CPM numeric value
  textAlign(RIGHT);
  fill(180);
  text(`${cpm}`, width - 70, 64);
}


// CPM Update
function updateCPM() {
  const millisNow = millis();
  const oneMinuteAgo = millisNow - 60000;
  pulseHistory = pulseHistory.filter(p => p.time > oneMinuteAgo);
  cpm = pulseHistory.length;
}

function updateWaveButtonStyles() {
  const colorMap = {
    sine: "#01c0ff",
    square: "#fe0606",
    sawtooth: "#fc9300",
    triangle: "#00ff55"
  };
  for (const w in waveButtons) {
    const btn = waveButtons[w];
    if (!btn) continue;
    const active = activeWaves[w];
    btn.style("background", active ? colorMap[w] : "#222");
    btn.style("color", active ? "#fff" : "#999");
  }
}

function drawCircularWaveform() {
  push();
  translate(width / 2, height / 2);

  const baseR = min(width, height) * 0.25;

  // --- Compute average intensity ---
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
    lastWaveType === "random" && lastRandomColor ? lastRandomColor : colorMap[lastWaveType] || "#999999"
  );
  const blended = lerpColor(color("#222"), mainColor, pow(smoothIntensity, 0.7));

  // Transparent feathered center — visible waveform behind it
  drawingContext.save();
  const innerGrad = drawingContext.createRadialGradient(0, 0, 0, 0, 0, ringR * 1.4);
  innerGrad.addColorStop(0, "rgba(0,0,0,0.8)");   // darkest in center
  innerGrad.addColorStop(0.3, "rgba(0,0,0,0.6)");
  innerGrad.addColorStop(0.6, "rgba(0,0,0,0.3)");
  innerGrad.addColorStop(1, "rgba(0,0,0,0)");     // fades out fully
  drawingContext.fillStyle = innerGrad;
  drawingContext.beginPath();
  drawingContext.arc(0, 0, ringR * 1.4, 0, TWO_PI);
  drawingContext.fill();
  drawingContext.restore();

  // --- Soft symmetric halo (outer glow) ---
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
    const distFromRing = abs(rBase - ringR);
    const fade = constrain(map(distFromRing, 0, ringR * 1.2, 1, 0), 0, 1);
    const opacity = pow(fade, 2.0);
    const weight = map(n, 0, ringCount - 1, 2, 6);
    const col = color(red(blended), green(blended), blue(blended), 255 * opacity);

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
      const r = rBase + abs(smoothed) * 200 * smoothIntensity;
      vertex(r * cos(angle), r * sin(angle));
    }
    endShape(CLOSE);
  }

  pop();
}

// Pulse Indicator
function drawSmallPulseIndicator(x, y) {
  // Active if a pulse occurred in the last 150 ms
  const recentPulse = pulseHistory[pulseHistory.length - 1];
  const active = recentPulse && millis() - recentPulse.time < 150;

  fill(active ? "#33ff99" : "#444");
  noStroke();
  ellipse(x, y, 20);
}

function drawPulseTimeline() {
  const now = millis();
  const oneMinute = 60000;
  const startX = width;
  const endX = 0;
  const baseY = height;

  for (const p of pulseHistory) {
    const age = now - p.time;
    if (age > oneMinute) continue;

    const x = map(age, 0, oneMinute, startX, endX);
    const alpha = map(age, 0, oneMinute, 255, 0);
    const c = color(p.color);

    stroke(red(c), green(c), blue(c), alpha);
    strokeWeight(2.5);
    line(x, 0, x, baseY);
  }
}

// Envelope Graph
function drawEnvelopeGraph() {
  const { x, y, w, h } = envBox;

  // Background panels
  fill(100, 50);
  noStroke();
  rect(x - 20, y - 50, w + 40, h + 115, 10);

  fill(0, 70);
  stroke(80);
  strokeWeight(2);
  rect(x - 10, y - 10, w + 20, h + 20, 6);

  // --- Semi-transparent grid ---
  stroke(80, 80);
  strokeWeight(1);
  for (let gx = x; gx <= x + w; gx += w / 10) line(gx, y, gx, y + h);
  for (let gy = y; gy <= y + h; gy += h / 10) line(x, gy, x + w, gy);

  // --- Envelope curve ---
  stroke(255);
  strokeWeight(1.5);
  noFill();
  beginShape();
  for (const p of envPoints) vertex(p.x, p.y);
  endShape();

  // --- Envelope points ---
  noStroke();
  for (const p of envPoints) {
    fill(hovering(p) || draggingPoint === p ? "#33ff99" : "#888");
    ellipse(p.x, p.y, 10);
  }

  // --- Segment durations ---
  const aSeg = envPoints[1].x - envPoints[0].x;
  const sSeg = envPoints[2].x - envPoints[1].x;
  const dSeg = envPoints[3].x - envPoints[2].x;

  // Allow closer point spacing (less minimum gap)
  const totalW = envBox.w;
  attack = round(max(0.05, map(aSeg, 0, totalW, 0.05, 8.0)), 2);
  sustainTime = round(max(0.05, map(sSeg, 0, totalW, 0.05, 8.0)), 2);
  decay = round(max(0.05, map(dSeg, 0, totalW, 0.05, 8.0)), 2);
  sustainLevel = round(1 - constrain((envPoints[2].y - y) / h, 0, 1), 2);

  // --- Parameter boxes ---
  const boxW = 70, boxH = 36, boxY = y + h + 20, spacing = 10;
  const boxes = [
    { label: "A", value: `${attack.toFixed(3)}s` },
    { label: "S", value: `${sustainTime.toFixed(3)}s` },
    { label: "D", value: `${decay.toFixed(3)}s` },
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

  outputAmplitude = envLevel;
}

// PITCH MODULE
function drawPitchModule() {
  push();
  translate(pitchModuleX, pitchModuleY);
  const outerR = 80, innerR = 50;
  const segAngle = TWO_PI / 12;
  const relX = mouseX - pitchModuleX;
  const relY = mouseY - pitchModuleY;
  const mouseR = dist(0, 0, relX, relY);
  const mouseA = (atan2(relY, relX) + TWO_PI) % TWO_PI;

  const colorMap = {
    sine: "#01c0ff",
    square: "#fe0606",
    sawtooth: "#fc9300",
    triangle: "#00ff55",
    random: "#999999",
  };
  //bounding box
  fill(100, 50);
  strokeWeight(0);
  rect(-100, -120, 240, 235, 10);

  let hovered = -1;
  for (let i = 0; i < 12; i++) {
    const a1 = -HALF_PI + segAngle * i - 0.0001;
    const a2 = a1 + segAngle;
    const mid = (a1 + a2) / 2;
    const active = enabledNotes[i];
    const flashed = millis() - noteFlashTimers[i] < 180;

    // Normalize angles to 0..TWO_PI range
    const norm = (a) => (a + TWO_PI) % TWO_PI;
    const mA = norm(mouseA);
    const n1 = norm(a1);
    const n2 = norm(a2);

    let inArc = false;
    if (n1 < n2) inArc = mA >= n1 && mA < n2;
    else inArc = mA >= n1 || mA < n2; // wraparound segment case

    if (mouseR >= innerR && mouseR <= outerR && inArc) hovered = i;

    let c = "#222";
    if (flashed) {
      c = colorMap[lastWaveType];
    } else if (hovered === i && active) {
      c = lerpColor(color("#555"), color(colorMap[lastWaveType]), 0.6).toString();
    } else if (hovered === i) {
      c = "#444";
    } else if (active) {
      c = "#555";
    }

    fill(c);
    noStroke();
    beginShape();
    for (let a = a1; a <= a2; a += 0.02) vertex(cos(a) * outerR, sin(a) * outerR);
    for (let a = a2; a >= a1; a -= 0.02) vertex(cos(a) * innerR, sin(a) * innerR);
    endShape(CLOSE);

    fill(200);
    textAlign(CENTER, CENTER);
    text(SEMITONES[i], cos(mid) * 65, sin(mid) * 65);
  }

  // --- Octave buttons ---
  const startX = outerR + 30;
  const startY = -((enabledOctaves.length - 1) * 22) / 2;
  const w = 36, h = 18;

  for (let o = 9; o >= 0; o--) {
    const y = startY + (9 - o) * 22;
    const x = startX;
    const active = enabledOctaves[o];
    const flashed = millis() - octaveFlashTimers[o] < 180;
    const hover = mouseX > pitchModuleX + x - w / 2 &&
                  mouseX < pitchModuleX + x + w / 2 &&
                  mouseY > pitchModuleY + y - h / 2 &&
                  mouseY < pitchModuleY + y + h / 2;

    let c = active ? "#666" : "#222";
    if (flashed) c = colorMap[lastWaveType];
    else if (hover) c = "#444";

    fill(c);
    rect(x - w / 2, y - h / 2, w, h, 6);
    fill("#ddd");
    text(o, x, y + 1);
  }
  pop();
}

// Interaction
function hovering(p) { return dist(mouseX, mouseY, p.x, p.y) < 10; }
function mousePressed() {
  // --- Note clicks ---
  const relX = mouseX - pitchModuleX;
  const relY = mouseY - pitchModuleY;
  const r = dist(0, 0, relX, relY);
  const a = (atan2(relY, relX) + TWO_PI) % TWO_PI;
  const innerR = 50;
  const outerR = 80;
  const segAngle = TWO_PI / 12;

  for (let i = 0; i < 12; i++) {
    const a1 = (-HALF_PI + segAngle * i + TWO_PI) % TWO_PI;
    const a2 = (a1 + segAngle) % TWO_PI;

    let inArc = false;
    if (a1 < a2) inArc = a >= a1 && a < a2;
    else inArc = a >= a1 || a < a2; // handle wrap-around at 0 radians

    if (inArc && r >= innerR && r <= outerR) {
      enabledNotes[i] = !enabledNotes[i];
      return;
    }
  }

  // --- Octave clicks ---
  const startX = pitchModuleX + outerR + 30;
  const startY = pitchModuleY - ((enabledOctaves.length - 1) * 22) / 2;
  const w = 36, h = 18;
  for (let o = 9; o >= 0; o--) {
    const y = startY + (9 - o) * 22;
    if (mouseX > startX - w / 2 && mouseX < startX + w / 2 &&
        mouseY > y - h / 2 && mouseY < y + h / 2) {
      enabledOctaves[o] = !enabledOctaves[o];
      return;
    }
  }

  // --- Input toggle ---
  const btn = { x: 100, y: 10, w: 80, h: 40 };
  if (mouseX > btn.x && mouseX < btn.x + btn.w && mouseY > btn.y && mouseY < btn.y + btn.h) {
    running = !running;
    socket.emit("toggle", running);
    return;
  }

  for (const p of envPoints) if (hovering(p)) draggingPoint = p;
  masterSlider.pressed();
}
function mouseDragged() {
  if (draggingPoint) {
    const i = envPoints.indexOf(draggingPoint);
    const minX = i > 0 ? envPoints[i - 1].x + 5 : envBox.x;
    const maxX = i < envPoints.length - 1 ? envPoints[i + 1].x - 5 : envBox.x + envBox.w;

    draggingPoint.x = constrain(mouseX, minX, maxX);
    draggingPoint.y = constrain(mouseY, envBox.y, envBox.y + envBox.h);

    // Keep baseline/top points fixed vertically
    if (draggingPoint.label === "A" || draggingPoint.label === "D") {
      draggingPoint.y = envBox.y + envBox.h;
    } else if (draggingPoint.label === "Peak") {
      draggingPoint.y = envBox.y;
    }
  }
  masterSlider.update();
}
function mouseReleased() {
  draggingPoint = null;
  masterSlider.released();
}

function drawToggleButton(x, y) {
  const w = 80, h = 40;
  const hover = mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  strokeWeight(0);
  fill(running ? (hover ? "#33ff99" : "#00cc66") : (hover ? "#ff6666" : "#cc3333"));
  rect(x, y, w, h, 8);
  fill(0);
  textSize(16);
  textAlign(CENTER, CENTER);
  text(running ? "ON" : "OFF", x + w / 2, y + h / 2);
}

// Sound Logic
function triggerPulse() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const millisNow = millis();

  const activeList = Object.keys(activeWaves).filter(k => activeWaves[k]);
  let type = activeList.length > 0 ? random(activeList) : "sine";
  lastWaveType = type;
  const colorMap = {
    sine: "#01c0ff",
    square: "#fe0606",
    sawtooth: "#fc9300",
    triangle: "#00ff55",
  };
  lastRandomColor = colorMap[type];
  lastWaveType = type;
  const pulseColor = colorMap[type] || "#999999";
  pulseHistory.push({ time: millisNow, color: pulseColor });
  pulseHistory = pulseHistory.filter(p => millisNow - p.time < 60000);

  activeEnvelopes.push({
    startTime: millisNow,
    endTime: millisNow + (attack + sustainTime + decay) * 1000,
  });

  // --- Pick random enabled pitch ---
  const availNotes = SEMITONES.map((n, i) => (enabledNotes[i] ? i : null)).filter(v => v !== null);
  const availOcts = enabledOctaves.map((v, i) => (v ? i : null)).filter(v => v !== null);
  if (availNotes.length === 0 || availOcts.length === 0) return;

  const noteIdx = random(availNotes);
  const oct = random(availOcts);
  const midi = 12 * (oct + 1) + noteIdx;
  const freq = BASE_FREQ * Math.pow(2, (midi - 69) / 12);

  // Flash the correct note/octave button
  noteFlashTimers[noteIdx] = millis();
  octaveFlashTimers[oct] = millis();

  // --- Audio ---
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.5 * sustainLevel, now + attack);
  gain.gain.setValueAtTime(0.5 * sustainLevel, now + attack + sustainTime);
  gain.gain.linearRampToValueAtTime(0.0001, now + attack + sustainTime + decay);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + attack + sustainTime + decay + 0.1);
}

// Resize & Color
function windowResized() {
  const minW = 500;  // prevent overlap on width
  const minH = 600;  // prevent overlap on height
  resizeCanvas(max(windowWidth, minW), max(windowHeight, minH));
  
  // Reposition waveform buttons
  if (waveButtons) {
    let buttonX = 40, buttonY = 90, buttonW = 80, spacing = 12;
    for (const w of ["sine", "square", "sawtooth", "triangle"]) {
      if (waveButtons[w]) {
        waveButtons[w].position(buttonX, buttonY);
        buttonX += buttonW + spacing;
      }
    }
  }
   // Update slider
  if (masterSlider) {
    const sliderHeight = min(220, height * 0.3); // scale a bit with window size
    masterSlider.x = width - 60;
    masterSlider.y = height - 50;
    masterSlider.h = sliderHeight;
  }
  pitchModuleX = 120;
  pitchModuleY = height - 130;
}

function drawLabelBox(x, y, textStr, align = LEFT) {
  textSize(16);
  const paddingX = 12, paddingY = 6;
  const textW = textWidth(textStr);
  const boxW = textW + paddingX * 2;
  const boxH = 28;

  // --- Calculate box position based on alignment ---
  let xBox = x, yBox = y;
  if (align === CENTER) xBox -= boxW / 2;
  else if (align === RIGHT) xBox -= boxW;

  // --- Draw box ---
  noStroke();
  fill(25, 180);
  rect(xBox, yBox, boxW, boxH, 6);

  // --- Draw text centered inside box ---
  
  fill(200);
  textAlign(CENTER, CENTER);
  text(textStr, xBox + boxW / 2, yBox + boxH / 2);
}

// VerticalSlider Class
class VerticalSlider {
  constructor(x, y, h, min, max, value, label) {
    this.x = x;
    this.y = y;
    this.h = h;
    this.w = 18;
    this.min = min;
    this.max = max;
    this.value = value;
    this.label = label;
    this.active = false;
    this.smoothAmp = 0;
  }

  draw(currentAmp) {
    this.smoothAmp = lerp(this.smoothAmp, currentAmp, 0.15);
    const bottom = this.y, top = this.y - this.h;
    const valY = map(this.value, this.min, this.max, bottom, top, true);
    const ampY = map(this.smoothAmp, this.min, this.max, bottom, top, true);

    noStroke();fill(100, 50);
    rect(this.x - this.w, top - 10, this.w + 40, this.h + 45, 10);

    fill(40); rect(this.x, top, this.w, this.h, 5);
    fill(80); rect(this.x, ampY, this.w, bottom - ampY, 5);
    fill(25, 180); rect(this.x, top, this.w, valY - top, 5);
    stroke(180); strokeWeight(2); line(this.x, valY, this.x + this.w, valY);
    if (this.active) { stroke("#33ff99"); strokeWeight(3); line(this.x, valY, this.x + this.w, valY); }

    noStroke(); fill(200); textAlign(CENTER, CENTER); textSize(14);
    text(this.label, this.x + this.w / 2, bottom + 20);
  }

  update() {
    if (this.active) {
      const newVal = map(mouseY, this.y, this.y - this.h, this.min, this.max, true);
      this.value = constrain(newVal, this.min, this.max);
    }
  }

  pressed() {
    const withinX = mouseX > this.x && mouseX < this.x + this.w;
    const withinY = mouseY < this.y && mouseY > this.y - this.h;
    if (withinX && withinY) this.active = true;
  }

  released() { this.active = false; }
}