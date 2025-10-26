import { Queue } from "bullmq";
import { redisConnection } from "../config/redisClient.js";

export const clipQueue= new Queue('video-clipping',{
    connection: redisConnection
});

console.log("video clipping queue initialized!");