import { Queue } from "bullmq";
import { redisConnection } from "../config/redisClient.js";

export const playlistQueue= new Queue('playlist-audio-queue',{
    connection: redisConnection
});

console.log("playlist queue initialized!!");

