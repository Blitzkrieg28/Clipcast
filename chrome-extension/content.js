console.log("ClipCast Content Script Injected!"); 

let clipStartTime = null;
let clipEndTime = null;
let selectingStart = true; 

function addClippingUI() {
    const playerControls = document.querySelector('.ytp-right-controls');
    if (playerControls && !document.getElementById('clipcast-controls')) {
        console.log("Adding ClipCast UI...");

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'clipcast-controls';
        controlsContainer.style.display = 'flex';
        controlsContainer.style.alignItems = 'center';
        controlsContainer.style.marginLeft = '10px';

        const startButton = document.createElement('button');
        startButton.id = 'clipcast-start-btn';
        startButton.innerText = 'Set Start (✂️)';
        startButton.style.cssText = `padding: 5px 8px; margin-right: 5px; cursor: pointer; background-color: #4CAF50; color: white; border: none; border-radius: 3px;`;

        const endButton = document.createElement('button');
        endButton.id = 'clipcast-end-btn';
        endButton.innerText = 'Set End (✂️)';
        endButton.style.cssText = `padding: 5px 8px; margin-right: 5px; cursor: pointer; background-color: #f44336; color: white; border: none; border-radius: 3px; display: none;`; // Hidden initially

        const createButton = document.createElement('button');
        createButton.id = 'clipcast-create-btn';
        createButton.innerText = 'Create Clip';
        createButton.style.cssText = `padding: 5px 8px; cursor: pointer; background-color: #008CBA; color: white; border: none; border-radius: 3px; display: none;`; // Hidden initially

        const statusDisplay = document.createElement('span');
        statusDisplay.id = 'clipcast-status';
        statusDisplay.style.cssText = `margin-left: 8px; font-size: 12px; color: white;`;
        statusDisplay.innerText = 'Select start point';

        
        startButton.onclick = () => {
            const videoPlayer = document.querySelector('video');
            if (videoPlayer) {
                clipStartTime = videoPlayer.currentTime; 
                console.log(`Clip Start set: ${clipStartTime}`);
                statusDisplay.innerText = `Start: ${formatTime(clipStartTime)} | Select end point`;
                startButton.style.display = 'none'; 
                endButton.style.display = 'inline-block'; 
            }
        };

        
        endButton.onclick = () => {
            const videoPlayer = document.querySelector('video');
            if (videoPlayer) {
                clipEndTime = videoPlayer.currentTime;
                if (clipEndTime <= clipStartTime) {
                    alert("End time must be after start time!");
                    return;
                }
                console.log(`Clip End set: ${clipEndTime}`);
                statusDisplay.innerText = `Clipping: ${formatTime(clipStartTime)} - ${formatTime(clipEndTime)}`;
                endButton.style.display = 'none';
                createButton.style.display = 'inline-block'; 
            }
        };

        createButton.onclick = () => {
             if (clipStartTime !== null && clipEndTime !== null) {
                const videoURL = window.location.href;
                console.log('Sending clip data to background script:', { videoURL, startTime: clipStartTime, endTime: clipEndTime });

                chrome.runtime.sendMessage({
                    action: "createClip",
                    data: {
                        videoURL: videoURL,
                        startTime: clipStartTime,
                        endTime: clipEndTime,
                        userId: "user123_placeholder"
                    }
                }, (response) => {
                     if (chrome.runtime.lastError) {
                        console.error("Error sending message:", chrome.runtime.lastError.message);
                        statusDisplay.innerText = "Error sending request.";
                     } else {
                        console.log("Background script response:", response);
                        statusDisplay.innerText = "Clip request sent! Processing...";
                     }
                });

                resetClippingState(startButton, endButton, createButton, statusDisplay);
             }
        };

        controlsContainer.appendChild(startButton);
        controlsContainer.appendChild(endButton);
        controlsContainer.appendChild(createButton);
        controlsContainer.appendChild(statusDisplay);

        playerControls.prepend(controlsContainer);
        console.log("ClipCast UI added!");
    }
}

function resetClippingState(startButton, endButton, createButton, statusDisplay) {
    clipStartTime = null;
    clipEndTime = null;
    startButton.style.display = 'inline-block';
    endButton.style.display = 'none';
    createButton.style.display = 'none';
    statusDisplay.innerText = 'Select start point';
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}



const checkInterval = setInterval(() => {
    if (document.querySelector('.ytp-right-controls')) {
        addClippingUI();
       
    }
}, 2000); 