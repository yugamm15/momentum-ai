// Listens for messages from the dashboard page and replies with extension data
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "REQUEST_MEETING_DATA") {
    chrome.storage.local.get(["meetingResult", "timestamp"], (data) => {
      if (data.meetingResult) {
        window.postMessage({
          type: "MEETING_DATA_RESPONSE",
          data: data.meetingResult,
          timestamp: data.timestamp
        }, "*");
      }
    });
  }
});

// Immediately notify dashboard when a new meeting is processed
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.meetingResult) {
    window.postMessage({
      type: "MEETING_DATA_UPDATE",
      data: changes.meetingResult.newValue,
      timestamp: new Date().toISOString()
    }, "*");
  }
});
