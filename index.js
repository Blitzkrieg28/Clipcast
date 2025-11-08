import express from "express";
import {createServer} from "http";
import { clipQueue } from "../ClipCast/src/queues/clipQueue.js";
import cors from'cors';
import 'dotenv/config';

import { redisConnection } from "./src/config/redisClient.js";
const app= express();
const httpServer= createServer(app);

app.use(cors());


const PORT= process.env.PORT || 3000;


app.use(express.json());

app.get('/', (req,res)=>{
    res.send('Clipcast Backend running!');
});

app.post('/api/clips' ,async (req,res)=>{
    console.log('recieved clip request: ', req.body);
    const {videoURL,startTime,endTime,userId}= req.body;

    if(!videoURL|| startTime=== undefined|| endTime=== undefined|| !userId){
        return res.status(400).send({
            message: "missing required field!"
        });
    }

    try{
        
       const job=  await clipQueue.add('clip-video', {
            videoURL,
            startTime,
            endTime,
            userId
        });

        console.log("job added to queue:", {videoURL,startTime,endTime,jobId: job.id});
        res.status(202).send({
            message: 'job added to queue successfully!!',
            jobId: job.id
        });



    }
    catch(err){
        console.log('error in adding job to queue:', err);
        res.status(500).send({
            message: 'failed to queue clip job'
        });
    }
    
});

app.get('/api/clips/status/:jobId', async (req, res) => {
    const { jobId } = req.params;
    console.log(`Received status check for job: ${jobId}`);

    const jobStatusKey = `job:status:${jobId}`;
    const statusData = await redisConnection.hgetall(jobStatusKey);

    if (!statusData || Object.keys(statusData).length === 0) {
        return res.status(404).send({ status: 'not_found', message: 'Job not found or expired.' });
    }

    res.status(200).send(statusData);

    if (statusData.status === 'completed' || statusData.status === 'failed') {
        await redisConnection.del(jobStatusKey);
        console.log(`Cleaned up status key for job: ${jobId}`);
    }
});

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  if (!res.headersSent) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});


httpServer.listen(PORT, ()=>{
    console.log(`server is running on port ${PORT}`);
});

