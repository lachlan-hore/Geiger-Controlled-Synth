# Geiger-Controlled-Synth

Turn Geiger counter pulses (via audio input) into sound synthesis and interactive visualizations.

---

## Overview

**Geiger-Controlled-Synth** transforms real-time radiation detection into a dynamic audio-visual performance tool.  
Each pulse detected from the Geiger counter triggers a sound with a customizable **attack–sustain–decay** envelope, while the visuals respond with color, brightness, and pulse overlap — creating a living, reactive display of invisible energy.

This version introduces an expressive synthesis engine, envelope shaping, and waveform-based visual feedback.

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

## Features (v0.3)

### 🧠 **Audio Engine**
- Supports **sine**, **square**, **sawtooth**, **triangle**, and **random** waveforms.
- Each pulse triggers a short synth note using a per-pulse envelope.
- **Overlapping pulses** blend together naturally instead of cutting off.
- **Exponential envelope curves** for smoother and more musical amplitude transitions.
- Waveform color feedback — random mode picks a new waveform color each trigger.

### 🎨 **Visual Feedback**
- Expanding, glowing circle synced to the envelope’s amplitude.
- Colors correspond to waveform type (e.g., sine = cyan, saw = orange, etc.).

### 🧩 **UI Controls**
- Waveform selector dropdown with live visual color feedback.
- Interactive **Attack–Sustain–Decay (ASD)** envelope editor.
- On-screen toggle to start or stop pulse listening.
- Small pulse indicator showing recent activity.

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