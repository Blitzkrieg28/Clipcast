<div align="center">
  <h1>✂️ ClipCast</h1>
  
  <p>
    <strong>The Smartest Way to Capture YouTube Content</strong>
  </p>

  <p>
    <a href="#system-architecture">Architecture</a> •
    <a href="#key-features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#technical-decisions">Tech Decisions</a>
  </p>

  <img src="https://img.shields.io/badge/version-2.0.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/status-active-success?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/backend-Node.js-green?style=flat-square&logo=node.js" alt="NodeJS" />
  <img src="https://img.shields.io/badge/database-Redis-red?style=flat-square&logo=redis" alt="Redis" />
</div>

<br />

## 🎥 Demo
### Feature 1: Smart Clipping
> Extract specific segments from long videos instantly.

![Smart Clipping Demo](./assets/feature1.gif)
### Feature 2: Playlist Batch Download
> Download entire playlists as a single ZIP file with one click.

![Playlist Download Demo](./assets/feature2.gif)

## 📖 About The Project

ClipCast is a robust Chrome Extension and Backend system designed to bridge the gap between simple video downloaders and complex media processing tools. 

Most downloaders force users to download entire large files just to get a 30-second clip, or manually download 50 separate files for a playlist. ClipCast solves this by offloading processing to a dedicated backend architecture. It allows users to:
1.  **Clip with Precision:** Select start/end timestamps directly in the YouTube player.
2.  **Batch Process:** Queue entire playlists for background processing and zipping.
3.  **Stay Unblocked:** The asynchronous architecture ensures the browser never freezes while heavy video processing happens on the server.

## <span id="system-architecture">🏗️ System Architecture</span>

![System Architecture Diagram](./assets/archi.png)

ClipCast utilizes an **Event-Driven Architecture**
## <span id="key-features">✨ Key Features</span>
### v2.0: The Playlist Update 
* **📦 Batch Playlist Processing:** Capable of downloading entire YouTube playlists (10+ songs) in a single job.
* **🗜️ Automated Zipping:** Downloads individual tracks, converts them to MP3, and compresses them into a single `playlist.zip` file for easy download.
* **⚡ Local File Serving:** Bypasses Cloudinary's free-tier limits by serving large playlist files directly from the backend's ephemeral storage.
* **🧹 Intelligent Auto-Cleanup:** Implemented a Time-to-Live (TTL) system that automatically deletes heavy `.zip` and temporary folders 10 minutes after generation to save server disk space.
* **🔗 Smart URL Sanitization:** Custom logic to extract playlist IDs even from "Watch" URLs (e.g., `watch?v=...&list=...`), ensuring the worker processes the full list, not just the single video.

### v1.0: Core Clipping Engine
* **✂️ Precision UI Injection:** Injects "Set Start" and "Set End" buttons directly into the YouTube Player, allowing users to select timestamps with frame-perfect accuracy.
* **☁️ Cloud Integration:** Automatically processes video clips and uploads them to **Cloudinary**, returning a permanent shareable link.
* **🔔 Native Notifications:** Uses Chrome's Alarm and Notification APIs to alert the user when a job is finished, even if they have closed the tab.
* **🔄 Asynchronous Queues:** Decoupled the UI from processing using **BullMQ**, ensuring the browser never freezes during heavy rendering tasks.

## 🛠️ Tech Stack

**Frontend (Extension)**
* ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=flat-square&logo=javascript) **Chrome Extension API (Manifest V3)**
* **HTML5 / CSS3** (Injected UI)

**Backend (API & Workers)**
* ![NodeJS](https://img.shields.io/badge/Node.js-v18-green?style=flat-square&logo=node.js) **Node.js & Express**
* ![Redis](https://img.shields.io/badge/Redis-Cache_&_Queues-red?style=flat-square&logo=redis) **Redis** (Data persistence & Message Broker)
* **BullMQ** (Job Queue Management)

**Processing & Storage**
* **yt-dlp** (Core Media Engine)
* **FFmpeg** (Media encoding/processing)
* ![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_Cloud-blue?style=flat-square&logo=cloudinary) **Cloudinary** (Clip Storage)
* **Archiver** (Node.js compression library)

## 📋 Prerequisites

Before running the project, ensure you have the following installed on your local machine:

**1. Node.js (v16 or higher)**
* Required to run the backend server and workers.
* [Download Node.js](https://nodejs.org/)

**2. Redis Server**
* Required for managing the job queues (BullMQ).
* **Windows:** [Install via WSL2 or Memurai](https://redis.io/docs/getting-started/installation/install-redis-on-windows/)
* **Mac/Linux:** `brew install redis`
* *Verify installation:* Run `redis-cli ping` in your terminal (should reply `PONG`).

**3. yt-dlp (System Path)**
* The core engine used to download the video/audio.
* **Installation:**
    ```bash
    # Python (Recommended)
    pip install yt-dlp

    # Homebrew (Mac)
    brew install yt-dlp
    ```
* *Important:* Ensure `yt-dlp` is added to your system's PATH variable so the worker can spawn it.

**4. FFmpeg**
* Required by yt-dlp to merge audio and video streams.
* [Download FFmpeg](https://ffmpeg.org/download.html)

## <span id="installation">📦 Installation Guide</span>
Follow these steps to get the system running on your local machine.

### 1. Clone the Repository
```bash
git clone https://github.com/Blitzkrieg28/Clipcast.git
cd ClipCast
```
### 2. Install Backend Dependencies
Navigate to the root directory and install the required Node.js packages (Express, BullMQ, yt-dlp, etc.).

```bash
npm install
```

### 3. Start the Redis Server
ClipCast relies on Redis for managing job queues. Open a new terminal window and run:
```bash
redis-server
```
Note: Ensure Redis is running on the default port 6379.

### 4. Start the Backend API
In the root directory of the project, start the main Express server:
```bash
node index.js
```
You should see: Server is running on port 3000

### 5. Start the Background Workers
The system uses separate workers for Clips and Playlists to handle concurrent processing. Open two new terminal tabs and run them individually:

Terminal A (Clip Worker):
```bash
# Processes video clipping jobs
node worker.js
```
Terminal B (Playlist Worker):
```bash
# Processes batch playlist downloads
node playlistWorker.js
```

### 6. Install the Chrome Extension
1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer Mode** (toggle in the top-right corner).
3.  Click the **Load Unpacked** button.
4.  Select the `extension` folder located inside the ClipCast project directory.
5.  Pin the extension to your toolbar for easy access.

## ⚙️ Configuration

ClipCast requires specific environment variables to function. Create a `.env` file in the root directory and configure the following:

1.  **Create the file:**
    ```bash
    touch .env
    ```

2.  **Add the following variables** (Replace the values with your actual keys):

    ```env
    # --- Server Config ---
    PORT=3000

    # --- Redis Configuration ---
    # You can use a local Redis instance OR a cloud provider like Upstash.
    # If using local:
    # REDIS_HOST=127.0.0.1
    # REDIS_PORT=6379
    
    # If using Upstash (Cloud):
    REDIS_URL=rediss://default:your_password@your_instance.upstash.io:6379

    # --- Cloudinary Config (Required for v1.0 Clips) ---
    # Sign up for free at [https://cloudinary.com/](https://cloudinary.com/)
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret
    ```
## <span id="technical-decisions">🧠 Technical Decisions & Trade-offs</span>
### 1. Polling vs. WebSockets
* **Decision:** I chose **Short Polling** (5-second intervals) over WebSockets for status updates.
* **Why?** While WebSockets offer real-time bi-directional communication, they introduce stateful complexity on the server (managing connections). For a file processing job that takes minutes, a simple polling mechanism is stateless, easier to scale, and sufficient for the user experience without checking every millisecond.


### 2. Local Storage vs. Cloudinary (The Hybrid Approach)
* **Decision:** * **Clips (v1.0)** are uploaded to **Cloudinary**.
    * **Playlists (v2.0)** are served from **Local Storage**.
* **Why?** * *Clips* are small and meant to be shared socially, so a Cloud URL is perfect.
    * *Playlists* are large (50MB+) and often hit the file-size limits of free cloud tiers. Serving them locally via a static route is faster, avoids API limits, and simplifies the architecture for temporary batch downloads.


