import { Worker,Job } from "bullmq";
import { redisConnection,redisSubscriber } from "./src/config/redisClient.js";
import {exec} from 'child_process';
import cloudinary from 'cloudinary';
import 'dotenv/config';
import { error } from "console";
import { stderr, stdout } from "process";
import fs from 'fs';
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});
// Add these logs to verify:
console.log("Cloudinary Config - Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME ? 'Loaded' : 'MISSING!');
console.log("Cloudinary Config - API Key:", process.env.CLOUDINARY_API_KEY ? 'Loaded' : 'MISSING!');
// Don't log the secret itself, just check if it exists
console.log("Cloudinary Config - API Secret:", process.env.CLOUDINARY_API_SECRET ? 'Loaded' : 'MISSING!');

const QUEUE_NAME= 'video-clipping';
console.log(`Wokrker started for queue: ${QUEUE_NAME}`);

const processjob =async (job)=>{
    const {videoURL,startTime,endTime,userId}= job.data;

    let tempFilename= `clip-${job.id}.mp4`;

    console.log(`processing job ${job.id} wih data:`, job.data);
    if (!videoURL || startTime === undefined || endTime === undefined || !userId) {
        
        throw new Error("Missing essential job data (videoUrl, startTime, endTime, userId)");
    }
    try{
    const command= `yt-dlp --download-sections "*${startTime}-${endTime}" --remux-video mp4 -o "${tempFilename}" "${videoURL}"`;
    console.log(`Executing command for job ${job.id}: ${command}`);
    await new Promise((resolve,reject)=>{
        exec(command,(error,stdout,stderr)=>{
            if(error){
                console.error(`!!! yt-dlp exec error for job ${job.id}:`, error);
                console.error(`yt-dlp error: ${stderr}`);
                return reject(new Error(`yt-dlp failed:${stderr|| error.message} `));
            }
        console.log(`yt-dlp output: ${stdout}`);
        if (!fs.existsSync(tempFilename)) {
           
            const possibleExtensions = ['.webm', '.mkv', '.mp4']; // Add others if needed
            let found = false;
            for (const ext of possibleExtensions) {
                const potentialFilename = `clip-${job.id}${ext}`;
                if (fs.existsSync(potentialFilename)) {
                    console.log(`Note: yt-dlp created file with different extension: ${potentialFilename}`);
                    tempFilename = potentialFilename; 
                    found = true;
                    break;
                }
            }
            if (!found) {
                return reject(new Error(`yt-dlp seemed to succeed, but output file ${tempFilename} not found!`));
            }
       }
        resolve();      
        });
    });
    
    console.log(`attempt to upload file: ${tempFilename}`);
     let uploadResult;
     try{
     uploadResult= await cloudinary.v2.uploader.upload(tempFilename,{
        resource_type: "video",
    });
} catch(cloudinaryError){
    console.error(`!!! Cloudinary Upload Error for job ${job.id}:`, cloudinaryError);
            throw new Error(`Cloudinary upload failed: ${cloudinaryError.message || 'Unknown Cloudinary error'}`);
}
    const clipurl= uploadResult?.secure_url;
    if (!clipurl) {
        throw new Error("Cloudinary upload succeeded but returned no secure_url");
    }
    console.log('uploaded to cloudinary:', uploadResult.secure_url);

    const notifyMessage= JSON.stringify({
        userId: userId,
        clipurl: clipurl,
        jobID: job.id,
        status: 'completed'
    });

    await redisConnection.publish('clip-ready',notifyMessage);
    console.log(`published completion event for job${job.id}`);
    console.log(`finished job: ${job.id}`);
    return {
        clipURL: clipurl
    };
} catch(err){
    console.error(`job ${job.id} processing failed:`,err.message);
    const failureMessage = JSON.stringify({ userId: userId, jobId: job.id, status: 'failed', error: error.message });
    await redisConnection.publish('clip-failed', failureMessage); 
    throw error; 
} finally {
    try {
        await fs.promises.unlink(tempFilename);
    } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
            console.error(`Error deleting temp file ${tempFilename}:`, cleanupError);
        }
    }
}
};

const worker= new Worker(QUEUE_NAME,processjob,{
    connection: redisConnection,
    concurrency: 5
});

worker.on('completed', (job,result)=>{
    console.log(`job ${job.id} completed successfully!! with result:`, result);
});

worker.on('failed', (job,err)=>{
    console.log(`job ${job.id} failed with error: ${err.message|| err}`);
});

worker.on('error',(err)=>{
    console.log('worker error:' ,err);
});


console.log('worker is listening for jobs!');