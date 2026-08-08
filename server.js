import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({port:8080});

wss.on('connection',(socket,request) =>{
    const ip = request.socket.remoteAddress;

    socket.on('message', (rawData)=>{
        const message = rawData.toString();
        console.log({rawData});

        wss.clients.forEach((client) =>{
            if (client.readyState === WebSocket.OPEN) {
                client.send(`Server Broadcast: ${message}`)
            }
        })

        socket.on('error', (err) =>{
            console.error(`Error: ${err.message}: ${ip}`)
        })

       
        })

    })
