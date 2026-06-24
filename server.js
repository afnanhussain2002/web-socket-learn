// server.js
// -------------------------------------------------------------
// The main server. It does two jobs:
//   1. Serves the chat UI (index.html) over plain HTTP.
//   2. Runs a WebSocket server (on the SAME HTTP server) for real-time
//      messaging, scaled across instances using Redis Pub/Sub.
//
// Big picture of a chat message:
//   client --(WebSocket)--> this server --(publish)--> Redis channel
//   Redis channel --(message event)--> EVERY server instance
//   each instance --(broadcast)--> its own connected clients
// -------------------------------------------------------------

import http from 'node:http';
import { WebSocketServer } from 'ws';
import fs from 'node:fs/promises';
import path from 'path';
// Our two Redis clients: one to publish messages, one to subscribe.
import { redisPublish, redisSubscribe } from './connection.js';

// Port to listen on. Use the PORT env var if set, otherwise default to 9000.
// Tip: run multiple instances on different ports (PORT=9001, 9002...) to
// see horizontal scaling work — they all share the same Redis channel.
const PORT = process.env.PORT || 9000;

// The Redis channel name all server instances publish to and listen on.
const REDIS_CHANNEL = 'ws-messages';

// 1) A normal HTTP server. For any request, it just serves index.html.
//    A WebSocket connection actually starts as an HTTP request, so the
//    WebSocket server (below) is attached to this same server.
const httpServer = http.createServer(async (req, res) => {
    const indexFile = await fs.readFile(path.resolve('./index.html'), 'utf-8');
    res.setHeader('Content-Type', 'text/html');

    return res.end(indexFile);
});

// 2) The WebSocket server, sharing the HTTP server above. The `ws` library
//    automatically handles the HTTP "Upgrade" handshake that turns a normal
//    request into a long-lived, two-way WebSocket connection.
const wsServer = new WebSocketServer({
    server: httpServer
});

// 3) Subscribe this instance to the shared Redis channel so it receives
//    every message any instance publishes.
redisSubscribe.subscribe(REDIS_CHANNEL);

// 4) When a message arrives on the Redis channel, broadcast it to all of
//    THIS instance's connected WebSocket clients. Because every instance
//    does this, the message reaches clients across all instances.
redisSubscribe.on('message', (channel, message) => {
    if (channel === REDIS_CHANNEL) {
        // Broadcast message to all of your connected clients
        wsServer.clients.forEach((client) => {
            client.send(message.toString());
        });
    }
});

// 5) Handle each new WebSocket client.
wsServer.on('connection', (websocket) => {
    console.log('Websocket connection......');

    // When a client sends a message, we DON'T send it directly to other
    // clients. Instead we publish it to Redis, which then fans it out to
    // every instance (see the subscribe handler above). This is what makes
    // the chat work across multiple servers.
    websocket.on('message', async (data) => {
        console.log(`Message from client:`, data.toString());

        await redisPublish.publish(REDIS_CHANNEL, data.toString());
    });
});

// Start listening for HTTP (and therefore WebSocket) connections.
httpServer.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
