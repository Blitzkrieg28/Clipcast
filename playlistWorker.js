import { Worker } from "bullmq";
import { redisConnection } from "./src/config/redisClient.js";
import { spawn } from 'child_process';
import 'dotenv/config'; // Cloudinary import removed/not used for logic
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Note: Cloudinary config removed since we are serving locally to avoid limits.

const QUEUE_NAME = 'playlist-queue'; 
console.log(`Playlist Worker started for queue: ${QUEUE_NAME}`);

// Helper to Zip a directory
const zipDirectory = (sourceDir, outPath) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(outPath);

    return new Promise((resolve, reject) => {
        archive
            .directory(sourceDir, false) 
            .on('error', err => reject(err))
            .pipe(stream);

        stream.on('close', () => resolve());
        archive.finalize();
    });
};

const processPlaylistJob = async (job) => {
    const { playlistUrl, userId } = job.data;
    const jobStatusKey = `job:status:${job.id}`;

    // --- URL CLEANER ---
    let cleanUrl = playlistUrl;
    try {
        const urlObj = new URL(playlistUrl);
        const listId = urlObj.searchParams.get('list');
        if (listId) {
            cleanUrl = `https://www.youtube.com/playlist?list=${listId}`;
            console.log(`[Job ${job.id}] Cleaned URL: ${cleanUrl}`);
        }
    } catch (e) {
        console.warn(`[Job ${job.id}] URL cleaning failed, using original: ${playlistUrl}`);
    }

    // 1. Setup paths
    // We assume 'temp_downloads' is in the root and exposed via index.js
    const tempBase = path.join(__dirname, 'temp_downloads');
    const downloadDir = path.join(tempBase, job.id);
    const zipFilePath = path.join(tempBase, `${job.id}.zip`);

    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

    console.log(`Processing Playlist Job ${job.id}`);

    try {
        await redisConnection.hset(jobStatusKey, {
            status: "processing",
            userId: userId,
            jobId: job.id,
            startTime: Date.now()
        });
        await redisConnection.expire(jobStatusKey, 3600);

        // 2. Download MP3s
        const ytDlpArgs = [
            '-x', '--audio-format', 'mp3',
            '--yes-playlist', 
            '--max-downloads', '10', 
            '-o', `${downloadDir}/%(title)s.%(ext)s`,
            cleanUrl 
        ];

        console.log(`[Job ${job.id}] Spawning yt-dlp...`);

        await new Promise((resolve, reject) => {
            const ytProcess = spawn('yt-dlp', ytDlpArgs);
            
            // ytProcess.stdout.on('data', (data) => console.log(`[yt-dlp]: ${data}`)); 
            ytProcess.stderr.on('data', (data) => console.error(`[yt-dlp error]: ${data}`));

            ytProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`yt-dlp exited with code ${code}`));
            });
        });

        // 3. Check for files
        const files = fs.readdirSync(downloadDir);
        if (files.length === 0) {
            throw new Error("yt-dlp finished but no files were downloaded!");
        }
        console.log(`[Job ${job.id}] Downloaded ${files.length} files.`);

        // 4. Zip files
        console.log(`Zipping job ${job.id}...`);
        await zipDirectory(downloadDir, zipFilePath);

        // 5. SERVE LOCALLY (No Cloudinary)
        console.log(`Serving file locally...`);
        const downloadUrl = `http://localhost:3000/downloads/${job.id}.zip`;

        // 6. Success
        await redisConnection.hset(jobStatusKey, {
            status: "completed",
            downloadUrl: downloadUrl,
            finishedAt: Date.now()
        });
        await redisConnection.expire(jobStatusKey, 3600);
        
        return { downloadUrl };

    } catch (err) {
        console.error(`Job ${job.id} Failed:`, err);
        await redisConnection.hset(jobStatusKey, {
            status: "failed",
            error: err.message || 'Unknown error',
            finishedAt: Date.now()
        });
        
        // If it failed, we can clean up the zip immediately if it was created
        if (fs.existsSync(zipFilePath)) {
             try { fs.unlinkSync(zipFilePath); } catch(e){}
        }
        throw err;
    } finally {
        try {
            // 1. Always delete the folder of raw MP3s immediately
            if (fs.existsSync(downloadDir)) {
                fs.rmSync(downloadDir, { recursive: true, force: true });
            }
            
            // 2. KEEP the ZIP file for 10 minutes so the user can download it
            // After 10 mins, delete it to save space on your laptop
            if (fs.existsSync(zipFilePath)) {
                setTimeout(() => {
                    try { 
                        fs.unlinkSync(zipFilePath); 
                        console.log(`[Cleanup] Deleted old zip: ${zipFilePath}`);
                    } catch(e){ 
                        console.error("Cleanup error (zip):", e); 
                    }
                }, 10 * 60 * 1000); // 10 Minutes
            }
        } catch (e) { console.error("Cleanup error", e); }
    }
};

const worker = new Worker(QUEUE_NAME, processPlaylistJob, {
    connection: redisConnection,
    concurrency: 2 
});

console.log('Playlist Worker Listening...');