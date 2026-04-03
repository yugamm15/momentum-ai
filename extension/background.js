// Listen for messages from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    if (message.type === "MEETING_ENDED") {
      console.log("Meeting ended! Processing...");
      // Call Gemini API in background
      analyzeMeeting(
        message.transcript,
        message.participants
      ).catch(err => console.error("Failed to analyze:", err));
    }
    
    if (message.type === "PARTICIPANTS_UPDATE") {
      // Save participants to storage
      chrome.storage.local.set({
        participants: message.data
      });
    }
    
    return false; // synchronous return indicates no async response
});


async function analyzeMeeting(transcript, participants) {
  const GEMINI_API_KEY = "AIzaSyAncOWD2GNCCrN4NiYRNKfi46GYgojp_GM";
  
  const prompt = `
    You are an expert meeting analyst.
    
    Participants in this meeting: ${participants.join(", ")}
    
    Analyze this meeting transcript and return 
    ONLY a JSON object with these fields:
    
    {
      "summary": "2-3 sentence summary",
      "decisions": ["decision 1", "decision 2"],
      "tasks": [
        {
          "task": "what needs to be done",
          "assignee": "person name or UNCLEAR if ambiguous",
          "deadline": "deadline or null",
          "ambiguous": true or false
        }
      ],
      "risks": ["risk 1", "risk 2"],
      "clarity_score": 7,
      "actionability_score": 6
    }
    
    IMPORTANT: If a task is assigned to a name that 
    could match multiple participants mark ambiguous 
    as true and assignee as UNCLEAR.
    
    Transcript:
    ${transcript}
  `;
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    }
  );
  
  const data = await response.json();
  const result = JSON.parse(
    data.candidates[0].content.parts[0].text
  );
  
  // Save result to storage
  chrome.storage.local.set({
    meetingResult: result,
    timestamp: new Date().toISOString()
  });
  
  console.log("Meeting analyzed!", result);
}
