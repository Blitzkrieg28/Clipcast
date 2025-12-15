console.log("ClipCast Content Script Injected!"); 

let clipStartTime = null;
let clipEndTime = null;

// 1. Existing Clipper UI
function addClippingUI() {
    const playerControls = document.querySelector('.ytp-right-controls');
    if (playerControls && !document.getElementById('clipcast-controls')) {
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'clipcast-controls';
        controlsContainer.style.cssText = 'display: flex; align-items: center; margin-left: 10px;';

        const startButton = createBtn('Set Start (✂️)', '#4CAF50');
        const endButton = createBtn('Set End (✂️)', '#f44336');
        endButton.style.display = 'none';
        const createButton = createBtn('Create Clip', '#008CBA');
        createButton.style.display = 'none';

        const statusDisplay = document.createElement('span');
        statusDisplay.innerText = 'Select start point';
        statusDisplay.style.cssText = 'margin-left: 8px; font-size: 12px; color: white;';

        startButton.onclick = () => {
            const video = document.querySelector('video');
            if (video) {
                clipStartTime = video.currentTime;
                startButton.style.display = 'none';
                endButton.style.display = 'inline-block';
                statusDisplay.innerText = `Start: ${formatTime(clipStartTime)}`;
            }
        };

        endButton.onclick = () => {
            const video = document.querySelector('video');
            if (video) {
                clipEndTime = video.currentTime;
                if (clipEndTime <= clipStartTime) return alert("End must be after start!");
                endButton.style.display = 'none';
                createButton.style.display = 'inline-block';
                statusDisplay.innerText = `${formatTime(clipStartTime)} - ${formatTime(clipEndTime)}`;
            }
        };

        createButton.onclick = () => {
            const videoURL = window.location.href;
            chrome.runtime.sendMessage({
                action: "createClip",
                data: { videoURL, startTime: clipStartTime, endTime: clipEndTime }
            });
            statusDisplay.innerText = "Sent!";
            setTimeout(() => {
                startButton.style.display = 'inline-block';
                createButton.style.display = 'none';
                statusDisplay.innerText = 'Select start point';
            }, 2000);
        };

        controlsContainer.append(startButton, endButton, createButton, statusDisplay);
        playerControls.prepend(controlsContainer);
    }
}

// 2. New Playlist UI
function addPlaylistUI() {
    const urlParams = new URLSearchParams(window.location.search);
    const listId = urlParams.get('list');
    if (!listId) return;

    // Try finding the header (Playlist page) or sidebar (Watch page)
    const header = document.querySelector('ytd-playlist-header-renderer .metadata-action-bar') || 
                   document.querySelector('ytd-playlist-panel-renderer #header-contents');

    if (header && !document.getElementById('clipcast-playlist-btn')) {
        const btn = document.createElement('button');
        btn.id = 'clipcast-playlist-btn';
        btn.innerText = '⬇️ Download Playlist';
        btn.style.cssText = `margin-left: 10px; padding: 6px 12px; background: #ff0050; color: white; border: none; border-radius: 15px; cursor: pointer; font-weight: bold; font-size: 13px; z-index: 9999;`;

        btn.onclick = () => {
            btn.innerText = '⏳ Queuing...';
            btn.disabled = true;
            btn.style.background = '#ccc';
            
            chrome.runtime.sendMessage({
                action: "downloadPlaylist",
                data: { playlistUrl: window.location.href }
            }, (res) => {
                if (chrome.runtime.lastError || !res?.success) {
                    btn.innerText = '❌ Error';
                } else {
                    btn.innerText = '✅ Started!';
                }
                setTimeout(() => {
                    btn.innerText = '⬇️ Download Playlist';
                    btn.disabled = false;
                    btn.style.background = '#ff0050';
                }, 3000);
            });
        };
        header.appendChild(btn);
    }
}

// Helper
function createBtn(text, color) {
    const b = document.createElement('button');
    b.innerText = text;
    b.style.cssText = `padding: 5px 8px; margin-right: 5px; cursor: pointer; background-color: ${color}; color: white; border: none; border-radius: 3px;`;
    return b;
}
function formatTime(s) {
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

// Loop
setInterval(() => {
    if (document.querySelector('.ytp-right-controls')) addClippingUI();
    if (window.location.search.includes('list=')) addPlaylistUI();
}, 2000);