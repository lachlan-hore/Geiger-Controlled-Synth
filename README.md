# Geiger-Pulse-Synth

Turn Geiger counter pulses (via audio input) into sound synthesis and interactive visualizations.

---

## Overview

**Geiger-Controlled-Synth** transforms real-time radiation detection into a dynamic audio-visual performance tool.  
Each pulse detected from the Geiger counter triggers a sound, while the visuals respond with color and brightness, creating an interactive display of invisible energy.


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
- Provides real-time waveform selection, pitch and envelope editing via UI controls.
- Provides real-time waveform selection and manipulation via UI controls.

---


## Installation

### Requirements
- Node.js v20+
- Audio line-in from Geiger counter or pulse generator
- [Nodemon](https://www.npmjs.com/package/nodemon) for auto-restarts

### Setup
```bash
git clone https://github.com/lachlan-hore/Geiger-Controlled-Synth.git
cd Geiger-Controlled-Synth
npm install
./start_server.sh
```
**Then open** [http://localhost:3000/](http://localhost:3000/)

## Changelog:

### This version (v0.2.0)

#### New Features
- **Stereo Panning System**
  - Added randomized per-pulse panning.
  - Optional oscillating pan motion with frequency control (0.1–10 Hz).
- **Pan Control Module**
  - New UI section with toggles for Random Pan and Oscillation.
  - Interactive frequency slider with live updates.
- **Dynamic Logo**
  - Introduced glowing “Geiger Pulse Synth” logo reacting to the envelope.
  - Uses blended color from all active waveforms.
  - Supports *Orbitron*-style futuristic font.

#### Visual & UI Enhancements
- Waveform ring and halo now blend colors from all enabled waveforms.
- Pulse timeline reworked — pulses move diagonally with pan position.
- Dynamic dampening visually linked to envelope control.
- Improved layout alignment for pitch, pan, and envelope modules.
- Cleaner gradients, smoother glow transitions, and better performance on larger screens.

#### Code Improvements
- Refactored `triggerPulse()` for unified pan and envelope handling.
- Added helper functions:
  - `getActiveWaveType()`
  - `getRandomNoteFrequency()`
  - `getOscillatedPan()`
- Removed legacy random waveform mode and unused variables.
- Optimized visuals and CPU load by trimming old pulses per minute.

#### Bug Fixes
- Fixed inconsistent note and octave flash timing.
- Fixed waveform color desync between active buttons and visuals.
- Resolved clipping in rapid pulse sequences.


### (v0.1.61):
#### **Functionality & Behavior Updates**
- Fixed **Dynamic ENV toggle** not responding correctly due to mismatched click area — now properly toggles when pressed.
- Prevented **ENV target** from resetting unintentionally when clicking anywhere on the canvas; only updates when the slider is actively moved.
- Introduced a `wasActive` flag in `VerticalSlider` class for more reliable input detection.

#### **Visual Enhancements**
- Enhanced **circular waveform animation**: stronger expansion and contraction based on audio amplitude for a more expressive, reactive feel.
- Adjusted envelope return handling to improve fluidity and user feedback.
- Cleaned up draw logic for more consistent layering and blending modes.

#### **Internal Improvements**
- Reorganized event handling for better modularity.
- Simplified globalCompositeOperation resets to prevent rendering glitches after fades.
- Reduced redundant redraws to improve frame pacing on high-refresh monitors.

#### **Bug Fixes**
- Resolved “ENV return value resetting incorrectly” when mouse interactions occurred outside the slider.
- Fixed Dynamic Dampening button’s bounding box alignment with visual layout.
- Eliminated residual variable reference errors during slider release handling.

### (v0.1.6):
#### **Refinements & Structural Improvements**
- Internal codebase reorganized for cleaner rendering and consistent UI scaling.
- Further smoothed halo and waveform gradients for high-refresh displays.
- Improved layout responsiveness for small and large screens.
- Better synchronization between visual and audio envelopes.
- Minor code cleanup and naming consistency.

#### Visual Enhancements
- More stable timeline rendering (lines for each pulse) across refreshes.
- Slightly softer glow effect around the main waveform ring.
- Visual responsiveness tuned for high-frequency pulses.

#### Performance
- Reduced CPU usage during idle states.
- Better handling of simultaneous envelope overlaps.

#### Bug Fixes
- Fixed occasional waveform freeze when resizing window.
- Resolved rare pulse overlap miscoloration.


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
