import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 9000

const httpServer = http.createServer(async (req, res) => {})

const wsServer = new WebSocketServer({
    server: httpServer
});

wsServer.on('connection', (websocket) => {
    console.log('Websocket connected......')
})

httpServer.listen(PORT, () => {
    console.log(`Server started on http://localhost: ${PORT}`)
})