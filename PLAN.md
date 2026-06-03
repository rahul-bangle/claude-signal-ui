# Claude Clone Signal UI Implementation Plan

> **For Hermes:** Use supergsd-execute-task to implement this plan task-by-task.

**Goal:** Build the "Claude Signal" features on top of the existing Claude mobile web clone. Users can toggle the Claude Signal, watch mock streaming highlight three key data sentences, hover to see verification/dismiss tooltips, complete verification to change the red warning sentence to a green checkmark state, and copy the full text with a TTV toast.

**Architecture:**
- **AppState & Layout:** A standard mobile view layout (fixed container simulating 375x812 viewport or mobile-first responsive layout).
- **Core State:**
  * `signalEnabled` (boolean)
  * `isChatActive` (boolean)
  * `messages` (array of message objects: `{ id, role, text, timestamp }`)
  * `streamingText` (string/object representation for typewriter state)
  * `verifiedRed` (boolean - whether the red signal sentence has been verified)
  * `ttvStart` (timestamp)
  * `ttvEnd` (timestamp)
  * `activeTooltip` (boolean - toggle tooltip hover display)
  * `toastMessage` (string - temporary feedback)
- **Highlighted Sentences:**
  1. `Q3 revenue grew by 12% YoY.` (Green highlight when Signal is ON)
  2. `Customer retention in the enterprise segment held steady at 92%.` (Yellow highlight when Signal is ON)
  3. `The total addressable market size is currently estimated at $4.2 Billion.` (Red highlight when Signal is ON, with Tooltip. If verified, transforms to standard text with a green checkmark)
- **TTV Formula:** Elapsed seconds from the moment user triggers the message to the moment they click Copy.

**Tech Stack:** React 19, Tailwind CSS 3.x, Lucide React

---

## Tasks

### Task 1: Add state variables and Signal Toggle Switch UI

**Objective:** Add state tracking (`signalEnabled`, `isChatActive`, `messages`, `verifiedRed`, etc.) and the "⚡ Claude Signal" toggle inline.

**Files:**
- Modify: `src/App.jsx`

**Step 1: Write failing test (RED)**
*(Since it is a React client-only project, we verify by launching Vite and using the browser visual tool or inspecting the source code updates. We will write standard test code if needed, but here we can modify App.jsx and verify syntax & UI render directly).*

**Step 2: Write minimal implementation (GREEN)**
- Insert state hooks:
  * `const [signalEnabled, setSignalEnabled] = useState(false);`
  * `const [isChatActive, setIsChatActive] = useState(false);`
  * `const [currentMessage, setCurrentMessage] = useState("");`
  * `const [streamingMessageId, setStreamingMessageId] = useState(null);`
  * `const [verifiedRed, setVerifiedRed] = useState(false);`
  * `const [ttvStart, setTtvStart] = useState(null);`
  * `const [toast, setToast] = useState(null);`
- Place the switch UI labeled "⚡ Claude Signal" inside the input bar area.

---

### Task 2: Implement Typing Simulation and Highlights

**Objective:** Simulate response typewriter typing with highlight wrappers.

**Files:**
- Modify: `src/App.jsx`

**Step 1: Implement typing simulation**
- Text to stream:
  "Here is the Q3 performance summary. Q3 revenue grew by 12% YoY. Customer retention in the enterprise segment held steady at 92%. The total addressable market size is currently estimated at $4.2 Billion. Let me know if you want me to write a detailed report."
- Add character-by-character timer.
- Parse text to find the three target sentences. If `signalEnabled` is true, render them in their highlighted CSS spans (`bg-green-100 border-b-2 border-green-400`, `bg-yellow-100 border-b-2 border-yellow-400`, `bg-red-100 border-b-2 border-red-400 cursor-pointer relative`).
- If `verifiedRed` is true, the third sentence should show a green checkmark icon (e.g. `✅`) next to it and lose its red background highlight.

---

### Task 3: Tooltip on Red Hover (Verify & Dismiss Actions)

**Objective:** Add absolute tooltip popup on hover over the red highlighted text.

**Files:**
- Modify: `src/App.jsx`

**Step 1: Hover tooltip UI**
- Add hover state listener on the red sentence segment.
- Render tooltip containing text: "Claude is 68% confident in this figure. Suggest verifying before sharing."
- Include `[Verify]` and `[Dismiss]` buttons.
- On `[Verify]` click, set `verifiedRed(true)` and hide tooltip.
- On `[Dismiss]` click, hide tooltip for this hover session.

---

### Task 4: Copy Button, Toast Notification & TTV Measurement

**Objective:** Implement Copy button, track Time-to-Value (TTV), and display a timed toast.

**Files:**
- Modify: `src/App.jsx`

**Step 1: Implement Copy & Toast**
- Copy button below response text.
- On copy, measure `const ttvSeconds = Math.round((Date.now() - ttvStart) / 1000);`
- Copy full plaintext of the response.
- Show toast: `✅ Copied! TTV Measured: X seconds` for 3 seconds.

---

### Task 5: Mobile Shell Container & Polish

**Objective:** Frame the app within a clean mobile viewport container centered on the screen so it looks like a real mobile app preview.

**Files:**
- Modify: `src/App.jsx`
