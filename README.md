# WebSocket Learn 🔌

A hands-on project for learning **WebSockets** from scratch — built while following a WebSocket masterclass. It starts from "why HTTP isn't enough" and ends with a **horizontally scalable chat server** using Redis Pub/Sub.

This isn't just another chat-app demo. The goal was to learn WebSockets *properly*: not only the happy path, but how to **scale** them across multiple server instances — the part most tutorials skip.

---

## Why WebSockets? (The Problem)

### How normal HTTP works
HTTP follows a **Request–Response cycle**:

1. The client sends a request ("I want something").
2. The server validates, processes, and sends back a response.
3. **The connection is closed.**

That's how the whole web works. But it creates a problem: once the connection closes, **the server can't push new data to the client**. If you're building something real-time — a stock ticker, live notifications, a chat — the server has no way to send updates after the response.

### The workaround: Polling (and why it's bad)
One hack is **polling** — the client keeps asking "has anything changed?" on a timer, opening a brand-new connection every time.

- 🐢 **Overhead** — a new TCP handshake on every request.
- ⏱️ **Not truly real-time** — data is delayed by the polling interval.
- 🗑️ **Wasted resources** — you hammer the server even when nothing changed.

### The solution: WebSockets
> *"The WebSocket API makes it possible to open a two-way interactive communication session between the user's browser and a server."*

Open the connection **once**, keep it **open**, and let both sides send data anytime over the **same connection** — full-duplex, no re-polling.

**How the handshake works:** the client sends a normal HTTP request with special headers (`Connection: Upgrade`, `Upgrade: websocket`). The server agrees to upgrade, and the connection transitions to an **Open State**. From there it's a two-way channel until either side closes it.

You can see this yourself in the browser **Network tab**: the first request is a plain `GET` for the HTML, the second is the WebSocket handshake that stays in a continuous "pending" (open) state.

---

## What's in this project

```
web-socket-learn/
├── server.js            # HTTP + WebSocket server, wired to Redis Pub/Sub
├── connection.js        # Redis publisher & subscriber clients
├── index.html           # Minimal chat UI (vanilla JS WebSocket client)
├── docker-compose.yml   # Spins up Redis locally
├── package.json
└── README.md
```

**Tech stack**
- [Node.js](https://nodejs.org/) (ES Modules — `"type": "module"`)
- [`ws`](https://www.npmjs.com/package/ws) — WebSocket server
- [`ioredis`](https://www.npmjs.com/package/ioredis) — Redis client for Pub/Sub
- Docker — to run Redis

---

## How it was built

### 1. A WebSocket server on top of an HTTP server
A WebSocket connection starts life as an HTTP request, so we attach the WebSocket server to a normal HTTP server. The HTTP handler serves `index.html`; upgrade requests are handled automatically by `ws`.

```js
import http from 'node:http';
import { WebSocketServer } from 'ws';
import fs from 'node:fs/promises';
import path from 'path';

const httpServer = http.createServer(async (req, res) => {
    const indexFile = await fs.readFile(path.resolve('./index.html'), 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    return res.end(indexFile);
});

const wsServer = new WebSocketServer({ server: httpServer });
```

### 2. The client connection
On the browser side, opening a connection is a single line. Once it's open, we listen for messages and send messages on a button click.

```js
const { port } = window.location;
const connection = new WebSocket(`ws://localhost:${port}`);

connection.onopen = () => {
    connection.onmessage = (message) => {
        const { message: text } = JSON.parse(message.data);
        const li = document.createElement('li');
        li.innerText = text;
        messagesContainer.appendChild(li);
    };

    messageSendButton.addEventListener('click', () => {
        connection.send(JSON.stringify({ message: messageInput.value }));
    });
};
```

### 3. Scaling out with Redis Pub/Sub
Here's the part that goes beyond a basic chat app.

A WebSocket server keeps its connected clients **in memory**. If you run **multiple server instances** behind a load balancer, a client connected to **Server A** has no idea about a client connected to **Server B** — `wsServer.clients` on A only knows about A's connections. Broadcasting to "everyone" breaks.

The fix is **Redis Pub/Sub** as a shared message bus:

1. When any client sends a message, the server **publishes** it to a Redis channel.
2. **Every** server instance is **subscribed** to that channel.
3. On receiving a published message, each instance broadcasts it to **its own** connected clients.

This way, a message from a client on Server A reaches clients on Server B, C, D… and the server fleet scales horizontally.

```js
// connection.js — separate clients for publishing and subscribing
import { Redis } from "ioredis";

export const redisPublish = new Redis({ host: 'localhost', port: 6379 });
export const redisSubscribe = new Redis({ host: 'localhost', port: 6379 });
```

```js
// server.js — the scaling glue
const REDIS_CHANNEL = 'ws-messages';

redisSubscribe.subscribe(REDIS_CHANNEL);

// Fan a published message out to THIS instance's clients
redisSubscribe.on('message', (channel, message) => {
    if (channel === REDIS_CHANNEL) {
        wsServer.clients.forEach((client) => client.send(message.toString()));
    }
});

// A client message goes to Redis, not directly to other clients
wsServer.on('connection', (websocket) => {
    websocket.on('message', async (data) => {
        await redisPublish.publish(REDIS_CHANNEL, data.toString());
    });
});
```

> 💡 **Why two Redis clients?** In Redis, once a connection enters subscribe mode it can't run normal commands. So we keep one client for publishing and a separate one for subscribing.

---

## Running it locally

### Prerequisites
- Node.js (18+)
- Docker (to run Redis)

### 1. Start Redis
```bash
docker compose up -d
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the server
```bash
node server.js
```

You should see:
```
Server started on http://localhost: 9000
```

### 4. Open the app
Visit **http://localhost:9000** in two or more browser tabs. Type a message in one tab and hit **Send** — it appears in every connected tab, routed through Redis.

> The server listens on `process.env.PORT || 9000`. To simulate a horizontally-scaled fleet, run multiple instances on different ports (`PORT=9001 node server.js`, `PORT=9002 node server.js`, …) — because they all share the same Redis channel, messages still reach every client.

---

## Key takeaways

- **HTTP** is request–response and closes the connection; the server can't push.
- **Polling** fakes real-time but wastes connections and resources.
- **WebSockets** keep one connection open for full-duplex, real-time messaging.
- The handshake **starts over HTTP** using the `Upgrade` header.
- A single WebSocket server holds clients **in memory** — to scale across instances you need a shared bus like **Redis Pub/Sub**.

---

## Ideas to take it further
- Persist chat history in a database.
- Add usernames / rooms (separate Redis channels per room).
- Authenticate connections during the upgrade handshake.
- Handle reconnection and heartbeats (ping/pong) on the client.
- Put the servers behind a load balancer with sticky sessions.
