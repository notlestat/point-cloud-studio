# Point Cloud Studio verification record

These are dated implementation results for versions 0.1–0.4. They do not report a fresh run on every checkout. See [the repository overview](../README.md#check-a-change) for current check commands.

## Version 0.1

13 October 2026. `npm test`: six tests passed for image orientation, alpha and independent depth; deterministic examples and limits; ASCII PLY attribute mapping, depth and malformed-file rejection; and project validation.

`node verification/browser.mjs`: fifteen checks passed against the local loopback server in headless Chromium. Actual WebGL readback established visible pixels for the procedural arch, imported silhouette and PLY; echo/scatter and motion changed pixels, with no GL error. A synthetic PCM tone was decoded and its audio response changed pixels at zero motion speed; pausing motion paused playback. A saved embedded-image project restored source, controls and camera after switching to the demo. Invalid projects and binary PLY retained the previous source. A 2400-pixel-edge PNG download and a nonempty short silent WebM download were verified. Depth-map add/remove, 390-pixel responsive layout and server file allowlist were checked.

Screenshots were visually inspected for the desktop workspace, repeated silhouette and mobile layout. Browser test fixtures are synthetic and do not claim an authored client artwork or actual scan. The original review referenced a local `browser-report.json` for measurements.

Limits: headless browser rendering does not establish hardware-specific interactive performance. No audible speaker test, broad media formats, long-session GPU reliability, capture frame pacing, mobile touch hardware or comparison with a scan reference was established. Audio response uses browser frequency analysis and approximate timing. Image depth is brightness relief unless the user supplies a depth map. Video has no audio track. The interface and working title remain provisional.

Browser scripts import the pinned Playwright development dependency. Use npm ci and npx playwright install chromium before running them against the local server. The application has no npm runtime dependencies.

## Version 0.2 keyframes

13 October 2026. `npm test`: all twelve core tests passed, including six animation tests covering numeric interpolation, outgoing easing/hold, discrete settings, integer echoes, key retiming/collisions/removal, exact motion-speed integrals, camera orbit continuity, history-independent scene evaluation, version 1 migration and strict version 2 track validation.

The fifteen existing browser checks passed against 0.2. An additional fifteen checks in `keyframes-browser.mjs` passed for all fourteen effect controls, real interpolated rendered pixels, easing/hold, retiming/deletion/collision handling, held sampling, five camera tracks, key navigation, duration bounds, animation project round-trip, version 1 migration, malformed-track rollback, preview loop and responsive layout. Recording was verified to rewind to zero, lock controls, stop at the one-second clip end, download and unlock. The downloaded WebM was decoded in Chromium: the late frame's RGB sum exceeded the early frame's by more than 1.5×, establishing the opacity animation in actual recorded frames. The original review referenced the local `keyframes-browser-report.json`.

Desktop and 390-pixel timeline screenshots were inspected. Browser tests found and corrected a key-time field being overwritten by a preview redraw while focused. Slider displays use their configured step precision; rendering evaluates continuous numeric interpolation independently. These checks were performed locally before public source publication. Remaining limits: live browser recording is not offline frame-perfect export; speaker output, broad browsers/hardware, long captures and sustained dense-cloud performance remain unverified. Video is silent; custom Bézier curves, animation undo/redo and graph editing are outside this version.

## Version 0.3 live camera

13 October 2026. All eighteen core tests passed, including six camera lifecycle tests for video-only constraints, selected devices, permission cancellation with a late stream, playback/permission errors, disconnect notification and cancellation during video readiness. All fifteen baseline and fifteen keyframe browser checks also passed against 0.3.

Fourteen additional checks in `camera-browser.mjs` passed using Chromium's simulated getUserMedia video device, without opening the physical camera. WebGL readback established changing live points with timeline motion paused and existing effects applied. Checks covered explicit access only, no microphone, device enumeration, mirror, saved snapshot/keys, timed recording, freeze/track cleanup, opening snapshots without access, denied permissions retaining the prior source, late-stream cancellation, hidden-page cleanup, stopping camera during recording and 390-pixel layout. Desktop/mobile screenshots with the synthetic green test feed were inspected. The original review referenced the local `camera-browser-report.json`.

Limits: these tests do not establish physical MacBook camera access, macOS permissions, Codex in-app-browser support, hardware indicator behavior, broad device switching or sustained frame pacing. Camera sampling is bounded and live; it does not rewind with the effect timeline or infer real depth. Video export remains silent.

## Version 0.4 axis rotation

13 October 2026. All 22 core tests passed, including four rotation tests for right-handed X/Y/Z transforms, X→Y→Z composition, distance preservation, full turns, explicit multi-turn interpolation and legacy/current project validation. All fifteen baseline, fifteen keyframe and fourteen simulated-camera browser checks passed against 0.4.

Nine additional `rotation-browser.mjs` checks passed. Actual WebGL pixel readback changed for each axis and returned to the initial image after 360°. Exact degree entry, rejected invalid angles, all-axis keying independent of camera pose, combined-axis scrubbing, version 3 project round-trip, zero pose retaining tracks, version 2 migration and 390-pixel layout were verified. A one-second Y-axis animation was recorded and decoded: visible point bounds narrowed from 435 pixels in the early frame to 361 in the late frame, establishing the turn in the exported clip. Desktop/mobile rotation controls were inspected. The original review referenced the local `rotation-browser-report.json`.

Limits: fixed Euler X→Y→Z order, no arbitrary pivot/gizmo/quaternion track; frame pacing and broad hardware remain unverified. The physical camera limitation from 0.3 remains.

Generated reports and captures are ignored by Git and are not included in a fresh clone. Run the browser suites to create new evidence for your environment.
