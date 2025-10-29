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
        return true; // Keep message port open for async response
    }
    // *** REMOVED: 'clipReady' and 'clipFailed' listeners (now handled by polling) ***
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

// *** 5. NEW: Polling Function ***
function pollForJobStatus(jobId, userId) {
    const statusUrl = `${API_BASE_URL}/api/clips/status/${jobId}`;

    const pollInterval = setInterval(async () => {
        console.log(`Polling for job status: ${jobId}`);
        try {
            const response = await fetch(statusUrl);
            if (!response.ok) {
                // 404 means job not found or already cleaned up
                if(response.status === 404) {
                    console.warn(`Polling for job ${jobId} got 404. Stopping poll.`);
                    clearInterval(pollInterval);
                    return;
                }
                console.warn(`Polling failed for job ${jobId}, status: ${response.status}`);
                return; // Keep polling
            }

            const data = await response.json();
            console.log(`Poll status for job ${jobId}:`, data.status);

            // Safety check: ensure this job belongs to the current user
            if (data.userId !== userId) {
                console.error(`Mismatched user ID for job ${jobId}. Stopping poll.`);
                clearInterval(pollInterval);
                return;
            }

            if (data.status === 'completed') {
                clearInterval(pollInterval); // Stop polling
                const notificationId = `clip-success-${jobId}`;
                chrome.notifications.create(notificationId, {
                    type: 'basic',
                    iconUrl: 'images/icon16.png',
                    title: 'Clip Ready!',
                    message: 'Your clip is ready! Click to view.',
                    contextMessage: data.clipUrl
                });
                chrome.storage.local.set({ [notificationId]: data.clipUrl });

            } else if (data.status === 'failed') {
                clearInterval(pollInterval); // Stop polling
                chrome.notifications.create(`clip-fail-${jobId}`, {
                    type: 'basic',
                    iconUrl: 'images/icon16.png',
                    title: 'Clip Failed',
                    message: `Failed to create clip. Error: ${data.error || 'Unknown error'}`
                });
            }
            // If status is 'processing', do nothing and let it poll again
            
        } catch (error) {
            console.error(`Error during polling for job ${jobId}:`, error);
            // Don't clear interval, just let it try again next time
        }
    }, 5000); // Poll every 5 seconds
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