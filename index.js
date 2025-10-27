import express from "express";
import {createServer} from "http";
import { Server } from "socket.io";
import { clipQueue } from "../ClipCast/src/queues/clipQueue.js";

import 'dotenv/config';

const app= express();
const httpServer= createServer(app);

const io= new Server(httpServer,{
     cors: {origin: "*"}
});

const PORT= process.env.PORT || 3000;

app.use(express.json());

io.on('connection', (socket)=>{
  console.log(`client connected: ${socket.id}`);
  socket.on('disconnect', ()=>{
    console.log(`client disconnected: ${socket.id}`);
  });
});

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
        
        await clipQueue.add('clip-video', {
            videoURL,
            startTime,
            endTime,
            userId
        });

        console.log("job added to queue:", {videoURL,startTime,endTime});
        res.status(202).send({
            message: 'job added to queue successfully!!'
        });



    }
    catch(err){
        console.log('error in adding job to queue:', err);
        res.send(500).send({
            message: 'failed to queue clip job'
        });
    }
    
});

httpServer.listen(PORT, ()=>{
    console.log(`server is running on port ${PORT}`);
});

