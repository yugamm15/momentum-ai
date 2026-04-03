// ===== STEP 1: GET PARTICIPANTS =====
function getParticipants() {
  const participants = new Set();
  
  const elements = document.querySelectorAll('[role="listitem"], [data-self-name]');
  elements.forEach((el) => {
    const text = el.textContent.trim() || el.getAttribute('data-self-name');
    if (text && text.length > 2 && text.length < 40) {
      participants.add(text);
    }
  });
  
  return [...participants];
}

// Keep checking for new participants
setInterval(() => {
  const names = getParticipants();
  chrome.runtime.sendMessage({
    type: "PARTICIPANTS_UPDATE",
    data: names
  }).catch(() => {}); // prevent Uncaught connections errors
}, 5000);


// ===== STEP 2: RECORD SPEECH =====
let fullTranscript = "";
let recognition;
let isRecording = false;

function startListening() {
  if (!window.webkitSpeechRecognition) {
      console.error("Speech Recognition not supported in this browser.");
      return;
  }
  
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US'; 
  
  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    
    // Add to full transcript with timestamp
    const time = new Date().toLocaleTimeString();
    fullTranscript += `[${time}] ${transcript}\n`;
    
    // Send live update to popup
    chrome.runtime.sendMessage({
      type: "TRANSCRIPT_UPDATE",
      data: fullTranscript
    }).catch(() => {}); // prevent connection errors if popup is closed
  };

  recognition.onend = () => {
    if (isRecording) {
      setTimeout(() => {
        try { recognition.start(); } catch(e){}
      }, 1000);
    }
  };

  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e.error);
  };
  
  isRecording = true;
  try {
    recognition.start();
  } catch(e) {
    console.error("Speech start error:", e);
  }
}

// Start when page loads
startListening();


// ===== STEP 3: DETECT MEETING END =====
let hasJoinedMeeting = false;

setInterval(() => {
  const leaveButton = document.querySelector('[aria-label="Leave call"], [aria-label="Leave meeting"]');
  
  if (leaveButton) {
    hasJoinedMeeting = true;
  }
  
  // If we joined and now the button is gone = meeting ended
  if (hasJoinedMeeting && !leaveButton) {
    if (fullTranscript.length > 0) {
      chrome.runtime.sendMessage({
        type: "MEETING_ENDED",
        transcript: fullTranscript,
        participants: getParticipants()
      }).catch(() => {});
      fullTranscript = ""; // Reset
    }
    hasJoinedMeeting = false;
    isRecording = false; // Stop trying to record
    if (recognition) {
        try { recognition.stop(); } catch(e){}
    }
  }
}, 3000);
