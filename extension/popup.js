// Show participants
chrome.storage.local.get(['participants'], (result) => {
  const list = document.getElementById('participant-list');
  
  if (result.participants && result.participants.length > 0) {
    list.innerHTML = result.participants
      .map(name => `
        <div class="participant-pill">👤 <span>${name}</span></div>
      `)
      .join('');
  } else {
    // Simulated demo data for when extension is viewed outside of meeting
    list.innerHTML = `
      <div class="participant-pill">👤 <span>Yugam</span></div>
      <div class="participant-pill">👤 <span>Alice</span></div>
      <div class="participant-pill">👤 <span>Bob</span></div>
    `;
  }
});

// Show live transcript preview
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TRANSCRIPT_UPDATE") {
    const preview = document.getElementById(
      'transcript-preview'
    );
    // Show last 100 characters only
    const text = message.data;
    preview.textContent = "..." + text.slice(-100);
  }
});

function openDashboard() {
  window.open("http://localhost:5173/");
}
