// background.js
console.log("ClipCast Background Service Worker Started!");

const API_BASE_URL = "http://localhost:3000"; // Make sure port matches index.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in background:", request);

    if (request.action === "createClip") {
        const { videoURL, startTime, endTime, userId } = request.data;

        console.log(`Received request to clip ${videoURL} from ${startTime}s to ${endTime}s for ${userId}`);

        // --- Call your backend API ---
        fetch(`${API_BASE_URL}/api/clips`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoURL: videoURL,
                startTime: formatSecondsToHMS(startTime),
                endTime: formatSecondsToHMS(endTime),
                userId: userId
             })
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                     throw new Error(`API Error ${response.status}: ${text || response.statusText}`);
                });
            }
            return response.json(); 
        })
        .then(data => {
            console.log('Backend API response:', data);
            sendResponse({ success: true, message: data.message || "Job accepted" });

            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon16.png', // Ensure you have this image
                title: 'Clipping Started',
                message: 'Your video clip is being processed...'
            });

        })
        .catch(error => {
            console.error('Error calling backend API:', error);
            sendResponse({ success: false, message: error.message || "Failed to send request" });

             chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon16.png',
                title: 'Clipping Error',
                message: `Failed to start clipping: ${error.message}`
            });
        });

        return true;
    }

});



function formatSecondsToHMS(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
}


// --- Placeholder for Socket.IO Integration ---
// Connecting to Socket.IO directly in a Manifest V3 service worker
// is complex due to its lifecycle. We will add this later, potentially
// using methods like Offscreen Documents or handling reconnections carefully.
// For now, focus on the API call and basic notifications.
/*
function connectSocketIO() {
    console.log("Attempting to connect to Socket.IO...");
    // const socket = io(API_BASE_URL); // Needs client library loaded

    // socket.on('connect', () => { ... });
    // socket.on('clip-ready', (data) => {
    //      console.log("Clip ready notification:", data);
    //      chrome.notifications.create(...)
    // });
    // socket.on('disconnect', () => { ... });
    // socket.on('connect_error', (err) => { ... });
}
// connectSocketIO(); // Call this maybe on startup or keep connection alive
*/

console.log("Background script listeners set up.");