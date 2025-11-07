import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // For local dev and Render frontend
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, name }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    const usersInRoom = rooms[roomId];
    rooms[roomId].push({ id: socket.id, name });

    const otherUsers = usersInRoom.filter((u) => u.id !== socket.id);
    socket.emit("all-users", otherUsers);

    socket.to(roomId).emit("user-joined", { callerId: socket.id, name });

    socket.join(roomId);
    console.log(`${name} joined room ${roomId}`);
  });

  socket.on("sending-signal", (payload) => {
    io.to(payload.userToSignal).emit("user-joined", {
      signal: payload.signal,
      callerId: payload.callerId
    });
  });

  socket.on("returning-signal", (payload) => {
    io.to(payload.callerId).emit("receiving-returned-signal", {
      signal: payload.signal,
      id: socket.id
    });
  });

  socket.on("leave-room", (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter((u) => u.id !== socket.id);
      socket.to(roomId).emit("user-left", socket.id);
    }
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter((u) => u.id !== socket.id);
      io.to(roomId).emit("user-left", socket.id);
    }
    console.log("User disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("✅ Meet Chat Backend is Running!");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
