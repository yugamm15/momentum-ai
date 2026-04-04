let startTime = 0;
let timerInterval = null;
let stopRequested = false;
let promptDismissedForMeeting = "";
let promptVisible = false;
let promptEvaluationTimeout = null;
let watcherInterval = null;
let meetingObserver = null;
let extensionContextBroken = false;

const PROMPT_EVALUATION_DEBOUNCE_MS = 250;
const PROMPT_POLL_INTERVAL_MS = 5000;
const END_CALL_TOKENS = ["leave call", "end call", "hang up", "hangup", "call_end", "call end", "phone_disabled"];
const JOIN_SCREEN_TOKENS = ["join now", "ask to join", "ready to join", "join meeting", "rejoin"];
const LIVE_MEETING_TOKENS = [
  "mic",
  "mic_off",
  "videocam",
  "videocam_off",
  "captions",
  "present_to_all",
  "more_vert",
  "call_end",
  "phone_disabled",
];
const PARTICIPANT_BLACKLIST = [
  'google meet',
  'meeting details',
  'raise hand',
  'captions',
  'present now',
  'chat with everyone',
  'activities',
  'host controls',
  'people',
  'you',
  'me',
  'stop and process',
  'momentum ai',
];
const PARTICIPANT_LABEL_PATTERNS = [
  /^(.*?)['’]s microphone\b/i,
  /^(.*?)['’]s camera\b/i,
  /^pin (.*?)\b/i,
  /^more actions for (.*?)$/i,
  /^send message to (.*?)$/i,
  /^remove (.*?) from the call$/i,
  /^presenting now: (.*?)$/i,
];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_MEETING_STATE") {
    sendResponse(detectMeetingState());
    return false;
  }

  if (message.type === "GET_MEETING_METADATA") {
    sendResponse(getMeetingMetadata());
    return false;
  }

  if (message.type === "SYNC_SESSION_STATE" && message.session) {
    renderSessionState(message.session);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "SHOW_AUDIO_HEARTBEAT") {
    pulseHud();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

document.addEventListener(
  "click",
  (event) => {
    if (extensionContextBroken) {
      return;
    }

    const button = event.target.closest("button, [role='button']");
    if (!button) {
      return;
    }

    const label = getElementLabel(button);
    if (isEndCallControl(button, label)) {
      safeSendRuntimeMessage({ type: "MEETING_LEAVE_TRIGGERED" });
    }
  },
  true
);

syncSessionState();
startMeetingWatcher();

function syncSessionState() {
  safeSendRuntimeMessage({ type: "GET_TAB_SESSION_STATE" }, (session, error) => {
    if (error || !session) {
      return;
    }

    renderSessionState(session);
  });
}

function detectMeetingState() {
  const meetingCodeMatch = String(location.href).match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  const meetingCode = meetingCodeMatch ? meetingCodeMatch[1].toLowerCase() : "";
  const onMeetingUrl = Boolean(meetingCode);
  const leaveControl = findLeaveCallButton();
  const liveControls = countControlsMatching(LIVE_MEETING_TOKENS);
  const joinSignals = countControlsMatching(JOIN_SCREEN_TOKENS);
  const maybeInMeeting = onMeetingUrl && !leaveControl && liveControls >= 3 && joinSignals === 0;
  const inMeeting = Boolean(leaveControl || maybeInMeeting);

  return {
    onMeetingUrl,
    inMeeting,
    maybeInMeeting,
    meetingCode,
  };
}

function getMeetingMetadata() {
  const meetingState = detectMeetingState();

  return {
    ...meetingState,
    meetingLabel: detectMeetingLabel(),
    participantNames: detectParticipantNames(),
  };
}

function renderSessionState(session) {
  removeStartPrompt();

  if (session.phase === "starting") {
    showProgressHud(session, "starting", false);
    return;
  }

  if (session.phase === "recording") {
    startSessionHud(session);
    pulseHud();
    return;
  }

  if (session.phase === "processing") {
    showProgressHud(session, "processing", Boolean(session.terminal));
    return;
  }

  if (session.phase === "success") {
    showProgressHud(session, "success", true);
    return;
  }

  if (session.phase === "error") {
    showProgressHud(session, "error", true);
    return;
  }

  if (session.phase === "retry") {
    showProgressHud(session, "retry", true);
  }
}

function startMeetingWatcher() {
  evaluatePrompt();

  meetingObserver = new MutationObserver(() => {
    queuePromptEvaluation();
  });

  meetingObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  watcherInterval = setInterval(queuePromptEvaluation, PROMPT_POLL_INTERVAL_MS);
}

function queuePromptEvaluation() {
  clearTimeout(promptEvaluationTimeout);
  promptEvaluationTimeout = setTimeout(() => {
    evaluatePrompt();
  }, PROMPT_EVALUATION_DEBOUNCE_MS);
}

function evaluatePrompt() {
  if (extensionContextBroken) {
    return;
  }

  safeSendRuntimeMessage({ type: "GET_TAB_SESSION_STATE" }, (session, error) => {
    if (error) {
      return;
    }

    const meetingState = detectMeetingState();
    const hasActiveSession = session && ["starting", "recording", "processing"].includes(session.phase);

    if (!meetingState.inMeeting || hasActiveSession) {
      removeStartPrompt();
      return;
    }

    if (promptDismissedForMeeting === meetingState.meetingCode) {
      return;
    }

    showStartPrompt(meetingState.meetingCode);
  });
}

function showStartPrompt(meetingCode) {
  if (promptVisible) {
    return;
  }

  promptVisible = true;

  const existing = document.getElementById("momentum-start-prompt");
  if (existing) {
    existing.remove();
  }

  const prompt = document.createElement("div");
  prompt.id = "momentum-start-prompt";
  prompt.style.cssText = [
    "position:fixed",
    "right:24px",
    "bottom:24px",
    "z-index:2147483647",
    "width:320px",
    "background:#0f172a",
    "border:2px solid #2563eb",
    "border-radius:22px",
    "padding:18px",
    "box-shadow:0 24px 70px rgba(15,23,42,0.45)",
    "font-family:Inter, Arial, sans-serif",
    "color:#ffffff",
  ].join(";");
  prompt.innerHTML = `
    <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#60a5fa;margin-bottom:8px;">Momentum AI</div>
    <div style="font-size:20px;font-weight:800;line-height:1.2;margin-bottom:8px;">Bring Momentum into this meeting?</div>
    <div id="momentum-start-copy" style="font-size:13px;line-height:1.5;color:#cbd5e1;margin-bottom:16px;">Momentum records this meeting only after you start it. If Chrome allows it, Momentum will open the capture panel and begin automatically. If not, use the toolbar icon once or press Alt+Shift+M.</div>
    <div style="display:flex;gap:10px;">
      <button id="momentum-start-now" style="flex:1;background:#2563eb;color:#fff;border:none;border-radius:14px;padding:12px 14px;font-weight:800;cursor:pointer;">Start Momentum</button>
      <button id="momentum-dismiss-prompt" style="background:transparent;color:#cbd5e1;border:1px solid #334155;border-radius:14px;padding:12px 14px;font-weight:700;cursor:pointer;">Later</button>
    </div>
  `;
  document.body.appendChild(prompt);

  prompt.querySelector("#momentum-start-now").onclick = async () => {
    const startButton = prompt.querySelector("#momentum-start-now");
    const copy = prompt.querySelector("#momentum-start-copy");
    startButton.disabled = true;
    startButton.textContent = "Opening...";

    try {
      const response = await sendRuntimeMessage({
        type: "OPEN_CAPTURE_POPUP",
      });

      startButton.disabled = false;
      startButton.textContent = "Start Momentum";
      if (response?.opened) {
        removeStartPrompt();
      }
      copy.textContent =
        response.detail ||
        "Momentum is opening the capture panel now.";
    } catch (error) {
      startButton.disabled = false;
      startButton.textContent = "Start Momentum";
      copy.textContent = error.message;
    }
  };

  prompt.querySelector("#momentum-dismiss-prompt").onclick = () => {
    promptDismissedForMeeting = meetingCode;
    removeStartPrompt();
  };
}

function removeStartPrompt() {
  const prompt = document.getElementById("momentum-start-prompt");
  if (prompt) {
    prompt.remove();
  }

  promptVisible = false;
}

function startSessionHud(session) {
  startTime = session.startedAt || Date.now();
  stopRequested = false;
  clearInterval(timerInterval);

  const hud = buildHud();
  const timer = hud.querySelector("#momentum-timer");
  const stopButton = hud.querySelector("#momentum-stop");
  const meta = hud.querySelector("#momentum-meta");

  hud.querySelector("#momentum-phase").innerText = "Recording live audio";
  hud.querySelector("#momentum-status").innerText = "Momentum is listening to this Google Meet tab.";
  meta.innerText = buildMetaText(session);
  stopButton.disabled = false;
  stopButton.style.display = "block";
  stopButton.style.opacity = "1";
  stopButton.innerText = "Stop and Process";
  stopButton.onclick = () => {
    if (stopRequested) {
      return;
    }

    stopRequested = true;
    stopButton.disabled = true;
    stopButton.style.opacity = "0.7";
    stopButton.innerText = "Stopping...";
    hud.querySelector("#momentum-phase").innerText = "Finalizing recording";
    hud.querySelector("#momentum-status").innerText = "Packing the captured audio and sending it to Momentum.";
    meta.innerText = "Momentum is preserving the local copy before upload.";
    chrome.runtime.sendMessage({ type: "STOP_SILENT_RECORDING" });
  };

  updateTimer(timer);
  timerInterval = setInterval(() => updateTimer(timer), 1000);
}

function showProgressHud(session, state, terminal) {
  clearInterval(timerInterval);

  const hud = buildHud();
  const timer = hud.querySelector("#momentum-timer");
  const stopButton = hud.querySelector("#momentum-stop");
  const pulse = hud.querySelector("#momentum-pulse");
  const meta = hud.querySelector("#momentum-meta");

  timer.innerText = "--:--";
  stopButton.style.display = "none";

  hud.querySelector("#momentum-phase").innerText = stateLabel(state);
  hud.querySelector("#momentum-status").innerText = session.status;
  meta.innerText = buildMetaText(session);

  if (state === "success") {
    pulse.style.background = "#10b981";
    pulse.style.borderColor = "#34d399";
  } else if (state === "error") {
    pulse.style.background = "#ef4444";
    pulse.style.borderColor = "#f87171";
  } else if (state === "retry") {
    pulse.style.background = "#f59e0b";
    pulse.style.borderColor = "#fbbf24";
  } else {
    pulse.style.background = "#3b82f6";
    pulse.style.borderColor = "#93c5fd";
  }

  if (terminal) {
    setTimeout(() => hud.remove(), 10000);
  }
}

function pulseHud() {
  const pulse = document.getElementById("momentum-pulse");
  if (!pulse) {
    return;
  }

  pulse.style.transform = "scale(1.2)";
  pulse.style.background = "#3b82f6";
  setTimeout(() => {
    pulse.style.transform = "scale(1)";
    if (pulse.style.borderColor !== "rgb(52, 211, 153)" && pulse.style.borderColor !== "rgb(248, 113, 113)") {
      pulse.style.background = "#0f172a";
    }
  }, 180);
}

function updateTimer(timer) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  timer.innerText = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function buildHud() {
  let hud = document.getElementById("momentum-hud");

  if (!hud) {
    hud = document.createElement("div");
    hud.id = "momentum-hud";
    hud.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "left:24px",
      "z-index:2147483647",
      "width:360px",
      "background:#020617",
      "border:2px solid #1d4ed8",
      "border-radius:24px",
      "padding:18px",
      "color:#fff",
      "font-family:Inter, Arial, sans-serif",
      "box-shadow:0 24px 80px rgba(2,6,23,0.42)",
    ].join(";");
    hud.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div id="momentum-pulse" style="width:14px;height:14px;border-radius:999px;background:#0f172a;border:2px solid #60a5fa;transition:all 0.18s ease;"></div>
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#60a5fa;">Momentum AI</div>
          <div id="momentum-phase" style="font-size:16px;font-weight:800;color:#f8fafc;">Recording live audio</div>
        </div>
        <div id="momentum-timer" style="margin-left:auto;font-size:18px;font-weight:900;font-variant-numeric:tabular-nums;">00:00</div>
      </div>
      <div id="momentum-status" style="font-size:13px;line-height:1.5;color:#cbd5e1;margin-bottom:16px;">Momentum is listening to this Google Meet tab.</div>
      <div id="momentum-meta" style="font-size:11px;line-height:1.5;color:#93c5fd;margin:-6px 0 16px;">No local recovery chunks saved yet.</div>
      <button id="momentum-stop" style="width:100%;background:#ef4444;color:#fff;border:none;padding:12px 16px;border-radius:14px;cursor:pointer;font-weight:800;">Stop and Process</button>
    `;
    document.body.appendChild(hud);
  }

  return hud;
}

function stateLabel(state) {
  if (state === "success") {
    return "Complete";
  }

  if (state === "error") {
    return "Attention needed";
  }

  if (state === "retry") {
    return "Retry queued";
  }

  if (state === "starting") {
    return "Preparing capture";
  }

  return "Syncing to Momentum";
}

function buildMetaText(session) {
  const parts = [];
  const chunkCount = Number(session?.chunkCount || 0);

  if (chunkCount > 0) {
    parts.push(`${chunkCount} local chunk${chunkCount === 1 ? "" : "s"} saved`);
  } else if (session?.phase === "recording") {
    parts.push("Waiting for the first local recovery chunk");
  }

  if (session?.stage) {
    parts.push(`stage: ${session.stage}`);
  }

  if (session?.retryPending) {
    parts.push("retry queued");
  } else if (session?.savedLocally) {
    parts.push("safe on this device");
  }

  if (session?.detail) {
    parts.push(session.detail);
  }

  return parts.filter(Boolean).join(" | ");
}

function detectMeetingLabel() {
  const selectors = [
    'h1',
    '[data-meeting-title]',
    '[aria-label*="meeting details" i] [dir="auto"]',
    '[aria-label*="meeting details" i] span',
  ];

  for (const selector of selectors) {
    const candidate = Array.from(document.querySelectorAll(selector)).find((element) =>
      isLikelyMeetingLabel(readElementText(element))
    );

    if (candidate) {
      return readElementText(candidate);
    }
  }

  const title = String(document.title || '').replace(/\s*-\s*Google Meet\s*$/i, '').trim();
  return isLikelyMeetingLabel(title) ? title : '';
}

function detectParticipantNames() {
  const selectors = [
    '[data-participant-id] [dir="auto"]',
    '[data-participant-id] span',
    '[role="listitem"] [dir="auto"]',
    '[role="listitem"] span',
    'aside [dir="auto"]',
    'aside span',
    '[data-self-name]',
    '[data-requested-participant-id] [dir="auto"]',
    '[aria-label*="microphone" i]',
    '[aria-label*="camera" i]',
    '[aria-label*="more actions for" i]',
  ];
  const names = new Map();

  function addCandidate(value, score = 1) {
    const name = sanitizeParticipantName(value);
    if (!name) {
      return;
    }

    const key = name.toLowerCase();
    const currentScore = names.get(key)?.score || 0;
    if (score >= currentScore) {
      names.set(key, { name, score });
    }
  }

  selectors.forEach((selector) => {
    Array.from(document.querySelectorAll(selector)).forEach((element) => {
      if (!isVisibleElement(element)) {
        return;
      }

      const text = readElementText(element);
      if (isLikelyParticipantName(text)) {
        addCandidate(text, 1);
      }

      extractParticipantNamesFromLabel(getElementLabel(element)).forEach((candidate) =>
        addCandidate(candidate, 0.94)
      );
    });
  });

  Array.from(document.querySelectorAll('[aria-label], [title]'))
    .slice(0, 500)
    .forEach((element) => {
      extractParticipantNamesFromLabel(getElementLabel(element)).forEach((candidate) =>
        addCandidate(candidate, isVisibleElement(element) ? 0.92 : 0.74)
      );
    });

  return Array.from(names.values())
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((entry) => entry.name)
    .slice(0, 20);
}

function findLeaveCallButton() {
  const candidates = Array.from(document.querySelectorAll("button, [role='button']"));
  return candidates.find((element) => {
    const label = getElementLabel(element);
    return isEndCallControl(element, label);
  });
}

function getElementLabel(element) {
  return [
    element?.getAttribute("aria-label"),
    element?.getAttribute("title"),
    element?.getAttribute("data-tooltip"),
    element?.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function readElementText(element) {
  return String(element?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyMeetingLabel(text) {
  const value = String(text || '').trim();
  if (!value || value.length < 3 || value.length > 120) {
    return false;
  }

  const lower = value.toLowerCase();
  if (PARTICIPANT_BLACKLIST.some((token) => lower.includes(token))) {
    return false;
  }

  return true;
}

function isLikelyParticipantName(text) {
  const value = sanitizeParticipantName(text);
  if (!value || value.length < 2 || value.length > 40) {
    return false;
  }

  if (value.includes('@') || /\d{4,}/.test(value)) {
    return false;
  }

  const words = value.split(' ');
  if (words.length > 4) {
    return false;
  }

  const lower = value.toLowerCase();
  if (PARTICIPANT_BLACKLIST.includes(lower)) {
    return false;
  }

  return /^[a-zA-Z][a-zA-Z.' -]+$/.test(value);
}

function sanitizeParticipantName(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^you\b[:, -]*/i, '')
    .replace(/\(you\)/gi, '')
    .replace(/['’]s microphone.*$/i, '')
    .replace(/['’]s camera.*$/i, '')
    .trim();
}

function extractParticipantNamesFromLabel(label) {
  const value = String(label || '').replace(/\s+/g, ' ').trim();
  if (!value) {
    return [];
  }

  const matches = [];

  PARTICIPANT_LABEL_PATTERNS.forEach((pattern) => {
    const match = value.match(pattern);
    if (match?.[1]) {
      matches.push(match[1]);
    }
  });

  if (isLikelyParticipantName(value)) {
    matches.push(value);
  }

  return Array.from(new Set(matches.map((name) => sanitizeParticipantName(name)).filter(Boolean)));
}

function isVisibleElement(element) {
  const rect = element?.getBoundingClientRect?.();
  return Boolean(rect && rect.width > 0 && rect.height > 0);
}

function isEndCallControl(element, label = getElementLabel(element)) {
  return matchesAnyToken(label, END_CALL_TOKENS);
}

function countControlsMatching(tokens) {
  return Array.from(document.querySelectorAll("button, [role='button']")).filter((element) =>
    matchesAnyToken(getElementLabel(element), tokens)
  ).length;
}

function matchesAnyToken(text, tokens) {
  const normalized = String(text || "").toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    safeSendRuntimeMessage(message, (response, error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

function safeSendRuntimeMessage(message, callback) {
  if (extensionContextBroken) {
    callback?.(null, new Error("Extension context invalidated."));
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        const error = new Error(chrome.runtime.lastError.message);
        if (isExtensionContextInvalidated(error)) {
          handleExtensionContextInvalidated();
        }
        callback?.(null, error);
        return;
      }

      callback?.(response, null);
    });
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      handleExtensionContextInvalidated();
      callback?.(null, error);
      return;
    }

    throw error;
  }
}

function isExtensionContextInvalidated(error) {
  return String(error?.message || error || "")
    .toLowerCase()
    .includes("extension context invalidated");
}

function handleExtensionContextInvalidated() {
  extensionContextBroken = true;
  clearTimeout(promptEvaluationTimeout);
  clearInterval(timerInterval);
  clearInterval(watcherInterval);
  meetingObserver?.disconnect();
  removeStartPrompt();
  removeHud();
}

function removeHud() {
  const hud = document.getElementById("momentum-hud");
  if (hud) {
    hud.remove();
  }
}
