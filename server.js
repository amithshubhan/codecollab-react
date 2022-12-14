const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')
const cors = require('cors')
const io = new Server(server)
const { createClient } = require('redis')
const { v4 } = require('uuid')
const moment = require('moment')
const { json } = require('body-parser')



const { blueBright, greenBright, redBright } = require('chalk')


const coder = {}

const client = createClient()
app.use(json())
app.use(cors())

client.on('error', console.error)
client
  .connect()
  .then(() => console.log(blueBright.bold('Connected to redis locally!')))
  .catch(() => {
    console.error(redBright.bold('Error connecting to redis'))
  })

app.get('/', (req, res) => {
  res.send({ msg: 'hi' })
})
app.get('/:roomID',(req,res) => {
    
})

app.post('/create-room-with-user', async (req, res) => {
  const { username } = req.body
  const roomId = v4()

  await client
    .hSet(`${roomId}:info`, {
      created: moment(),
      updated: moment(),
      code:''
    })
    .catch((err) => {
      console.error(1, err)
    })

  // await client.lSet(`${roomId}:users`, [])

  res.status(201).send({ roomId })
})

io.on('connection', (socket) => {
  socket.on('join-video-room',async ({roomId,userid})=>{
    const roomName = `VIDEO:${roomId}`
    console.log(roomName)
    socket.join(roomId)
    console.log(`user id in server is 58 is ${userid}`)
    socket.broadcast.emit('user-video-connected', userid)
    socket.on('disconnect', () => {
      socket.broadcast.emit('user-video-disconnected', userid)
  })
  })
  socket.on('CODE_CHANGED', async (code) => {
    const { roomId, username } = await client.hGetAll(socket.id)
    coder[roomId] = code;
    // const todisplay = await client.hGet(`${roomId}:info`)
    // console.log(todisplay)
    const roomName = `ROOM:${roomId}`
    console.log("here the socket id in line 55")
    console.log(socket.id , " ", roomName)
    console.log(await client.hGetAll(socket.id))
    console.log("over")
    // io.emit('CODE_CHANGED', code)
    socket.to(roomName).emit('CODE_CHANGED', code)
  })

  socket.on('DISSCONNECT_FROM_ROOM', async ({ roomId, username }) => {})

  socket.on('CONNECTED_TO_ROOM', async ({ roomId, username }) => {
    console.log('here client is printed')
    console.log(await client)
    await client.lPush(`${roomId}:users`, `${username}`)
    await client.hSet(socket.id, { roomId, username})
    const users = await client.lRange(`${roomId}:users`, 0, -1)
    const roomName = `ROOM:${roomId}`
    socket.join(roomName)
    io.in(roomName).emit('ROOM:CONNECTION', users)
    // socket.emit('CODE_CHANGED',coder[roomId]);
  })

  socket.on('disconnect', async () => {
    // TODO if 2 users have the same name
    const { roomId, username } = await client.hGetAll(socket.id)
    const users = await client.lRange(`${roomId}:users`, 0, -1)
    const newUsers = users.filter((user) => username !== user)
    
    if (newUsers.length) {
      await client.del(`${roomId}:users`)
      await client.lPush(`${roomId}:users`, newUsers)
    } else {
      await client.del(`${roomId}:users`)
    }

    const roomName = `ROOM:${roomId}`
    io.in(roomName).emit('ROOM:CONNECTION', newUsers)
  })
})

server.listen(3001, () => {
  console.log(greenBright.bold('listening on *:3001'))
})
