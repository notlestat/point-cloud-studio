# Point Cloud Studio

A local browser tool for making point-cloud artwork from images, 3D point files and live camera video. Created by Corey Kavanagh.

**Current version: 0.4.0.** An experimental tool in active development.

![Point Cloud Studio showing its generated arch example](docs/preview.png)

## Quick start

Install Node.js 22 or newer, then:

```sh
git clone https://github.com/notlestat/point-cloud-studio.git
cd point-cloud-studio
npm start
```

Open **http://127.0.0.1:4178** in a browser with WebGL2. On macOS, you can also double-click `Launch.command` to start the server and open the page. Stop the server with Control-C in its terminal.

The app has no runtime npm dependencies; installation is only needed for browser-test tooling. There is no build step, account, API key or paid service. The local server binds to this computer and serves an explicit list of application files. It does not upload your images, camera feed or audio.

Automated browser checks use Chromium. Camera access requires browser/OS permission, and video recording requires a supported MediaRecorder codec. Cross-browser and physical-camera compatibility are still being tested.

## Current tools

| Area | Features |
| --- | --- |
| Sources | PNG, JPEG, WebP, ASCII PLY, generated 3D example and live camera |
| Points | Sampling, size, opacity, colour and removal of dark points |
| Form | Depth, scatter, waves, repeated echoes and echo spacing |
| Rotation | Independent X/Y/Z artwork rotation with degree fields and sliders |
| Animation | Seventeen effect tracks, five camera tracks, keyframes, easing and looping |
| Audio | Local audio files driving visual displacement |
| Output | PNG, timed silent video and editable project files |

## Make a study

Import a PNG, JPEG or WebP, or drop it onto the preview. The image is sampled into coloured points. Brightness supplies the initial depth relief: it does not infer anatomy, recover hidden surfaces or create a complete 3D scan. Images are resized to a maximum 1536-pixel edge before sampling. Transparent pixels are omitted. Remove dark points can isolate a figure photographed against black. A white background may need preparation in an image editor.

Add a matching greyscale depth map to control depth independently of colour. It is stretched to match the sampled image; brighter values come forward. This version does not generate an AI depth map or remove backgrounds automatically.

Import ASCII PLY 1.0 with x/y/z and optional 0–255 red/green/blue fields for real 3D points. Coordinates are centred and uniformly normalised. Vertex list properties, binary PLY and files with non-empty elements before vertices are rejected. Files are limited to 40 MB, declared vertices to two million and rendered source points to 250,000. Light/Balanced sampling reduces imported points deterministically. Faces are ignored; this is a point viewer. XYZ, LAS/LAZ, E57, OBJ and Gaussian splats are not supported.

Explore size, opacity, colour, depth, scatter, waves and repeated echoes. Drag to orbit, Shift-drag to pan and scroll to zoom. Double-click or Reset view restores the camera. Space toggles motion when the preview is focused. Motion starts only after pressing Play. An original generated arch is provided as a 3D example, not a captured scan.

Local audio can drive point displacement. Press Play audio to enable sound; pausing motion also pauses sound. No microphone access is requested. Audio output and visual motion are approximate browser timing, not sample-accurate synchronization. Project files can be up to 64 MB so embedded PLY text fits after JSON escaping.

Export PNG at a 1920, 2400 or 3840-pixel longest edge using the current preview proportions. Record video starts the clip at zero and stops automatically at its duration, with a requested 30 FPS and a 60-second maximum; the browser selects supported WebM or MP4 encoding. Actual frame pacing is browser-dependent. Video has no audio track. Leaving the tab stops audio and finishes recording. Version 3 projects embed the resized visual source, depth map, settings, camera, timeline duration and effect/camera keyframes; version 1 projects migrate with a fresh timeline, and version 2 projects retain their timeline; audio must be imported again. Projects are explicit downloads, with no automatic persistence on refresh.

## Rotate on any axis

The **Rotation** panel turns the point cloud independently of the camera. Set X, Y and Z with sliders or exact degree fields, from −1080° to +1080°. Combined angles are applied around the source origin in X, then Y, then Z order; the camera is applied afterwards. Images, real point files, generated examples and live camera relief all use the same transform.

Each axis has its own ◇ keyframe control. Click it at the starting pose, move the playhead and edit that angle to add the next key. **Key all axes** captures all three angles at once. The timeline's Linear, Ease in/out and Hold options apply. Angles interpolate as entered: 0° → 360° is one full turn, and 0° → 720° is two, without taking a shorter path. **Set rotation to zero** sets the current pose to neutral, adding/updating a key on already animated axes while retaining their tracks. Dragging the preview continues to move the camera.

Rotation settings and tracks are included in project version 3. Earlier version 1/2 files load with zero angles when those fields are absent, preserving existing camera/effect animation. Preview, PNG and recorded video use the same evaluated rotation.

## Use the MacBook camera

Save your current project before refreshing an earlier open session. In **Live camera**, click **Start camera** and allow the browser/macOS camera prompt. This uses video only and does not request a microphone. The initial default camera is selected by the browser; after access, the dropdown lists available video devices. Stop the camera before selecting another device, then start again. If camera access is unavailable in the Codex in-app browser, open the same local address in Chrome or Safari.

Video is sampled locally into the same brightness-depth relief as images, so all effect and camera keyframes apply. It does not reconstruct hidden geometry, provide LiDAR depth or remove the background. Mirror camera changes incoming frames. Sampling uses a maximum 640-pixel frame edge and targets at most 15 updates per second, or ten for Dense; actual performance depends on browser, camera and point count. Live video continues while effect motion is paused. Timeline scrubbing evaluates the effects over the current live frame; it cannot rewind the physical camera.

**Freeze frame** or **Stop camera** releases the stream and retains the last frame as an image. Camera access also stops on source/project/example changes, when the page is hidden or closed, on graphics-context loss or on device disconnect. Start again explicitly to resume. A pending access request can be cancelled; any late-arriving stream is stopped. The camera is off on page load and project open.

PNG export and timed video recording capture the processed points. During a recording, Stop camera remains available and safely ends the capture early. A completed recording leaves the live camera running until you stop it. Saving a project while live embeds a still camera snapshot and keyframes, not live footage or a camera device identifier. Reopening it shows that still and never activates the camera automatically. Video recording remains silent.

The integration uses the browser's [getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) and [video device enumeration](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices). Physical MacBook camera permission and hardware behavior remain a user check; automated browser tests use Chromium's simulated video device.

## Animate a study

1. Set a 1–60 second clip duration. The default is ten seconds.
2. At the starting time, set an effect value and click its ◇ button. This creates an animation track.
3. Move the playhead by dragging the scrubber, clicking a track, or entering seconds. Change the effect value to automatically add a key at that time. The current key displays ◆. The preview evaluates animation immediately while scrubbing.
4. Click a key diamond on a track to select it. Choose Linear, Ease in / out or Hold for the segment after that key. Change Key time to move it, or Delete key to remove it. Clear track retains its current evaluated value as a static setting. Sampling, Colour and checkboxes always use Hold; Echoes interpolates as whole numbers. Before the first key and after the last, the nearest key value is held.
5. Use Key camera to capture rotation, tilt, distance and pan. Move the playhead and orbit/pan/zoom to add another camera pose. Keys snap to a 30 fps frame. Left/Right arrows step one frame when the preview is focused. Preview can loop; recording always runs once.
6. Press Record video. It rewinds to zero, locks editing and saves automatically at the end. Stop recording saves a shorter clip. If local audio is already playing it restarts at zero for visual response, but the video remains silent. Leaving the tab finishes recording early.

Effect and camera tracks use the same evaluator for preview, PNG and recording. Motion speed is integrated over the clip, so speed keys do not jump the wave phase. Rendering/capture is live browser timing, not an offline frame-perfect render. Custom Bézier curves, expression editing, graph editor, multi-key selections and animation undo/redo are not implemented. Reset controls clears effect and camera tracks as well as static effect settings. Importing another source retains the animation; Example resets it. Loop preview is a session preference.

Save the project before refreshing an earlier open browser session, then reopen the saved file in the updated app. Browser refresh has no automatic recovery.

## Development and testing

Run the core tests without installing dependencies:

```sh
npm test
```

For browser checks, install the pinned development dependency and Chromium:

```sh
npm ci
npx playwright install chromium
```

Keep `npm start` running in one terminal, then use another:

```sh
npm run test:browser
```

The current checks include **22 core tests and 53 browser checks**, covering source conversion, camera lifecycle, project migration, rotation, keyframes, WebGL pixels and decoded recorded animation. Camera checks use a simulated device rather than the physical camera. Screenshots and captures are ignored by Git. See [verification notes](verification/README.md) for evidence and limits.

| File | Purpose |
| --- | --- |
| `app.js` | Interface, sources, playback and recording |
| `core.js` | Image/point conversion and project validation |
| `settings.js` | Default controls and bounds |
| `timeline.js` | Keyframes, interpolation and motion integration |
| `renderer.js` | WebGL points and XYZ rotation |
| `live-camera.js` | Explicit camera access and stream lifecycle |
| `server.mjs` | Local static server with an application-file allowlist |

For new effects, keep settings bounds, timeline metadata, controls and rendering in agreement. Update project migration when changing saved data, add meaningful checks and keep this README aligned with the implemented version. User media, saved studies, credentials and generated captures should stay out of Git.

## Current limits and future work

This is an evolving creative tool. Broad hardware/browser compatibility, audible speaker output, sustained dense-cloud performance and long captures remain unverified. Further directions include more scan formats, background segmentation, temporal trails, composition/typography tools and offline video rendering. These are future work, not current features.
