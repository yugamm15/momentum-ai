const OFFSCREEN_PATH = "offscreen.html";
const OFFSCREEN_REASON = "Capture and process Google Meet audio.";
const RUNTIME_STATUS_KEY = "momentum-runtime-status";
const CAPTURE_START_TIMEOUT_MS = 12000;
const OFFSCREEN_READY_TIMEOUT_MS = 5000;
const OFFSCREEN_PING_INTERVAL_MS = 250;
const RETRY_ALARM_NAME = "momentum-pending-upload-retry";
const RETRY_INTERVAL_MINUTES = 3;
const EXTENSION_UPLOAD_CONFIG_KEY = "momentum-extension-upload-config";
const DEFAULT_SHORTCUT_LABEL = "Alt+Shift+M";
const EXTENSION_VERSION = getExtensionVersion();
const POPUP_CONTEXT_TTL_MS = 8000;

let currentSession = null;
let lastSession = null;
let pendingSummary = createEmptyPendingSummary();
let popupEntryContext = null;
let offscreenReadyAt = 0;

restoreRuntimeState().catch(() => {});
updateActionState().catch(() => {});

chrome.runtime.onStartup.addListener(() => {
  initializeRuntime().catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  initializeRuntime().catch(() => {});
});

chrome.commands?.onCommand?.addListener((command) => {
  if (command !== "activate-momentum") {
    return;
  }

  activateFromCurrentMeetTab("keyboard shortcut").catch(async (error) => {
    await recordActivationFailure(error);
  });
});

chrome.action.onClicked.addListener((tab) => {
  activateFromToolbarClick(tab).catch(async (error) => {
    await recordActivationFailure(error, tab?.id);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== RETRY_ALARM_NAME) {
    return;
  }

  processPendingStoredMeetings().catch(() => {});
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "OFFSCREEN_READY") {
    offscreenReadyAt = Date.now();
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === "START_SILENT_RECORDING_EXTERNAL") {
    startSilentRecording(request.tabId || sender.tab?.id, {
      meetingCode: request.meetingCode,
      meetingLabel: request.meetingLabel,
      meetingUrl: request.meetingUrl || sender.tab?.url || "",
      participantNames: Array.isArray(request.participantNames) ? request.participantNames : [],
    })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.type === "STOP_SILENT_RECORDING") {
    stopSilentRecording("Finalizing the meeting audio...")
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.type === "GET_TAB_SESSION_STATE") {
    const tabId = sender.tab?.id;
    sendResponse(getSessionStateForTab(tabId));
    return false;
  }

  if (request.type === "GET_EXTENSION_RUNTIME_STATUS") {
    getExtensionRuntimeStatus()
      .then((status) => sendResponse({ ok: true, status }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.type === "GET_POPUP_ENTRY_CONTEXT") {
    const context = consumePopupEntryContext();
    sendResponse({ ok: true, context });
    return false;
  }

  if (request.type === "GET_EXTENSION_UPLOAD_CONFIG") {
    getExtensionUploadConfig()
      .then((config) => sendResponse({ ok: true, config }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.type === "SET_EXTENSION_UPLOAD_CONFIG") {
    setExtensionUploadConfig(request.config || {})
      .then((config) => sendResponse({ ok: true, config }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.type === "OPEN_CAPTURE_POPUP") {
    openCapturePopup({
      tabId: request.tabId || sender.tab?.id,
    })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.type === "MEETING_LEAVE_TRIGGERED") {
    stopSilentRecording("You left the meeting. Finalizing audio...", {
      meetingCode: request.meetingCode,
      meetingLabel: request.meetingLabel,
      meetingUrl: request.meetingUrl || sender.tab?.url || "",
      participantNames: Array.isArray(request.participantNames) ? request.participantNames : [],
    })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.type === "SESSION_PROGRESS") {
    updateSessionState({
      tabId: request.tabId,
      phase: request.phase,
      status: request.status,
      detail: request.detail,
      stage: request.stage,
      sessionId: request.sessionId,
      chunkCount: request.chunkCount,
      savedLocally: request.savedLocally,
      retryPending: request.retryPending,
      lastError: request.lastError,
      terminal: Boolean(request.terminal),
    });
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === "SESSION_HEARTBEAT") {
    if (currentSession?.tabId === request.tabId) {
      chrome.tabs.sendMessage(request.tabId, { type: "SHOW_AUDIO_HEARTBEAT" }).catch(() => {});
      refreshActiveMeetingMetadata(request.tabId)
        .then((metadata) =>
          sendRuntimeMessage({
            type: "UPDATE_RECORDING_METADATA",
            target: "offscreen",
            tabId: request.tabId,
            meetingCode: metadata.meetingCode,
            meetingUrl: metadata.meetingUrl,
            meetingLabel: metadata.meetingLabel,
            participantNames: metadata.participantNames,
          }).catch(() => {})
        )
        .catch(() => {});
    }
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === "SYNC_QUEUE_SUMMARY") {
    pendingSummary = normalizePendingSummary(request.summary);
    persistRuntimeState().catch(() => {});
    updateActionState().catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === "OFFSCREEN_RECORDING_STARTED") {
    updateSessionState({
      tabId: request.tabId,
      phase: "recording",
      status: "Recording live audio",
      detail: request.detail || "Saving secure 5-second recovery chunks on this device.",
      stage: "recording",
      sessionId: request.sessionId,
      chunkCount: request.chunkCount ?? 0,
      savedLocally: Boolean(request.savedLocally),
      retryPending: false,
      startedAt: Date.now(),
      terminal: false,
      lastError: "",
    });
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === "OFFSCREEN_RECORDING_ERROR") {
    updateSessionState({
      tabId: request.tabId,
      phase: "error",
      status: request.error || "Recording could not start.",
      detail: request.detail || "Momentum could not open the audio engine for this tab.",
      stage: "error",
      lastError: request.error || "Recording could not start.",
      terminal: true,
    });
    closeOffscreenDocument().catch(() => {});
    scheduleSessionCleanup(request.tabId, 20000);
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === "OFFSCREEN_PROCESSING_DEFERRED") {
    updateSessionState({
      tabId: request.tabId,
      phase: "retry",
      status: request.status || "Audio saved locally. Sync will retry automatically.",
      detail:
        request.detail ||
        "Momentum kept a local copy of this meeting and will retry after Chrome is reopened.",
      stage: "retry",
      sessionId: request.sessionId,
      chunkCount: request.chunkCount,
      savedLocally: true,
      retryPending: true,
      lastError: request.error || "",
      terminal: true,
    });
    closeOffscreenDocument().catch(() => {});
    refreshPendingSummary().catch(() => {});
    scheduleSessionCleanup(request.tabId, 30000);
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === "OFFSCREEN_PROCESSING_COMPLETE") {
    updateSessionState({
      tabId: request.tabId,
      phase: "success",
      status: request.status || "Meeting analysis complete.",
      detail: request.detail || "The meeting is synced and ready inside Momentum.",
      stage: "complete",
      meetingId: request.meetingId,
      retryPending: false,
      lastError: "",
      terminal: true,
    });
    closeOffscreenDocument().catch(() => {});
    refreshPendingSummary().catch(() => {});
    scheduleSessionCleanup(request.tabId, 20000);
    sendResponse({ ok: true });
    return false;
  }

  if (request.type === "OFFSCREEN_PROCESSING_FAILED") {
    updateSessionState({
      tabId: request.tabId,
      phase: "error",
      status: request.error || "Meeting processing failed.",
      detail: request.detail || "Momentum could not sync this meeting and no retry is queued yet.",
      stage: "error",
      retryPending: false,
      lastError: request.error || "Meeting processing failed.",
      terminal: true,
    });
    closeOffscreenDocument().catch(() => {});
    refreshPendingSummary().catch(() => {});
    scheduleSessionCleanup(request.tabId, 20000);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!currentSession || currentSession.tabId !== tabId || currentSession.phase !== "recording") {
    return;
  }

  const nextUrl = changeInfo.url || tab.url;
  if (!nextUrl) {
    return;
  }

  const nextMeetingCode = getMeetingCode(nextUrl);
  if (!nextMeetingCode || nextMeetingCode !== currentSession.meetingCode) {
    stopSilentRecording("Meeting tab changed. Finalizing audio...").catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (!currentSession || currentSession.tabId !== tabId || currentSession.phase !== "recording") {
    return;
  }

  stopSilentRecording("Meeting tab closed. Finalizing audio...").catch(() => {});
});

async function initializeRuntime() {
  await restoreRuntimeState();
  await reconcileInterruptedSession();
  await refreshPendingSummary();
  await processPendingStoredMeetings();
  await syncRetryAlarm();
}

async function startSilentRecording(tabId, metadata = {}) {
  if (!tabId) {
    throw new Error("Missing Google Meet tab.");
  }

  const tab = await chrome.tabs.get(tabId);
  const liveMetadata = await getMeetingMetadataForTab(tabId);
  const meetingCode =
    metadata.meetingCode || liveMetadata?.meetingCode || getMeetingCode(tab.url || "");
  const meetingUrl = String(metadata.meetingUrl || tab.url || "").trim();
  const meetingLabel = String(metadata.meetingLabel || liveMetadata?.meetingLabel || "").trim();
  const participantNames = mergeParticipantNames(
    metadata.participantNames,
    liveMetadata?.participantNames,
    currentSession?.tabId === tabId ? currentSession?.participantNames : []
  );
  if (!meetingCode) {
    throw new Error("Join a Google Meet call before activating Momentum.");
  }

  if (currentSession && ["starting", "recording", "processing"].includes(currentSession.phase)) {
    throw new Error("Momentum is already recording another meeting.");
  }

  updateSessionState({
    tabId,
    meetingCode,
    meetingUrl,
    meetingLabel,
    participantNames,
    phase: "starting",
    status: "Starting secure tab capture...",
    detail: "Momentum is requesting protected audio access for this Google Meet tab.",
    stage: "starting",
    startedAt: null,
    chunkCount: 0,
    savedLocally: false,
    retryPending: false,
    terminal: false,
    lastError: "",
    startRequestedAt: Date.now(),
  });

  try {
    const uploadConfig = await getExtensionUploadConfig();
    await ensureOffscreenDocument();
    await waitForOffscreenReady();

    const streamId = await getMediaStreamId(tabId);
    const response = await sendRuntimeMessage({
      type: "START_RECORDING",
      target: "offscreen",
      streamId,
      tabId,
      meetingCode,
      meetingUrl,
      meetingLabel,
      participantNames,
      apiBaseUrl: uploadConfig.apiBaseUrl || "",
      extensionVersion: EXTENSION_VERSION,
      connectionToken: uploadConfig.connectionToken || "",
      workspaceId: uploadConfig.workspaceId || "",
      userId: uploadConfig.userId || "",
    });
    if (response?.ok === false) {
      throw new Error(response.error || "Momentum could not start the audio engine.");
    }

    if (response?.started && currentSession?.phase === "starting") {
      updateSessionState({
        tabId,
        meetingCode,
        meetingUrl,
        meetingLabel,
        participantNames,
        phase: "recording",
        status: "Recording live audio",
        detail: response.started.detail || "Saving secure 5-second recovery chunks on this device.",
        stage: "recording",
        sessionId: response.started.sessionId,
        chunkCount: response.started.chunkCount ?? 0,
        savedLocally: Boolean(response.started.savedLocally),
        retryPending: false,
        startedAt: Date.now(),
        terminal: false,
        lastError: "",
      });
    }
  } catch (error) {
    const { status, detail } = describeCaptureStartError(error);
    updateSessionState({
      tabId,
      meetingCode,
      meetingUrl,
      meetingLabel,
      participantNames,
      phase: "error",
      status,
      detail,
      stage: "error",
      terminal: true,
      lastError: error.message,
    });
    closeOffscreenDocument().catch(() => {});
    scheduleSessionCleanup(tabId, 25000);
    throw error;
  }
}

async function processPendingStoredMeetings() {
  if (currentSession && ["starting", "recording", "processing"].includes(currentSession.phase)) {
    return;
  }

  await ensureOffscreenDocument();
  try {
    await refreshPendingSummary(true);
    if (pendingSummary.pendingCount <= 0) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: "PROCESS_PENDING_UPLOADS",
      target: "offscreen",
    });
    if (response?.ok === false) {
      throw new Error(response.error || "Momentum could not resume the saved upload queue.");
    }
    await refreshPendingSummary(true);
  } finally {
    if (!currentSession) {
      closeOffscreenDocument().catch(() => {});
    }
  }
}

async function getExtensionRuntimeStatus() {
  await restoreRuntimeState();
  await reconcileInterruptedSession();
  await refreshPendingSummary();
  if (isStaleStartingSession(currentSession)) {
    lastSession = {
      ...currentSession,
      phase: "error",
      stage: "error",
      terminal: true,
      status: "Capture start timed out.",
      detail:
        "Chrome never finished the secure tab-capture handshake. Click the Momentum toolbar icon again or use the keyboard shortcut.",
      lastError: "Capture start timed out.",
      updatedAt: Date.now(),
    };
    currentSession = null;
    await persistRuntimeState();
    await updateActionState();
  }
  return buildRuntimeStatus();
}

async function reconcileInterruptedSession() {
  if (!currentSession || !["starting", "recording", "processing"].includes(currentSession.phase)) {
    return;
  }

  const phaseLabel =
    currentSession.phase === "recording"
      ? "recording"
      : currentSession.phase === "processing"
        ? "upload"
        : "capture start";

  lastSession = {
    ...currentSession,
    phase: "retry",
    stage: "recovery",
    terminal: true,
    retryPending: true,
    savedLocally: true,
    status: "Chrome restarted before Momentum finished syncing.",
    detail: `The previous ${phaseLabel} was interrupted. Any locally saved audio will retry automatically.`,
    lastError: "",
    updatedAt: Date.now(),
  };
  currentSession = null;
  await persistRuntimeState();
  await updateActionState();
}

async function refreshPendingSummary(offscreenAlreadyOpen = false) {
  let openedOffscreenHere = false;

  if (!offscreenAlreadyOpen) {
    await ensureOffscreenDocument();
    openedOffscreenHere = true;
  }

  try {
    const response = await sendRuntimeMessage({
      type: "GET_PENDING_UPLOAD_SUMMARY",
      target: "offscreen",
    }).catch(() => null);

    if (response?.ok === false || !response?.summary) {
      pendingSummary = normalizePendingSummary(pendingSummary);
    } else {
      pendingSummary = normalizePendingSummary(response.summary);
    }
  } finally {
    await persistRuntimeState().catch(() => {});
    await updateActionState().catch(() => {});
    await syncRetryAlarm().catch(() => {});

    if (openedOffscreenHere && !currentSession) {
      closeOffscreenDocument().catch(() => {});
    }
  }
}

async function openCapturePopup(context = {}) {
  return {
    opened: false,
    detail: `Chrome requires one direct extension click before tab audio capture can begin. Click the Momentum toolbar icon or press ${DEFAULT_SHORTCUT_LABEL} while the Google Meet tab is focused.`,
  };
}

async function stopSilentRecording(statusMessage, metadataPatch = {}) {
  if (!currentSession || currentSession.phase !== "recording") {
    return;
  }

  const freshMetadata = await refreshActiveMeetingMetadata(currentSession.tabId, metadataPatch);

  updateSessionState({
    tabId: currentSession.tabId,
    phase: "processing",
    status: statusMessage || "Finalizing the meeting audio...",
    detail: "Momentum is sealing the local copy and preparing the secure server upload.",
    stage: "stopping",
    terminal: false,
  });

  sendRuntimeMessage({
    type: "UPDATE_RECORDING_METADATA",
    target: "offscreen",
    tabId: currentSession.tabId,
    meetingCode: freshMetadata.meetingCode,
    meetingUrl: freshMetadata.meetingUrl,
    meetingLabel: freshMetadata.meetingLabel,
    participantNames: freshMetadata.participantNames,
  }).catch(() => {});

  sendRuntimeMessage({
    type: "STOP_RECORDING",
    target: "offscreen",
  }).catch(() => {});
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);

  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl],
    });

    if (contexts.length > 0) {
      return;
    }
  }

  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["USER_MEDIA"],
      justification: OFFSCREEN_REASON,
    });
  } catch (error) {
    if (!String(error?.message || "").includes("single offscreen document")) {
      throw error;
    }
  }
}

async function closeOffscreenDocument() {
  try {
    await chrome.offscreen.closeDocument();
  } catch (_) {}
  offscreenReadyAt = 0;
}

function waitForOffscreenReady() {
  return new Promise((resolve, reject) => {
    if (Date.now() - offscreenReadyAt < OFFSCREEN_READY_TIMEOUT_MS) {
      resolve();
      return;
    }

    let settled = false;
    let intervalId = null;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      chrome.runtime.onMessage.removeListener(handleReadyMessage);
      reject(new Error("The audio engine did not become ready in time."));
    }, OFFSCREEN_READY_TIMEOUT_MS);

    function finishReady() {
      if (settled) {
        return;
      }

      settled = true;
      offscreenReadyAt = Date.now();
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
      chrome.runtime.onMessage.removeListener(handleReadyMessage);
      resolve();
    }

    function handleReadyMessage(message) {
      if (message?.type === "OFFSCREEN_READY") {
        finishReady();
      }
    }

    async function pingOffscreen() {
      try {
        const response = await sendRuntimeMessage({
          type: "OFFSCREEN_PING",
          target: "offscreen",
        });
        if (response?.ok) {
          finishReady();
        }
      } catch (_) {}
    }

    chrome.runtime.onMessage.addListener(handleReadyMessage);
    pingOffscreen().catch(() => {});
    intervalId = setInterval(() => {
      pingOffscreen().catch(() => {});
    }, OFFSCREEN_PING_INTERVAL_MS);
  });
}

function getMediaStreamId(tabId) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject(
        new Error(
          "Chrome did not grant tab capture in time. Click the Momentum toolbar icon again or use Alt+Shift+M."
        )
      );
    }, CAPTURE_START_TIMEOUT_MS);

    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!streamId) {
        reject(new Error("Chrome blocked tab capture for this Meet tab."));
        return;
      }

      resolve(streamId);
    });
  });
}

function updateSessionState(nextState) {
  if (!nextState?.tabId) {
    return;
  }

  const previousState =
    currentSession && currentSession.tabId === nextState.tabId
      ? currentSession
      : {
          tabId: nextState.tabId,
          meetingCode: nextState.meetingCode || currentSession?.meetingCode || "",
          meetingUrl: nextState.meetingUrl || currentSession?.meetingUrl || "",
          meetingLabel: nextState.meetingLabel || currentSession?.meetingLabel || "",
          participantNames: nextState.participantNames || currentSession?.participantNames || [],
          startedAt: nextState.startedAt || currentSession?.startedAt || Date.now(),
          chunkCount: 0,
          savedLocally: false,
          retryPending: false,
          terminal: false,
          lastError: "",
        };

  currentSession = {
    ...previousState,
    ...nextState,
    meetingCode: nextState.meetingCode ?? previousState.meetingCode,
    meetingUrl: nextState.meetingUrl ?? previousState.meetingUrl,
    meetingLabel: nextState.meetingLabel ?? previousState.meetingLabel,
    participantNames: nextState.participantNames ?? previousState.participantNames,
    startedAt:
      nextState.startedAt === null
        ? previousState.startedAt
        : nextState.startedAt || previousState.startedAt || Date.now(),
    updatedAt: Date.now(),
  };

  if (currentSession.terminal) {
    lastSession = { ...currentSession };
  }

  relaySessionState();
  persistRuntimeState().catch(() => {});
  updateActionState().catch(() => {});
  syncRetryAlarm().catch(() => {});
}

function relaySessionState() {
  if (!currentSession?.tabId) {
    return;
  }

  chrome.tabs
    .sendMessage(currentSession.tabId, {
      type: "SYNC_SESSION_STATE",
      session: currentSession,
    })
    .catch(() => {});
}

function getSessionStateForTab(tabId) {
  if (!currentSession || currentSession.tabId !== tabId) {
    return null;
  }

  return currentSession;
}

function scheduleSessionCleanup(tabId, delayMs = 15000) {
  setTimeout(() => {
    if (currentSession?.tabId === tabId && currentSession.terminal) {
      currentSession = null;
      persistRuntimeState().catch(() => {});
      updateActionState().catch(() => {});
      syncRetryAlarm().catch(() => {});
    }
  }, delayMs);
}

async function syncRetryAlarm() {
  const shouldRetry = pendingSummary.pendingCount > 0 || currentSession?.phase === "retry";

  if (!chrome.alarms?.create) {
    return;
  }

  if (!shouldRetry) {
    await chrome.alarms.clear(RETRY_ALARM_NAME).catch(() => {});
    return;
  }

  try {
    chrome.alarms.create(RETRY_ALARM_NAME, {
      delayInMinutes: RETRY_INTERVAL_MINUTES,
      periodInMinutes: RETRY_INTERVAL_MINUTES,
    });
  } catch (_) {}
}

async function restoreRuntimeState() {
  const stored = await chrome.storage.local.get(RUNTIME_STATUS_KEY).catch(() => ({}));
  const runtime = stored?.[RUNTIME_STATUS_KEY];

  currentSession = runtime?.currentSession || currentSession || null;
  lastSession = runtime?.lastSession || lastSession || null;
  pendingSummary = normalizePendingSummary(runtime?.pendingSummary);
}

async function persistRuntimeState() {
  await chrome.storage.local
    .set({
      [RUNTIME_STATUS_KEY]: buildRuntimeStatus(),
    })
    .catch(() => {});
}

function buildRuntimeStatus() {
  return {
    currentSession,
    lastSession,
    pendingSummary,
    updatedAt: Date.now(),
  };
}

async function updateActionState() {
  let badgeText = "";
  let badgeColor = "#2563eb";
  let title = "Momentum AI";

  if (currentSession?.phase === "recording") {
    badgeText = "REC";
    badgeColor = "#dc2626";
    title = `Momentum AI: ${currentSession.status || "Recording live audio"}`;
  } else if (currentSession && ["starting", "processing"].includes(currentSession.phase)) {
    badgeText = "SYNC";
    badgeColor = "#2563eb";
    title = `Momentum AI: ${currentSession.status || "Syncing meeting"}`;
  } else if (currentSession?.phase === "retry") {
    badgeText = String(Math.max(1, pendingSummary.pendingCount || 1));
    badgeColor = "#d97706";
    title = `Momentum AI: ${currentSession.status || "Meeting saved locally and waiting to retry."}`;
  } else if (currentSession?.phase === "error") {
    badgeText = "!";
    badgeColor = "#dc2626";
    title = `Momentum AI: ${currentSession.status || "Attention needed."}`;
  } else if (pendingSummary.uploadingCount > 0) {
    badgeText = "SYNC";
    badgeColor = "#2563eb";
    title = `Momentum AI: syncing ${pendingSummary.uploadingCount} saved meeting${pendingSummary.uploadingCount === 1 ? "" : "s"} in the background.`;
  } else if (pendingSummary.pendingCount > 0) {
    badgeText = String(Math.min(9, pendingSummary.pendingCount));
    badgeColor = "#d97706";
    title = `Momentum AI: ${pendingSummary.pendingCount} saved meeting${pendingSummary.pendingCount === 1 ? "" : "s"} waiting to sync.`;
  }

  await chrome.action.setBadgeBackgroundColor({ color: badgeColor }).catch(() => {});
  await chrome.action.setBadgeText({ text: badgeText }).catch(() => {});
  await chrome.action.setTitle({ title }).catch(() => {});
}

function createEmptyPendingSummary() {
  return {
    pendingCount: 0,
    uploadingCount: 0,
    lastError: "",
    updatedAt: 0,
  };
}

function normalizePendingSummary(summary) {
  return {
    pendingCount: Number(summary?.pendingCount || 0),
    uploadingCount: Number(summary?.uploadingCount || 0),
    lastError: String(summary?.lastError || ""),
    updatedAt: Number(summary?.updatedAt || Date.now()),
  };
}

function isStaleStartingSession(session) {
  if (!session || session.phase !== "starting") {
    return false;
  }

  const requestedAt = Number(session.startRequestedAt || session.updatedAt || 0);
  return requestedAt > 0 && Date.now() - requestedAt > CAPTURE_START_TIMEOUT_MS + 3000;
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

function describeCaptureStartError(error) {
  const message = String(error?.message || "");
  const lower = message.toLowerCase();

  if (lower.includes("invoked for the current page") || lower.includes("activeTab".toLowerCase())) {
    return {
      status: "Use the extension button to start capture.",
      detail:
        "Chrome only allows tab audio capture after you click the Momentum toolbar button directly or use Alt+Shift+M while the Meet tab is focused.",
    };
  }

  if (lower.includes("blocked tab capture")) {
    return {
      status: "Chrome blocked this Meet tab.",
      detail: "Click the Momentum extension button and try again while the Meet tab is still active.",
    };
  }

  return {
    status: "Recording could not start.",
    detail: message || "Momentum could not start secure tab capture for this meeting.",
  };
}

function getMeetingCode(url) {
  const match = String(url || "").match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match ? match[1].toLowerCase() : "";
}

async function getExtensionUploadConfig() {
  const stored = await chrome.storage.local.get(EXTENSION_UPLOAD_CONFIG_KEY).catch(() => ({}));
  const config = stored?.[EXTENSION_UPLOAD_CONFIG_KEY] || {};

  return {
    apiBaseUrl: String(config.apiBaseUrl || ""),
    connectionToken: String(config.connectionToken || ""),
    workspaceId: String(config.workspaceId || ""),
    userId: String(config.userId || ""),
  };
}

async function setExtensionUploadConfig(config) {
  const nextConfig = {
    apiBaseUrl: String(config.apiBaseUrl || "").trim().replace(/\/+$/, ""),
    connectionToken: String(config.connectionToken || "").trim(),
    workspaceId: String(config.workspaceId || "").trim(),
    userId: String(config.userId || "").trim(),
  };

  await chrome.storage.local
    .set({
      [EXTENSION_UPLOAD_CONFIG_KEY]: nextConfig,
    })
    .catch(() => {});

  return nextConfig;
}

function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.()?.version || "unknown";
  } catch {
    return "unknown";
  }
}

function consumePopupEntryContext() {
  const context = popupEntryContext;
  popupEntryContext = null;

  if (!context) {
    return null;
  }

  if (Date.now() - Number(context.createdAt || 0) > POPUP_CONTEXT_TTL_MS) {
    return null;
  }

  return context;
}

async function activateFromCurrentMeetTab(sourceLabel) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id || !String(tab.url || "").includes("meet.google.com")) {
    throw new Error(
      `Open a live Google Meet call before using Momentum from the ${sourceLabel}.`
    );
  }

  const metadata = await getMeetingMetadataForTab(tab.id);
  await startSilentRecording(tab.id, {
    meetingCode: metadata?.meetingCode || getMeetingCode(tab.url || ""),
    meetingUrl: tab.url || "",
    meetingLabel: metadata?.meetingLabel || "",
    participantNames: Array.isArray(metadata?.participantNames)
      ? metadata.participantNames
      : [],
  });
}

async function activateFromToolbarClick(tab) {
  if (!tab?.id || !String(tab.url || "").includes("meet.google.com")) {
    throw new Error("Open a live Google Meet tab, then click the Momentum toolbar icon.");
  }

  const metadata = await getMeetingMetadataForTab(tab.id);
  await startSilentRecording(tab.id, {
    meetingCode: metadata?.meetingCode || getMeetingCode(tab.url || ""),
    meetingUrl: tab.url || "",
    meetingLabel: metadata?.meetingLabel || "",
    participantNames: Array.isArray(metadata?.participantNames)
      ? metadata.participantNames
      : [],
  });
}

async function getMeetingMetadataForTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "GET_MEETING_METADATA" });
  } catch {
    return {};
  }
}

async function refreshActiveMeetingMetadata(tabId, metadataPatch = {}) {
  const activeTab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
  const liveMetadata = tabId ? await getMeetingMetadataForTab(tabId) : {};
  const merged = {
    meetingCode: String(
      metadataPatch.meetingCode ||
        liveMetadata?.meetingCode ||
        currentSession?.meetingCode ||
        getMeetingCode(activeTab?.url || "")
    ).trim(),
    meetingUrl: String(
      metadataPatch.meetingUrl || activeTab?.url || currentSession?.meetingUrl || ""
    ).trim(),
    meetingLabel: String(
      metadataPatch.meetingLabel || liveMetadata?.meetingLabel || currentSession?.meetingLabel || ""
    ).trim(),
    participantNames: mergeParticipantNames(
      metadataPatch.participantNames,
      liveMetadata?.participantNames,
      currentSession?.participantNames
    ),
  };

  if (currentSession?.tabId === tabId) {
    updateSessionState({
      tabId,
      meetingCode: merged.meetingCode,
      meetingUrl: merged.meetingUrl,
      meetingLabel: merged.meetingLabel,
      participantNames: merged.participantNames,
    });
  }

  return merged;
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

async function recordActivationFailure(error, tabId = null) {
  lastSession = {
    phase: "error",
    stage: "error",
    terminal: true,
    status: "Momentum could not start recording.",
    detail:
      error?.message ||
      `Chrome blocked the activation request. Try clicking the toolbar icon or using ${DEFAULT_SHORTCUT_LABEL} again on the live Meet tab.`,
    retryPending: false,
    savedLocally: false,
    lastError: error?.message || "Activation failed.",
    updatedAt: Date.now(),
  };

  if (tabId) {
    chrome.tabs
      .sendMessage(tabId, {
        type: "SYNC_SESSION_STATE",
        session: {
          tabId,
          phase: "error",
          stage: "error",
          terminal: true,
          status: "Use the extension button to start capture.",
          detail:
            error?.message ||
            `Chrome needs a direct toolbar click or ${DEFAULT_SHORTCUT_LABEL} on the live Meet tab before capture can begin.`,
          lastError: error?.message || "Activation failed.",
          updatedAt: Date.now(),
        },
      })
      .catch(() => {});
  }

  await persistRuntimeState().catch(() => {});
  await updateActionState().catch(() => {});
}
