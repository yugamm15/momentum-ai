const statusText = document.getElementById("status-text");
const statusDetail = document.getElementById("status-detail");
const pipelineText = document.getElementById("pipeline-text");
const activateButton = document.getElementById("activate-btn");
const shortcutText = document.getElementById("shortcut-text");

let activationInFlight = false;
let autoActivationAttempted = false;

bootPopup().catch(() => {});

activateButton.onclick = async () => {
  await activateMomentum({ auto: false, source: "button" });
};

async function bootPopup() {
  await hydratePopupState().catch(() => {});

  const contextResponse = await sendRuntimeMessage({
    type: "GET_POPUP_ENTRY_CONTEXT",
  }).catch(() => null);
  const popupContext = contextResponse?.ok ? contextResponse.context : null;

  if (popupContext?.mode === "programmatic") {
    statusText.style.color = "#cbd5e1";
    statusText.innerText = "Capture panel opened";
    statusDetail.innerText =
      "Momentum opened from the in-meeting prompt. Press Activate here if Chrome did not begin capture automatically.";
    pipelineText.innerText =
      "Programmatic popup open detected. Waiting for an explicit capture action inside the panel.";
    return;
  }

  setTimeout(() => {
    maybeAutoActivate().catch(() => {});
  }, 120);
}

async function maybeAutoActivate() {
  if (autoActivationAttempted || activationInFlight) {
    return;
  }

  const runtimeResponse = await sendRuntimeMessage({
    type: "GET_EXTENSION_RUNTIME_STATUS",
  }).catch(() => null);

  if (!runtimeResponse?.ok) {
    return;
  }

  const activeSession = runtimeResponse.status?.currentSession;
  if (
    activeSession &&
    ["starting", "recording", "processing"].includes(activeSession.phase)
  ) {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !String(tab.url || "").includes("meet.google.com")) {
    return;
  }

  const meetingState = await sendTabMessage(tab.id, {
    type: "GET_MEETING_STATE",
  }).catch(() => null);

  if (!meetingState?.onMeetingUrl || !meetingState?.inMeeting) {
    return;
  }

  autoActivationAttempted = true;
  await activateMomentum({ auto: true, source: "popup-open" });
}

async function activateMomentum({ auto = false, source = "button" } = {}) {
  if (activationInFlight) {
    return;
  }

  activationInFlight = true;

  try {
    activateButton.disabled = true;
    activateButton.innerText = auto ? "Auto-starting..." : "Checking Meet...";
    statusText.style.color = "#dbeafe";
    statusText.innerText = auto
      ? "Opening secure capture automatically..."
      : "Checking current Google Meet tab...";
    statusDetail.innerText = auto
      ? "Momentum saw a live Meet tab and is trying to start capture without the extra popup click."
      : "Momentum is looking for a live in-call Google Meet tab.";
    pipelineText.innerText = auto
      ? "Popup opened from an extension invocation. Recorder handshake in progress."
      : "Recorder request in progress.";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes("meet.google.com")) {
      throw new Error("Open a live Google Meet call before activating Momentum.");
    }

    const meetingState = await sendTabMessage(tab.id, { type: "GET_MEETING_STATE" });
    const meetingMetadata = await sendTabMessage(tab.id, {
      type: "GET_MEETING_METADATA",
    }).catch(() => ({}));

    if (!meetingState?.onMeetingUrl) {
      throw new Error("Open a Google Meet meeting link before activating Momentum.");
    }

    if (!meetingState?.inMeeting) {
      statusText.style.color = "#fde68a";
      statusText.innerText = "Meet tab detected";
      statusDetail.innerText =
        "Momentum could not confirm all live call controls yet, but it can still try secure capture for this Meet tab.";
      pipelineText.innerText =
        "Proceeding because Momentum was invoked directly from the extension.";
    }

    statusText.style.color = "#dbeafe";
    statusText.innerText = "Starting secure tab capture...";
    statusDetail.innerText =
      "Momentum is requesting protected audio access for this meeting.";
    pipelineText.innerText =
      "Recorder starting. Local recovery storage begins after the first 5-second chunk.";

    const response = await sendRuntimeMessage({
      type: "START_SILENT_RECORDING_EXTERNAL",
      tabId: tab.id,
      meetingCode: meetingState.meetingCode,
      meetingLabel: meetingMetadata.meetingLabel || "",
      participantNames: Array.isArray(meetingMetadata.participantNames)
        ? meetingMetadata.participantNames
        : [],
      source,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Momentum could not start recording.");
    }

    statusText.style.color = "#6ee7b7";
    statusText.innerText = "Momentum is live.";
    statusDetail.innerText =
      "Leaving the call will auto-finalize the recording and sync it afterward.";
    pipelineText.innerText =
      "Recording in progress. Open the Meet tab to watch live pipeline status.";
    activateButton.innerText = "Momentum Active";
    setTimeout(() => window.close(), 900);
  } catch (error) {
    statusText.style.color = "#fca5a5";
    statusText.innerText = auto ? "Auto-start paused" : "Activation blocked";
    statusDetail.innerText = error.message;
    pipelineText.innerText =
      String(error.message || "").toLowerCase().includes("current page") ||
      String(error.message || "").toLowerCase().includes("activetab")
        ? "Chrome still needs the extension invocation. Click the toolbar icon once more or use the keyboard shortcut."
        : "No recording started yet.";
    activateButton.disabled = false;
    activateButton.innerText = "Retry Activation";
  } finally {
    activationInFlight = false;
  }
}

async function hydratePopupState() {
  const response = await sendRuntimeMessage({ type: "GET_EXTENSION_RUNTIME_STATUS" });
  if (!response?.ok) {
    return;
  }

  renderRuntimeStatus(response.status);
  shortcutText.innerText = "Fast start: Alt+Shift+M from an active Google Meet tab.";
}

function renderRuntimeStatus(runtime) {
  const activeSession = runtime?.currentSession;
  const lastSession = runtime?.lastSession;
  const pendingSummary = runtime?.pendingSummary || {
    pendingCount: 0,
    uploadingCount: 0,
    lastError: "",
  };
  const staleStarting = isStaleStartingSession(activeSession);

  if (activeSession && !staleStarting) {
    statusText.style.color =
      activeSession.phase === "error"
        ? "#fca5a5"
        : activeSession.phase === "success"
          ? "#6ee7b7"
          : activeSession.phase === "retry"
            ? "#fde68a"
            : "#93c5fd";
    statusText.innerText = activeSession.status || "Momentum is working.";
    statusDetail.innerText =
      activeSession.detail || buildPendingSummaryText(pendingSummary);
    pipelineText.innerText = buildPipelineText(activeSession, pendingSummary);

    if (["starting", "recording", "processing"].includes(activeSession.phase)) {
      activateButton.disabled = true;
      activateButton.innerText =
        activeSession.phase === "recording" ? "Momentum Active" : "Sync in Progress";
    } else {
      activateButton.disabled = false;
      activateButton.innerText = "Activate Momentum";
    }
    return;
  }

  if (staleStarting) {
    statusText.style.color = "#fca5a5";
    statusText.innerText = "Capture start timed out";
    statusDetail.innerText =
      "Chrome never finished the secure tab-capture handshake. Press Activate again.";
    pipelineText.innerText = "Previous start attempt expired before recording began.";
    activateButton.disabled = false;
    activateButton.innerText = "Retry Activation";
    return;
  }

  if (pendingSummary.pendingCount > 0) {
    statusText.style.color = "#fde68a";
    statusText.innerText = `${pendingSummary.pendingCount} saved meeting${
      pendingSummary.pendingCount === 1 ? "" : "s"
    } waiting to sync.`;
    statusDetail.innerText =
      pendingSummary.lastError ||
      "Momentum kept a local copy and will retry automatically when Chrome stays open long enough.";
    pipelineText.innerText = `Retry queue active. Pending uploads: ${pendingSummary.pendingCount}.`;
    activateButton.disabled = false;
    activateButton.innerText = "Activate Momentum";
    return;
  }

  if (pendingSummary.uploadingCount > 0) {
    statusText.style.color = "#93c5fd";
    statusText.innerText = `Syncing ${pendingSummary.uploadingCount} saved meeting${
      pendingSummary.uploadingCount === 1 ? "" : "s"
    } in the background.`;
    statusDetail.innerText = "Momentum is retrying a previously saved upload.";
    pipelineText.innerText = `Background recovery upload active. In-flight uploads: ${pendingSummary.uploadingCount}.`;
    activateButton.disabled = false;
    activateButton.innerText = "Activate Momentum";
    return;
  }

  if (lastSession) {
    statusText.style.color =
      lastSession.phase === "success"
        ? "#6ee7b7"
        : lastSession.phase === "retry"
          ? "#fde68a"
          : lastSession.phase === "error"
            ? "#fca5a5"
            : "#cbd5e1";
    statusText.innerText = lastSession.status || "Momentum idle.";
    statusDetail.innerText =
      lastSession.detail || "No extra pipeline details were recorded.";
    pipelineText.innerText = buildPipelineText(lastSession, pendingSummary);
    activateButton.disabled = false;
    activateButton.innerText = "Activate Momentum";
    return;
  }

  statusText.style.color = "#cbd5e1";
  statusText.innerText = "Standby mode";
  statusDetail.innerText = "Open a live Meet tab and Momentum will try to start immediately.";
  pipelineText.innerText = "Recorder idle. Click the toolbar icon or use Alt+Shift+M to begin.";
  activateButton.disabled = false;
  activateButton.innerText = "Activate Momentum";
}

function buildPipelineText(session, pendingSummary) {
  const parts = [];

  if (session?.stage) {
    parts.push(`Stage: ${session.stage}`);
  }

  if (typeof session?.chunkCount === "number") {
    parts.push(`Local chunks: ${session.chunkCount}`);
  }

  if (session?.savedLocally) {
    parts.push("Audio preserved locally");
  }

  if (session?.retryPending) {
    parts.push("Retry queued");
  }

  if (pendingSummary.pendingCount > 0) {
    parts.push(`Pending uploads: ${pendingSummary.pendingCount}`);
  }

  if (pendingSummary.uploadingCount > 0) {
    parts.push(`Background uploads: ${pendingSummary.uploadingCount}`);
  }

  return (
    parts.filter(Boolean).join(" | ") ||
    "Recorder idle. Open a live Google Meet call to begin."
  );
}

function buildPendingSummaryText(pendingSummary) {
  if (pendingSummary.pendingCount > 0) {
    return `${pendingSummary.pendingCount} saved meeting${
      pendingSummary.pendingCount === 1 ? "" : "s"
    } waiting to sync.`;
  }

  return "No local meeting is waiting to sync.";
}

function isStaleStartingSession(session) {
  if (!session || session.phase !== "starting") {
    return false;
  }

  const startedAt = Number(session.startRequestedAt || session.updatedAt || 0);
  return startedAt > 0 && Date.now() - startedAt > 15000;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            "Momentum could not inspect the Google Meet page yet. Refresh the tab and try again."
          )
        );
        return;
      }

      resolve(response);
    });
  });
}
