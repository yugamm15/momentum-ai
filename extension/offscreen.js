const PROCESS_UPLOAD_URL = "https://momentum-ai-meet.vercel.app/api/process-meeting-upload";
const CHUNK_TIMESLICE_MS = 5000;
const ENGINE_START_TIMEOUT_MS = 12000;
const FALLBACK_EXTENSION_VERSION = "unknown";

const DB_NAME = "momentum-recordings";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const CHUNK_STORE = "chunks";

let activeSession = null;

chrome.runtime.sendMessage({
  type: "OFFSCREEN_READY",
}).catch(() => {});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OFFSCREEN_PING") {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" }).catch(() => {});
    sendResponse({ ok: true, ready: true });
    return false;
  }

  if (message.target !== "offscreen") {
    return false;
  }

  if (message.type === "START_RECORDING") {
    startRecordingSession(message)
      .then((started) => sendResponse({ ok: true, started }))
      .catch(async (error) => {
        const failedTabId = activeSession?.tabId || message.tabId;
        cleanupLiveSession();
        chrome.runtime
          .sendMessage({
            type: "OFFSCREEN_RECORDING_ERROR",
            tabId: failedTabId,
            error: error.message,
            detail: "Momentum could not start capturing this Meet tab.",
          })
          .catch(() => {});
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === "STOP_RECORDING") {
    stopRecordingSession(message.reason)
      .then(() => sendResponse({ ok: true }))
      .catch(async (error) => {
        chrome.runtime
          .sendMessage({
            type: "OFFSCREEN_PROCESSING_FAILED",
            tabId: activeSession?.tabId,
            error: error.message,
            detail: "Momentum hit an unexpected problem while sealing the local audio copy.",
          })
          .catch(() => {});
        cleanupLiveSession();
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === "UPDATE_RECORDING_METADATA") {
    updateActiveSessionMetadata(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "PROCESS_PENDING_UPLOADS") {
    recoverPendingSessions()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_PENDING_UPLOAD_SUMMARY") {
    getPendingUploadSummary()
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch((error) => sendResponse({ ok: false, error: error.message, summary: emptySummary() }));
    return true;
  }

  return false;
});

async function startRecordingSession({
  streamId,
  tabId,
  meetingCode,
  meetingUrl,
  meetingLabel,
  participantNames,
  apiBaseUrl,
  extensionVersion,
  connectionToken,
  workspaceId,
  userId,
}) {
  if (activeSession) {
    throw new Error("A meeting is already being captured.");
  }

  let sessionId = "";

  try {
    const stream = await withTimeout(
      navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
      }),
      ENGINE_START_TIMEOUT_MS,
      "Chrome granted capture, but the meeting audio stream never opened."
    );
    const microphoneStream = await getOptionalMicrophoneStream();

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const captureRouter = await createCaptureRouter(stream, microphoneStream);
    const recorder = new MediaRecorder(captureRouter.recordingStream, { mimeType });

    let resolveStop;
    let rejectStop;
    const stopPromise = new Promise((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
    });

    sessionId = crypto.randomUUID();
    activeSession = {
      sessionId,
      tabId,
      meetingCode,
      meetingUrl,
      meetingLabel: String(meetingLabel || ""),
      participantNames: Array.isArray(participantNames) ? participantNames : [],
      apiBaseUrl: String(apiBaseUrl || "").trim().replace(/\/+$/, ""),
      connectionToken: String(connectionToken || ""),
      workspaceId: String(workspaceId || ""),
      userId: String(userId || ""),
      mimeType,
      extensionVersion: safeExtensionVersion(extensionVersion),
      stream,
      microphoneStream,
      liveMonitor: captureRouter,
      recorder,
      pendingWrites: new Set(),
      nextChunkIndex: 0,
      chunkCount: 0,
      startedAt: Date.now(),
      stopPromise,
      resolveStop,
      rejectStop,
      state: "recording",
      finalError: null,
    };

    await upsertStoredSession({
      sessionId,
      tabId,
      meetingCode,
      meetingUrl,
      meetingLabel: String(meetingLabel || ""),
      participantNames: Array.isArray(participantNames) ? participantNames : [],
      apiBaseUrl: String(apiBaseUrl || "").trim().replace(/\/+$/, ""),
      connectionToken: String(connectionToken || ""),
      workspaceId: String(workspaceId || ""),
      userId: String(userId || ""),
      mimeType,
      extensionVersion: safeExtensionVersion(extensionVersion),
      chunkCount: 0,
      state: "recording",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastError: "",
    });

    await reportQueueSummary();

    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0 || !activeSession) {
        return;
      }

      persistChunk(event.data).catch((error) => {
        if (activeSession) {
          activeSession.finalError = error;
        }

        if (recorder.state === "recording") {
          recorder.stop();
        }
      });
    };

    recorder.onerror = (event) => {
      rejectStop(new Error(event.error?.message || "Chrome failed to capture tab audio."));
    };

    recorder.onstop = async () => {
      const session = activeSession;

      try {
        await waitForPendingWrites(session);

        if (session?.finalError) {
          throw session.finalError;
        }

        if (!session) {
          throw new Error("Momentum lost the live recording state.");
        }

        if (!hasRecoverableAudio(session)) {
          throw new Error("Momentum could not preserve any local audio before the meeting ended.");
        }

        await notifyProgress(session.tabId, {
          phase: "processing",
          status: "Audio saved locally. Building final upload...",
          detail: `${session.chunkCount} recovery chunk${session.chunkCount === 1 ? "" : "s"} are sealed on this device.`,
          stage: "packaging",
          terminal: false,
          sessionId: session.sessionId,
          chunkCount: session.chunkCount,
          savedLocally: session.chunkCount > 0,
          retryPending: false,
          lastError: "",
        });

        await updateStoredSessionState(session.sessionId, "uploading", { lastError: "" });
        await reportQueueSummary();

        await notifyProgress(session.tabId, {
          phase: "processing",
          status: "Uploading saved audio to Momentum...",
          detail: `${session.chunkCount} local chunk${session.chunkCount === 1 ? "" : "s"} merged into one upload.`,
          stage: "uploading",
          terminal: false,
          sessionId: session.sessionId,
          chunkCount: session.chunkCount,
          savedLocally: true,
          retryPending: false,
          lastError: "",
        });

        const result = await uploadStoredSession(session.sessionId);

        session.resolveStop();
        chrome.runtime.sendMessage({
          type: "OFFSCREEN_PROCESSING_COMPLETE",
          tabId: session.tabId,
          meetingId: result.meetingId,
          status:
            result.analysisComplete === false
              ? result.meetingTitle
                ? `Audio synced: ${result.meetingTitle}`
                : "Meeting audio synced. AI analysis is pending."
              : result.meetingTitle
                ? `Meeting ready: ${result.meetingTitle}`
                : "Meeting analysis complete.",
          detail:
            result.detail ||
            (result.analysisComplete === false
              ? "Raw meeting audio is safely stored on the server. Finish AI analysis from the dashboard later."
              : "Transcript, summary, and extracted tasks are now ready in Momentum."),
        });
      } catch (error) {
        if (session?.sessionId && hasRecoverableAudio(session)) {
          await markSessionForRetry(session.sessionId, error.message);
          await reportQueueSummary();

          session?.rejectStop(error);
          chrome.runtime
            .sendMessage({
              type: "OFFSCREEN_PROCESSING_DEFERRED",
              tabId: session?.tabId,
              sessionId: session.sessionId,
              chunkCount: session.chunkCount,
              error: error.message,
              status: "Audio saved locally. Sync will retry automatically.",
              detail:
                "Momentum kept this meeting on your device because the server sync did not finish. Reopen Chrome or keep it open to retry.",
            })
            .catch(() => {});
        } else {
          if (session?.sessionId) {
            await clearStoredSession(session.sessionId).catch(() => {});
            await reportQueueSummary();
          }

          session?.rejectStop(error);
          chrome.runtime
            .sendMessage({
              type: "OFFSCREEN_PROCESSING_FAILED",
              tabId: session?.tabId,
              error: error.message,
              detail: "Momentum could not keep a recoverable local copy for retry.",
            })
            .catch(() => {});
        }
      } finally {
        cleanupLiveSession();
      }
    };

    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => {
        if (activeSession?.state === "recording") {
          stopRecordingSession("Capture ended. Uploading audio to Momentum...").catch(() => {});
        }
      });
    }

    recorder.start(CHUNK_TIMESLICE_MS);

    const startedPayload = {
      type: "OFFSCREEN_RECORDING_STARTED",
      tabId,
      sessionId,
      chunkCount: 0,
      savedLocally: false,
      detail: microphoneStream
        ? "Saving secure 5-second recovery chunks for tab audio and your local microphone."
        : "Saving secure 5-second recovery chunks on this device while you stay in the meeting.",
    };
    chrome.runtime.sendMessage(startedPayload).catch(() => {});
    return {
      sessionId,
      chunkCount: 0,
      savedLocally: false,
      detail: startedPayload.detail,
    };
  } catch (error) {
    if (sessionId) {
      await clearStoredSession(sessionId).catch(() => {});
      await reportQueueSummary();
    }

    cleanupLiveSession();
    throw error;
  }
}

async function stopRecordingSession(statusMessage) {
  if (!activeSession) {
    return;
  }

  if (activeSession.state !== "recording") {
    return activeSession.stopPromise;
  }

  activeSession.state = "processing";
  await notifyProgress(activeSession.tabId, {
    phase: "processing",
    status: statusMessage || "Finalizing captured audio...",
    detail: "Momentum is closing the recorder and preserving the local audio copy before upload.",
    stage: "stopping",
    terminal: false,
    sessionId: activeSession.sessionId,
    chunkCount: activeSession.chunkCount,
    savedLocally: activeSession.chunkCount > 0,
    retryPending: false,
    lastError: "",
  });
  activeSession.recorder.stop();
  return activeSession.stopPromise;
}

async function persistChunk(blob) {
  if (!activeSession) {
    return;
  }

  const session = activeSession;
  const chunkIndex = session.nextChunkIndex++;
  const nextChunkCount = session.chunkCount + 1;
  const writePromise = storeChunkBlob(session.sessionId, chunkIndex, blob).then(() =>
    touchStoredSession(session.sessionId, {
      chunkCount: nextChunkCount,
      updatedAt: Date.now(),
      state: session.state === "recording" ? "recording" : "processing",
      lastError: "",
    })
  );

  session.pendingWrites.add(writePromise);

  try {
    await writePromise;
    session.chunkCount = nextChunkCount;
    await notifyHeartbeat(session.tabId);
    await notifyProgress(session.tabId, {
      phase: "recording",
      status: "Recording live audio",
      detail: `${session.chunkCount} recovery chunk${session.chunkCount === 1 ? "" : "s"} safely saved on this device.`,
      stage: "recording",
      terminal: false,
      sessionId: session.sessionId,
      chunkCount: session.chunkCount,
      savedLocally: true,
      retryPending: false,
      lastError: "",
    });
  } finally {
    session.pendingWrites.delete(writePromise);
  }
}

async function waitForPendingWrites(session) {
  if (!session) {
    return;
  }

  const writes = Array.from(session.pendingWrites);
  if (!writes.length) {
    return;
  }

  await Promise.all(writes);
}

async function uploadStoredSession(sessionId) {
  const session = await getStoredSession(sessionId);
  if (!session) {
    throw new Error("Momentum could not find the saved meeting audio.");
  }

  const chunks = await getStoredChunks(sessionId);
  if (!chunks.length) {
    await clearStoredSession(sessionId);
    await reportQueueSummary();
    throw new Error("Momentum could not find any saved audio chunks for this meeting.");
  }

  const mimeType = session.mimeType || "audio/webm";
  const extension = getFileExtension(mimeType);
  const safeMeetingCode = sanitizeMeetingCode(session.meetingCode) || "meeting";
  const file = new File(
    chunks.map((chunk) => chunk.blob),
    `momentum_${safeMeetingCode}_${Date.now()}.${extension}`,
    { type: mimeType }
  );

  const result = await uploadAudioThroughServer(file, session, mimeType);
  await clearStoredSession(sessionId);
  await reportQueueSummary();
  return result;
}

async function uploadAudioThroughServer(file, session, mimeType) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("meetingCode", session.meetingCode || "");
  formData.append("meetingUrl", session.meetingUrl || "");
  formData.append("meetingLabel", session.meetingLabel || "");
  formData.append("contentType", mimeType);
  formData.append("sessionId", session.sessionId);
  formData.append("sourcePlatform", "google_meet");
  formData.append("extensionVersion", safeExtensionVersion(session.extensionVersion));
  formData.append("recordingStartedAt", new Date(session.startedAt || Date.now()).toISOString());
  formData.append("recordingStoppedAt", new Date().toISOString());
  formData.append("connectionToken", session.connectionToken || "");
  formData.append("workspaceId", session.workspaceId || "");
  formData.append("userId", session.userId || "");
  formData.append("participantNamesJson", JSON.stringify(Array.isArray(session.participantNames) ? session.participantNames : []));
  (Array.isArray(session.participantNames) ? session.participantNames : []).forEach((name) => {
    formData.append("participantNames", name);
  });

  const response = await fetch(resolveProcessUploadUrl(session.apiBaseUrl), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Momentum could not process the meeting audio."));
  }

  return await response.json();
}

async function recoverPendingSessions() {
  if (activeSession) {
    return;
  }

  const sessions = await listStoredSessions();
  const recoverable = sessions
    .filter((session) => session?.sessionId && session.state !== "complete")
    .sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0));

  await reportQueueSummary();

  for (const session of recoverable) {
    if (!hasRecoverableAudio(session)) {
      await clearStoredSession(session.sessionId).catch(() => {});
      await reportQueueSummary();
      continue;
    }

    try {
      await updateStoredSessionState(session.sessionId, "uploading", { lastError: "" });
      await reportQueueSummary();
      await uploadStoredSession(session.sessionId);
    } catch (error) {
      await markSessionForRetry(session.sessionId, error.message);
      await reportQueueSummary();
    }
  }
}

async function markSessionForRetry(sessionId, errorMessage) {
  await updateStoredSessionState(sessionId, "pending_upload", {
    lastError: String(errorMessage || "Momentum server sync failed.").slice(0, 500),
    updatedAt: Date.now(),
  });
}

function hasRecoverableAudio(session) {
  return Number(session?.chunkCount || 0) > 0;
}

async function updateActiveSessionMetadata(message = {}) {
  if (!activeSession || !message) {
    return;
  }

  const nextMeetingCode = String(message.meetingCode || activeSession.meetingCode || "").trim();
  const nextMeetingUrl = String(message.meetingUrl || activeSession.meetingUrl || "").trim();
  const nextMeetingLabel = String(message.meetingLabel || activeSession.meetingLabel || "").trim();
  const nextParticipantNames = mergeParticipantNames(
    activeSession.participantNames,
    message.participantNames
  );

  activeSession.meetingCode = nextMeetingCode;
  activeSession.meetingUrl = nextMeetingUrl;
  activeSession.meetingLabel = nextMeetingLabel;
  activeSession.participantNames = nextParticipantNames;

  await touchStoredSession(activeSession.sessionId, {
    meetingCode: nextMeetingCode,
    meetingUrl: nextMeetingUrl,
    meetingLabel: nextMeetingLabel,
    participantNames: nextParticipantNames,
    updatedAt: Date.now(),
  });
}

function cleanupLiveSession() {
  if (!activeSession) {
    return;
  }

  try {
    activeSession.liveMonitor?.sourceNode?.disconnect();
    activeSession.liveMonitor?.microphoneSourceNode?.disconnect();
    activeSession.liveMonitor?.microphoneGainNode?.disconnect();
    activeSession.liveMonitor?.playbackGainNode?.disconnect();
    activeSession.liveMonitor?.recordingDestination?.disconnect?.();
    activeSession.liveMonitor?.audioContext?.close?.();
    if (activeSession.liveMonitor?.playbackElement) {
      activeSession.liveMonitor.playbackElement.pause();
      activeSession.liveMonitor.playbackElement.srcObject = null;
      activeSession.liveMonitor.playbackElement.remove();
    }
  } catch (_) {}

  activeSession.liveMonitor?.recordingStream?.getTracks?.().forEach((track) => {
    try {
      track.stop();
    } catch (_) {}
  });
  activeSession.microphoneStream?.getTracks?.().forEach((track) => {
    try {
      track.stop();
    } catch (_) {}
  });
  activeSession.stream?.getTracks().forEach((track) => track.stop());
  activeSession = null;
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function notifyHeartbeat(tabId) {
  await chrome.runtime.sendMessage({
    type: "SESSION_HEARTBEAT",
    tabId,
  });
}

async function notifyProgress(tabId, payload) {
  await chrome.runtime.sendMessage({
    type: "SESSION_PROGRESS",
    tabId,
    ...payload,
  });
}

async function reportQueueSummary() {
  const summary = await getPendingUploadSummary();
  await sendRuntimeMessage({
    type: "SYNC_QUEUE_SUMMARY",
    summary,
  }).catch(() => {});
}

async function getPendingUploadSummary() {
  const sessions = await listStoredSessions();
  const pendingSessions = sessions.filter(
    (session) => session?.state === "pending_upload" && hasRecoverableAudio(session)
  );
  const uploadingSessions = sessions.filter(
    (session) => session?.state === "uploading" && hasRecoverableAudio(session)
  );
  const latestErroredSession = [...sessions]
    .filter((session) => session?.lastError)
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))[0];

  return {
    pendingCount: pendingSessions.length,
    uploadingCount: uploadingSessions.length,
    lastError: latestErroredSession?.lastError || "",
    updatedAt: Date.now(),
  };
}

function emptySummary() {
  return {
    pendingCount: 0,
    uploadingCount: 0,
    lastError: "",
    updatedAt: Date.now(),
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: "sessionId" });
      }

      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunkStore = db.createObjectStore(CHUNK_STORE, { keyPath: "key" });
        chunkStore.createIndex("sessionId", "sessionId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB could not be opened."));
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDatabase();

  return await new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    let result;
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB transaction failed."));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB transaction was aborted."));
    };

    try {
      const maybePromise = callback(store, transaction);
      Promise.resolve(maybePromise)
        .then((value) => {
          result = value;
        })
        .catch((error) => reject(error));
    } catch (error) {
      reject(error);
    }
  });
}

async function putRecord(storeName, value) {
  await withStore(storeName, "readwrite", (store) => {
    store.put(value);
  });
}

async function getRecord(storeName, key) {
  return await withStore(storeName, "readonly", (store) =>
    new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("IndexedDB read failed."));
    })
  );
}

async function getAllRecords(storeName) {
  return await withStore(storeName, "readonly", (store) =>
    new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("IndexedDB read failed."));
    })
  );
}

async function deleteRecord(storeName, key) {
  await withStore(storeName, "readwrite", (store) => {
    store.delete(key);
  });
}

async function upsertStoredSession(session) {
  const existing = await getStoredSession(session.sessionId);
  await putRecord(SESSION_STORE, {
    ...existing,
    ...session,
    updatedAt: Date.now(),
  });
}

async function touchStoredSession(sessionId, patch) {
  const existing = await getStoredSession(sessionId);
  if (!existing) {
    return;
  }

  await putRecord(SESSION_STORE, {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  });
}

async function updateStoredSessionState(sessionId, state, patch = {}) {
  await touchStoredSession(sessionId, {
    ...patch,
    state,
  });
}

async function getStoredSession(sessionId) {
  return await getRecord(SESSION_STORE, sessionId);
}

async function listStoredSessions() {
  return await getAllRecords(SESSION_STORE);
}

async function storeChunkBlob(sessionId, chunkIndex, blob) {
  await putRecord(CHUNK_STORE, {
    key: buildChunkKey(sessionId, chunkIndex),
    sessionId,
    chunkIndex,
    blob,
    createdAt: Date.now(),
  });
}

async function getStoredChunks(sessionId) {
  const chunks = await getAllRecords(CHUNK_STORE);
  return chunks
    .filter((chunk) => chunk.sessionId === sessionId)
    .sort((left, right) => left.chunkIndex - right.chunkIndex);
}

async function clearStoredSession(sessionId) {
  const chunks = await getStoredChunks(sessionId);

  for (const chunk of chunks) {
    await deleteRecord(CHUNK_STORE, chunk.key);
  }

  await deleteRecord(SESSION_STORE, sessionId);
}

function buildChunkKey(sessionId, chunkIndex) {
  return `${sessionId}:${String(chunkIndex).padStart(6, "0")}`;
}

function sanitizeMeetingCode(value) {
  return String(value || "").trim().replace(/[^a-z0-9-]/gi, "").slice(0, 32);
}

function resolveProcessUploadUrl(apiBaseUrl) {
  const baseUrl = String(apiBaseUrl || "").trim().replace(/\/+$/, "");
  if (baseUrl) {
    return `${baseUrl}/api/process-meeting-upload`;
  }

  return PROCESS_UPLOAD_URL;
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

function safeExtensionVersion(explicitVersion) {
  const provided = String(explicitVersion || "").trim();
  if (provided) {
    return provided;
  }

  try {
    return chrome?.runtime?.getManifest?.()?.version || FALLBACK_EXTENSION_VERSION;
  } catch {
    return FALLBACK_EXTENSION_VERSION;
  }
}

async function createCaptureRouter(stream, microphoneStream = null) {
  const playbackElement = await createPlaybackElement(stream);
  const recordingStream =
    typeof stream?.clone === "function" ? stream.clone() : stream;

  const shouldMixMicrophone =
    microphoneStream?.getAudioTracks?.().length > 0 && typeof AudioContext === "function";

  if (shouldMixMicrophone) {
    try {
      const audioContext = new AudioContext();
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const recordingDestination = audioContext.createMediaStreamDestination();
      const microphoneSourceNode = audioContext.createMediaStreamSource(microphoneStream);
      const microphoneGainNode = audioContext.createGain();
      let playbackGainNode = null;

      sourceNode.connect(recordingDestination);
      microphoneGainNode.gain.value = 1;
      microphoneSourceNode.connect(microphoneGainNode);
      microphoneGainNode.connect(recordingDestination);

      if (!playbackElement) {
        playbackGainNode = audioContext.createGain();
        playbackGainNode.gain.value = 1;
        sourceNode.connect(playbackGainNode);
        playbackGainNode.connect(audioContext.destination);
      }

      if (audioContext.state === "suspended") {
        await audioContext.resume().catch(() => {});
      }

      return {
        audioContext,
        sourceNode,
        microphoneSourceNode,
        microphoneGainNode,
        playbackGainNode,
        recordingDestination,
        playbackElement,
        recordingStream: recordingDestination.stream,
      };
    } catch {
      microphoneStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
    }
  }

  if (playbackElement || typeof AudioContext !== "function") {
    return {
      audioContext: null,
      sourceNode: null,
      microphoneSourceNode: null,
      microphoneGainNode: null,
      playbackGainNode: null,
      recordingDestination: null,
      playbackElement,
      recordingStream,
    };
  }

  try {
    const audioContext = new AudioContext();
    const sourceNode = audioContext.createMediaStreamSource(stream);
    const playbackGainNode = audioContext.createGain();

    if (playbackGainNode) {
      playbackGainNode.gain.value = 1;
      sourceNode.connect(playbackGainNode);
      playbackGainNode.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume().catch(() => {});
    }

    return {
      audioContext,
      sourceNode,
      microphoneSourceNode: null,
      microphoneGainNode: null,
      playbackGainNode,
      recordingDestination: null,
      playbackElement,
      recordingStream,
    };
  } catch {
    return {
      audioContext: null,
      sourceNode: null,
      microphoneSourceNode: null,
      microphoneGainNode: null,
      playbackGainNode: null,
      recordingDestination: null,
      playbackElement,
      recordingStream,
    };
  }
}

async function createPlaybackElement(stream) {
  try {
    const playbackElement = document.createElement("audio");
    playbackElement.autoplay = true;
    playbackElement.muted = false;
    playbackElement.playsInline = true;
    playbackElement.style.display = "none";
    playbackElement.srcObject = stream;
    document.body.appendChild(playbackElement);
    const started = await playbackElement
      .play()
      .then(() => true)
      .catch(() => false);
    if (!started) {
      playbackElement.remove();
      return null;
    }
    return playbackElement;
  } catch {
    return null;
  }
}

async function getOptionalMicrophoneStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch {
    return null;
  }
}

function getFileExtension(contentType) {
  const normalized = String(contentType || "").toLowerCase();

  if (normalized.includes("wav")) {
    return "wav";
  }

  if (normalized.includes("mp3") || normalized.includes("mpeg")) {
    return "mp3";
  }

  if (normalized.includes("m4a") || normalized.includes("mp4")) {
    return "m4a";
  }

  return "webm";
}

async function readErrorMessage(response, fallback) {
  const text = await response.text().catch(() => "");

  if (!text) {
    return fallback;
  }

  try {
    const data = JSON.parse(text);
    return data?.error?.message || data?.message || data?.error_description || fallback;
  } catch {
    return text.slice(0, 200);
  }
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
