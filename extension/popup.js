const statusText = document.getElementById("status-text");
const statusDetail = document.getElementById("status-detail");
const pipelineText = document.getElementById("pipeline-text");
const activateButton = document.getElementById("activate-btn");
const shortcutText = document.getElementById("shortcut-text");
const apiBaseUrlInput = document.getElementById("api-base-url");
const workspaceIdInput = document.getElementById("workspace-id");
const userIdInput = document.getElementById("user-id");
const connectionTokenInput = document.getElementById("connection-token");
const saveConfigButton = document.getElementById("save-config-btn");
const configStatus = document.getElementById("config-status");
const extensionVersionBadge = document.getElementById("extension-version");

let activationInFlight = false;
let autoActivationAttempted = false;

bootPopup().catch(() => {});

activateButton.onclick = async () => {
  await activateMomentum({ auto: false, source: "button" });
};

saveConfigButton?.addEventListener("click", async () => {
  await saveUploadConfig();
});

async function bootPopup() {
  if (extensionVersionBadge) {
    extensionVersionBadge.innerText = `v${chrome.runtime.getManifest().version}`;
  }

  await Promise.all([
    hydratePopupState().catch(() => {}),
    hydrateUploadConfig().catch(() => {}),
  ]);

  const contextResponse = await sendRuntimeMessage({
    type: "GET_POPUP_ENTRY_CONTEXT",
  }).catch(() => null);
  const popupContext = contextResponse?.ok ? contextResponse.context : null;

  if (popupContext?.mode === "programmatic") {
    statusText.style.color = "#cbd5e1";
    statusText.innerText = "Recorder opened from Meet";
    statusDetail.innerText =
      "Momentum opened from the in-meeting prompt and will try to begin capture automatically.";
    pipelineText.innerText =
      "Meet prompt handoff detected. Secure recorder handshake starting from the popup.";
  }

  setTimeout(() => {
    maybeAutoActivate(popupContext).catch(() => {});
  }, popupContext?.mode === "programmatic" ? 80 : 120);
}

async function maybeAutoActivate(popupContext = null) {
  if (autoActivationAttempted || activationInFlight) {
    return;
  }

  if (popupContext && popupContext.autoActivate === false) {
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

  const tab = await resolveTargetMeetTab(popupContext);
  if (!tab?.id || !String(tab.url || "").includes("meet.google.com")) {
    return;
  }

  const meetingState = await sendTabMessage(tab.id, {
    type: "GET_MEETING_STATE",
  }).catch(() => null);

  const meetingCode = meetingState?.meetingCode || popupContext?.meetingCode || getMeetingCode(tab.url);
  if (!meetingState?.onMeetingUrl && !meetingCode) {
    return;
  }

  autoActivationAttempted = true;
  await activateMomentum({
    auto: true,
    source: popupContext?.source || "popup-open",
    tabHint: tab,
    metadataHint: popupContext,
  });
}

async function activateMomentum({
  auto = false,
  source = "button",
  tabHint = null,
  metadataHint = null,
} = {}) {
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

    const tab = tabHint || (await resolveTargetMeetTab(metadataHint));
    if (!tab?.id || !tab.url?.includes("meet.google.com")) {
      throw new Error("Open a live Google Meet call before activating Momentum.");
    }

    const meetingState = await sendTabMessage(tab.id, { type: "GET_MEETING_STATE" }).catch(
      () => null
    );
    const meetingMetadata = await sendTabMessage(tab.id, {
      type: "GET_MEETING_METADATA",
    }).catch(() => ({}));
    const meetingCode =
      meetingState?.meetingCode ||
      meetingMetadata?.meetingCode ||
      metadataHint?.meetingCode ||
      getMeetingCode(tab.url);
    const meetingLabel =
      String(meetingMetadata?.meetingLabel || metadataHint?.meetingLabel || "").trim();
    const participantNames = mergeParticipantNames(
      meetingMetadata?.participantNames,
      metadataHint?.participantNames
    );

    if (!meetingState?.onMeetingUrl && !meetingCode) {
      throw new Error("Open a Google Meet meeting link before activating Momentum.");
    }

    if (meetingState && !meetingState.inMeeting) {
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
      meetingCode,
      meetingUrl: String(tab.url || metadataHint?.meetingUrl || ""),
      meetingLabel,
      participantNames,
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

async function hydrateUploadConfig() {
  if (!apiBaseUrlInput || !workspaceIdInput || !userIdInput || !connectionTokenInput) {
    return;
  }

  const response = await sendRuntimeMessage({
    type: "GET_EXTENSION_UPLOAD_CONFIG",
  }).catch(() => null);

  const config = response?.ok ? response.config || {} : {};
  apiBaseUrlInput.value = String(config.apiBaseUrl || "");
  workspaceIdInput.value = String(config.workspaceId || "");
  userIdInput.value = String(config.userId || "");
  connectionTokenInput.value = String(config.connectionToken || "");
  renderUploadConfigStatus(config, false);
}

async function saveUploadConfig() {
  if (!saveConfigButton) {
    return;
  }

  const nextConfig = {
    apiBaseUrl: String(apiBaseUrlInput?.value || "").trim().replace(/\/+$/, ""),
    workspaceId: String(workspaceIdInput?.value || "").trim(),
    userId: String(userIdInput?.value || "").trim(),
    connectionToken: String(connectionTokenInput?.value || "").trim(),
  };

  saveConfigButton.disabled = true;
  saveConfigButton.innerText = "Saving...";

  try {
    const response = await sendRuntimeMessage({
      type: "SET_EXTENSION_UPLOAD_CONFIG",
      config: nextConfig,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Momentum could not save the workspace link.");
    }

    renderUploadConfigStatus(response.config || nextConfig, true);
  } catch (error) {
    renderUploadConfigError(
      error?.message || "Momentum could not save the workspace link."
    );
  } finally {
    saveConfigButton.disabled = false;
    saveConfigButton.innerText = "Save workspace link";
  }
}

function renderUploadConfigStatus(config, saved) {
  if (!configStatus) {
    return;
  }

  configStatus.style.color = "#9fb0c8";

  if (config?.apiBaseUrl) {
    configStatus.innerText = saved
      ? `Workspace link saved. Uploads will use ${config.apiBaseUrl}.`
      : `Uploads currently point to ${config.apiBaseUrl}.`;
    return;
  }

  if (config?.connectionToken) {
    configStatus.innerText = saved
      ? "Workspace link saved. New uploads will include the saved connection token."
      : "Workspace link ready. New uploads will include the saved connection token.";
    return;
  }

  if (config?.workspaceId || config?.userId) {
    configStatus.innerText = saved
      ? "Workspace identifiers saved. Add a connection token later if you want tighter workspace routing."
      : "Workspace identifiers are present. Add a connection token later if you want tighter workspace routing.";
    return;
  }

  configStatus.innerText =
    "Optional: save a workspace link so uploads stay tied to the right Momentum workspace.";
}

function renderUploadConfigError(message) {
  if (!configStatus) {
    return;
  }

  configStatus.style.color = "#fca5a5";
  configStatus.innerText = message;
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

async function resolveTargetMeetTab(context = null) {
  if (context?.tabId) {
    const hintedTab = await chrome.tabs.get(context.tabId).catch(() => null);
    if (hintedTab?.id) {
      return hintedTab;
    }
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab || null;
}

function getMeetingCode(url) {
  const match = String(url || "").match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match ? match[1].toLowerCase() : "";
}

function mergeParticipantNames(...groups) {
  const names = new Map();

  groups
    .flat()
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .forEach((name) => {
      const key = name.toLowerCase();
      if (!names.has(key)) {
        names.set(key, name);
      }
    });

  return Array.from(names.values()).slice(0, 30);
}
