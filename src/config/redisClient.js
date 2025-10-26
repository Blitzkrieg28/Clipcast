import Redis from "ioredis";
import 'dotenv/config';

const connectionOpt= {
    maxRetiries: null
   
};

export const redisConnection= new Redis(process.env.REDIS_URL,connectionOpt);
export const redisSubscriber= new Redis(process.env.REDIS_URL,connectionOpt);

redisConnection.on('connect',()=>{
    console.log('Redis main client connected!');
});

redisConnection.on('error', (err)=>{
    console.log('error with redis main client: ',err);
});


redisSubscriber.on('connect',()=>{
    console.log('Redis Subscriber connected!');
});

redisSubscriber.on('error', (err)=>{
    console.log('error with redis subscriber: ',err);
});
