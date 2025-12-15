import { Queue } from "bullmq";
import { redisConnection } from "../config/redisClient.js";

export const playlistQueue = new Queue('playlist-queue', {
    connection: redisConnection
});