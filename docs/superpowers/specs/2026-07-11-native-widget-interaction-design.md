# Native Floating Widget Interaction Design

## Goal

Rebuild the floating quota widget around a reliable Electron-native interaction path while matching the approved dark blue 72 px orb design.

## Approved Direction

Use Electron's main process as the single owner of pointer interaction and window geometry. Vue renders quota state and receives explicit expanded or collapsed state from the main process. DOM click events do not toggle the widget.

## Window Geometry

- Collapsed window: 104 x 104 px transparent BrowserWindow.
- Visible orb: 72 x 72 px, centered inside the larger hit target.
- Default position: 20 px from the right and bottom edges of the active display work area.
- Expanded window: 320 x 150 px, anchored to the same bottom-right point so expansion grows left and upward.
- Keep the widget always on top and interactive on Windows.

## Interaction State Machine

- Native left-button down records screen position and timestamp.
- Releasing within 8 px and 800 ms toggles expanded state once.
- Holding for 180 ms enters dragging mode.
- Pointer movement while dragging moves the BrowserWindow in the main process.
- A completed drag never toggles expanded state.
- Clicking the orb while expanded collapses it.
- The panel close control explicitly requests collapse through IPC.
- Pointer state is cleared on mouse up, blur, hide, and window close.

## Visual Design

- Match the approved deep-blue orb: dark translucent base, blue outer progress arc, purple inner progress arc, soft blue edge glow.
- Center value shows the 5-hour remaining percentage and the label `5h`.
- Normal state uses blue and violet progress colors.
- Below 20 percent, the relevant progress changes to orange and includes an `额度不足` text label in the expanded panel.
- Missing quota data uses muted gray rings and `--%`.
- The expanded panel shows 5-hour remaining quota, 7-day remaining quota, reset time, and available reset-card count.
- Use the existing Lucide icon dependency for panel icons.

## Architecture

### Main Process

- Own collapsed and expanded bounds.
- Own the native pointer state machine.
- Toggle the window and send authoritative expanded state to the renderer.
- Clamp drag and resize results to the current display work area.

### Preload

- Expose expanded-state updates and explicit collapse requests.
- Do not expose duplicate click channels.

### Renderer

- Render from authoritative expanded-state updates.
- Keep visual controls free of widget-toggle DOM handlers.
- Use existing quota snapshot data; no mock or fallback data is added.

## Error Handling

- Ignore malformed pointer coordinates and non-left-button events.
- If the widget window is unavailable or destroyed, interaction handlers return without mutation.
- IPC state updates are idempotent.

## Verification

- Add regression tests for exactly one native toggle path.
- Test click versus drag classification and bounds anchoring.
- Verify collapsed, expanded, warning, and disconnected render states.
- Run the complete Vitest suite and production build.
- Restart Electron after main-process changes and manually verify single-click expansion, collapse, and long-press dragging.
- Capture collapsed and expanded screenshots and compare them with the approved reference before handoff.
