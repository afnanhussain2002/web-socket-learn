// connection.js
// -------------------------------------------------------------
// Sets up the Redis clients used to scale our WebSocket server.
//
// Why Redis at all?
//   A single WebSocket server keeps its connected clients in memory.
//   If we run several server instances, each one only knows about its
//   own clients. Redis Pub/Sub acts as a shared "message bus" so a
//   message from one instance can reach clients on every instance.
//
// Why TWO clients (publish + subscribe)?
//   In Redis, once a connection enters "subscribe mode" it can no
//   longer run normal commands (like publishing). So we keep one
//   dedicated client for publishing and a separate one for subscribing.
// -------------------------------------------------------------

import { Redis } from "ioredis";

// Client used ONLY to publish (send) messages onto a Redis channel.
export const redisPublish = new Redis({
    host: 'localhost', // Redis is running locally (see docker-compose.yml)
    port: 6379         // default Redis port
});

// Client used ONLY to subscribe (listen) to a Redis channel.
export const redisSubscribe = new Redis({
    host: 'localhost',
    port: 6379
});
