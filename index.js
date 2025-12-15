import express from "express";
import { createServer } from "http";
import { clipQueue } from "./src/queues/clipQueue.js"; // Fixed Path
import { playlistQueue } from "./src/queues/playlistQueue.js";
import { redisConnection } from "./src/config/redisClient.js";
import cors from 'cors';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. SETUP DIRNAME (Must be at the top for ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 2. MAKE DOWNLOADS PUBLIC (Important!)
// This serves files from your 'temp_downloads' folder at /downloads URL
app.use('/downloads', express.static(path.join(__dirname, 'temp_downloads')));

app.get('/', (req, res) => {
    res.send('Clipcast Backend running!');
});

// --- CLIPS ENDPOINT ---
app.post('/api/clips', async (req, res) => {
    console.log('recieved clip request: ', req.body);
    const { videoURL, startTime, endTime, userId } = req.body;

    if (!videoURL || startTime === undefined || endTime === undefined || !userId) {
        return res.status(400).send({ message: "missing required field!" });
    }

    try {
        const job = await clipQueue.add('clip-video', {
            videoURL, startTime, endTime, userId
        });

        console.log("job added to queue:", { videoURL, startTime, endTime, jobId: job.id });
        res.status(202).send({
            message: 'job added to queue successfully!!',
            jobId: job.id
        });
    } catch (err) {
        console.log('error in adding job to queue:', err);
        res.status(500).send({ message: 'failed to queue clip job' });
    }
});

// --- STATUS ENDPOINT (Shared by Clips & Playlist) ---
app.get('/api/clips/status/:jobId', async (req, res) => {
    const { jobId } = req.params;
    console.log(`Received status check for job: ${jobId}`);

    const jobStatusKey = `job:status:${jobId}`;
    const statusData = await redisConnection.hgetall(jobStatusKey);

    if (!statusData || Object.keys(statusData).length === 0) {
        return res.status(404).send({ status: 'not_found', message: 'Job not found or expired.' });
    }

    res.status(200).send(statusData);

    // Cleanup logic: If done, remove status from Redis
    if (statusData.status === 'completed' || statusData.status === 'failed') {
        await redisConnection.del(jobStatusKey);
        console.log(`Cleaned up status key for job: ${jobId}`);
    }
});

// --- NEW PLAYLIST ENDPOINT ---
app.post('/api/playlist', async (req, res) => {
    console.log('Received playlist request:', req.body);
    const { playlistUrl, userId } = req.body;

    if (!playlistUrl || !userId || !playlistUrl.includes('list=')) {
        return res.status(400).send({ message: "Invalid playlist URL or missing User ID" });
    }

    try {
        const job = await playlistQueue.add('process-playlist', {
            playlistUrl,
            userId
        });

        console.log("Playlist job added:", job.id);
        res.status(202).send({
            message: 'Playlist processing started!',
            jobId: job.id
        });
    } catch (err) {
        console.error('Queue Error:', err);
        res.status(500).send({ message: 'Failed to queue playlist' });
    }
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    if (!res.headersSent) {
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

httpServer.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
});