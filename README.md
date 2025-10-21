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
```
**Then open** [http://localhost:3000/](http://localhost:3000/)

## Changelog:

### (v0.1.5):
#### **UI Controls**
- Waveform selector replaced with buttons for each wavetype
- Master Output fader added
- adjusted layout for new UI elements

#### **Visual Feedback**
- Lines stretching from top to bottom in the background that travel from the right to the left of the window over one minute, indicating each pulse and changing colour to the matching type of waveform.
- Master Output fader has volume indicator

#### **Bug Fixes**
- Envelope decay now functions correctly
- Pulse indicator now triggered by pulses not for some reason envelope
- Redesgined pulse detection in server.js to better ignore cable interference and missed pulses

### (v0.1.4)
#### **Visual Feedback**
- Expanding glowing circle with gradient-basedß shading.
- Colors correspond to waveform type (e.g., sine = cyan, saw = orange, etc.).
- On random mode, the color reflects the waveform selected for that specific pulse.
- Larger and smoother circle rendering for a more fluid and immersive effect.

#### **UI Controls**
- Waveform selector dropdown with live visual color feedback.
- Small pulse indicator showing recent activity bursts.

#### **Bug Fix**
- Fixed browser refresh breaking running state of program by turning off mic on client disconnetion

### (v0.1.3):
#### **Audio Engine**
- Supports **sine**, **square**, **sawtooth**, **triangle**, and **random** waveforms.
- Each pulse triggers a short synth note using a per-pulse envelope.
- **Overlapping pulses** blend together naturally instead of cutting off.
- **Exponential envelope curves** for smoother and more musical amplitude transitions.
- Waveform color feedback — random mode picks a new waveform color each trigger.

#### **Visual Feedback**
- Expanding, glowing circle synced to the envelope’s amplitude.
- Colors correspond to waveform type (e.g., sine = cyan, saw = orange, etc.).

#### **UI Controls**
- Waveform selector dropdown with live visual color feedback.
- Interactive **Attack–Sustain–Decay (ASD)** envelope editor.
- On-screen toggle to start or stop pulse listening.
- Small pulse indicator showing recent activity.

### (v0.1.0)
- Real-time pulse detection with configurable threshold, window size, and debounce.
- Simple oscillator “blip” sound triggered by pulses.
- Visual pulse indicator in browser.
- Auto server restart with [Nodemon](https://www.npmjs.com/package/nodemon).