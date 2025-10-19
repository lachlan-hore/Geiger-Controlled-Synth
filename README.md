# Geiger-Controlled-Synth

Turn Geiger counter pulses (via audio input) into sound synthesis and interactive visualizations.

---

## Overview

**Geiger-Controlled-Synth** transforms real-time radiation detection into a dynamic audio-visual performance tool.  
Each pulse detected from the Geiger counter triggers a sound with a customizable **attack–sustain–decay** envelope, while the visuals respond with color, brightness, and pulse overlap — creating a living, reactive display of invisible energy.

This version (v0.1.4) enhances expressiveness with more vivid waveform colors, improved random waveform behavior, and optimized visual rendering for smoother performance.

---

## System Architecture

### **Server (Node.js)**
- Uses [`mic`](https://www.npmjs.com/package/mic) to listen to the audio input.
- Detects pulses above a noise threshold and debounces false positives.
- Sends real-time `pulse` events to all connected clients via [Socket.IO](https://socket.io/).

### **Client (Browser)**
- Receives `pulse` events from the server.
- Generates sound using the Web Audio API with envelope shaping and multiple oscillator types.
- Displays a central **pulsing visual** that responds to the audio envelope.
- Provides real-time waveform selection and envelope editing via UI controls.

---

## New Features (v0.1.4)
### **Visual Feedback**
- Expanding glowing circle with gradient-based shading.
- Colors correspond to waveform type (e.g., sine = cyan, saw = orange, etc.).
- On random mode, the color reflects the waveform selected for that specific pulse.
- Larger and smoother circle rendering for a more fluid and immersive effect.

### **UI Controls**
- Waveform selector dropdown with live visual color feedback.
- Small pulse indicator showing recent activity bursts.

### **Bug Fix**
- Fixed browser refresh breaking running state of program by turning off mic on client disconnetion
---

## Installation

### Requirements
- Node.js v20+
- Audio line-in from Geiger counter or pulse generator
- (Optional) [Nodemon](https://www.npmjs.com/package/nodemon) for auto-restarts

### Setup
```bash
git clone https://github.com/lachlan-hore/Geiger-Controlled-Synth.git
cd Geiger-Controlled-Synth
npm install
./start_server.sh