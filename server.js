import http from 'node:http';
import { WebSocketServer } from 'ws';
import fs from 'node:fs/promises';
import path from 'path';

const PORT = process.env.PORT || 9000

const httpServer = http.createServer(async (req, res) => {
    const indexFile = await fs.readFile(path.resolve('./index.html'), 'utf-8');
    res.setHeader('Content-Type', 'text/html');

    return res.end(indexFile);
})

const wsServer = new WebSocketServer({
    server: httpServer
});

wsServer.on('connection', (websocket) => {
    console.log('Websocket connection......')

    websocket.on('message',(data) => {
        console.log(`Message from client,`, data.toString())
    })
})

httpServer.listen(PORT, () => {
    console.log(`Server started on http://localhost: ${PORT}`)
})