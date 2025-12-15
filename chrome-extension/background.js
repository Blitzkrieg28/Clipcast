// background.js (Polling Version)
// *** REMOVED: import { io } from "./socket.io.esm.js"; ***

console.log("ClipCast Background Service Worker Started!");

// --- 1. Configuration ---
const API_BASE_URL = "http://localhost:3000"; // Port must match index.js
let currentUserId = null; // Caches the user ID

// --- 2. User ID Management ---
async function ensureUserId() {
    try {
        const result = await chrome.storage.local.get(['clipcastUserId']);
        if (result.clipcastUserId) {
            currentUserId = result.clipcastUserId;
            console.log("Background: Loaded existing User ID:", currentUserId);
        } else {
            currentUserId = crypto.randomUUID();
            console.log("Background: No User ID found, generating new one:", currentUserId);
            await chrome.storage.local.set({ clipcastUserId: currentUserId });
            console.log("Background: New User ID saved to storage.");
        }
    } catch (error) {
        console.error("Background: Error ensuring User ID:", error);
        if (!currentUserId) {
            currentUserId = `fallback-${Date.now()}`;
        }
    }
    return currentUserId;
}

// *** REMOVED: All Offscreen Document and Alarm logic ***

// --- 3. Event Listeners ---

// A. Listen for messages from Content Script (content.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background: Message received:", request);

    if (request.action === "createClip") {
        handleCreateClip(request.data, sendResponse);
        return true; 
    }
    // --- NEW LISTENER ---
    if (request.action === "downloadPlaylist") {
        handleDownloadPlaylist(request.data, sendResponse);
        return true;
    }
});

// B. Listen for Notification Clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
    console.log(`Notification clicked: ${notificationId}`);
    
    if (notificationId.startsWith('clip-success-')) {
        chrome.storage.local.get([notificationId], (result) => {
            if (result[notificationId]) {
                console.log(`Opening URL: ${result[notificationId]}`);
                chrome.tabs.create({ url: result[notificationId] });
                chrome.storage.local.remove([notificationId]);
                chrome.notifications.clear(notificationId);
            } else {
                console.log(`No URL found for notification ID: ${notificationId}`);
            }
        });
    } else if (notificationId.startsWith('clip-fail-')) {
        chrome.notifications.clear(notificationId); // Just clear failure notifications
    }
});

// --- 4. API Call Logic ---
async function handleCreateClip(data, sendResponse) {
    const { videoURL, startTime, endTime } = data; // Use 'videoURL' from content script

    if (!currentUserId) { await ensureUserId(); }
    if (!currentUserId) {
        console.error("Cannot create clip: User ID is missing.");
        sendResponse({ success: false, message: "User ID not available." });
        return;
    }

    console.log(`Sending request to clip ${videoURL} for ${currentUserId}`);

    try {
        const response = await fetch(`${API_BASE_URL}/api/clips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoURL: videoURL, 
                startTime: formatSecondsToHMS(startTime),
                endTime: formatSecondsToHMS(endTime),
                userId: currentUserId 
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error ${response.status}: ${text || response.statusText}`);
        }

        const responseData = await response.json();
        console.log('Backend API response:', responseData);
        sendResponse({ success: true, message: responseData.message || "Job accepted" });

        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon16.png',
            title: 'Clipping Started',
            message: 'Your video clip is being processed...'
        });

        // *** NEW: Start polling for the job status ***
        if (responseData.jobId) {
            pollForJobStatus(responseData.jobId, currentUserId); // Pass userId for validation
        }

    } catch (error) {
        console.error('Error calling backend API:', error);
        sendResponse({ success: false, message: error.message || "Failed to send request" });
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon16.png',
            title: 'Clipping Error',
            message: `Failed to start clipping: ${error.message}`
        });
    }
}
async function handleDownloadPlaylist(data, sendResponse) {
    const { playlistUrl } = data;
    if (!currentUserId) await ensureUserId();

    try {
        const response = await fetch(`${API_BASE_URL}/api/playlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playlistUrl, userId: currentUserId })
        });

        const resData = await response.json();
        
        if (response.ok) {
            sendResponse({ success: true, message: "Playlist queued!" });
            
            // Re-use the SAME polling function!
            pollForJobStatus(resData.jobId, currentUserId); 
        } else {
            throw new Error(resData.message);
        }
    } catch (error) {
        console.error("Playlist Error:", error);
        sendResponse({ success: false, message: error.message });
    }
}
// *** 5. NEW: Polling Function ***
function pollForJobStatus(jobId, userId) {
    const statusUrl = `${API_BASE_URL}/api/clips/status/${jobId}`; // We reuse the status endpoint

    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(statusUrl);
            if (!response.ok) {
                if(response.status === 404) clearInterval(pollInterval);
                return;
            }

            const data = await response.json();
            
            if (data.userId !== userId) {
                clearInterval(pollInterval);
                return;
            }

            if (data.status === 'completed') {
                clearInterval(pollInterval);
                
                // --- CHANGED HERE: Handle both clipUrl (Video) and downloadUrl (Playlist) ---
                const finalUrl = data.clipUrl || data.downloadUrl;
                const title = data.downloadUrl ? "Playlist Ready!" : "Clip Ready!";
                const msg = data.downloadUrl ? "Click to download your ZIP." : "Click to view your clip.";

                const notificationId = `clip-success-${jobId}`;
                chrome.notifications.create(notificationId, {
                    type: 'basic',
                    iconUrl: 'images/icon16.png',
                    title: title,
                    message: msg,
                });
                chrome.storage.local.set({ [notificationId]: finalUrl });

            } else if (data.status === 'failed') {
                clearInterval(pollInterval);
                chrome.notifications.create(`clip-fail-${jobId}`, {
                    type: 'basic',
                    iconUrl: 'images/icon16.png',
                    title: 'Job Failed',
                    message: `Error: ${data.error || 'Unknown error'}`
                });
            }
        } catch (error) {
            console.error(`Polling error:`, error);
        }
    }, 5000);
}
// ----------------------------

// --- 6. Helper Function ---
function formatSecondsToHMS(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

// --- 7. Initial Startup ---
ensureUserId(); // Just load the ID
console.log("Background script listeners set up.");

// *** REMOVED: setInterval keep-alive ***