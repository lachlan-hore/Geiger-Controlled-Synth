# Geiger-Controlled-Synth

Turn Geiger counter pulses (via audio input) into sound synthesis with the Web Audio API.

---

## How it Works
- **Server (Node.js)**
  - Listens to audio input with [`mic`](https://www.npmjs.com/package/mic).
  - Detects spikes above a noise threshold.
  - Emits `pulse` events to connected clients via [Socket.IO](https://socket.io/).

- **Client (Browser)**
  - Connects to server and listens for `pulse` events.
  - Plays a short synthesized sound on each pulse.
  - Flashes a circle indicator for visual feedback.
  - Toggle button to start/stop monitoring.

---

## Features (v0.1)
- Real-time pulse detection with configurable threshold, window size, and debounce.
- Simple oscillator “blip” sound triggered by pulses.
- Visual pulse indicator in browser.
- Auto server restart with [Nodemon](https://www.npmjs.com/package/nodemon).

---

## Setup

### Requirements
- Node.js v20+
- Nodemon (optional, for auto-restart)
- Audio line-in from Geiger counter or pulse source

### Install & Run
```bash
git clone https://github.com/lachlan-hore/Geiger-Controlled-Synth.git
cd Geiger-Controlled-Synth
npm install
./start_server.sh
```
##Roadmap
- Improve Synth Engine
  - Add polyphony so multiple pulses can overlap instead of cutting each other off.
  - Introduce different oscillator types (sine, saw, triangle, noise).
  - Map the Geiger pulse rate (counts per second) to envelope controls (attack/decay) for more dynamic sounds.
  - Use long gaps between pulses to trigger chord changes or shifts in pitch/harmony.
  - Add effects like delay, reverb, and filters.
- UI Enhancements
  - Sliders and toggles for synth parameters (pitch, envelope, waveform, effects).
  - Visual rate meter showing counts per second.
  - Toggle to enable/disable automatic chord changes.
  - Graph of recent pulse activity.
