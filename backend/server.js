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
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {}; // { roomId: [{ socketId, name }, ...] }

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on("join-room", ({ roomId, name }) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    // send existing users to the new user
    const otherUsers = rooms[roomId].map((u) => ({ socketId: u.socketId, name: u.name }));
    socket.emit("all-users", otherUsers);

    // notify others
    rooms[roomId].push({ socketId: socket.id, name: name || "Guest" });
    socket.join(roomId);

    // tell others new user joined (used to create offers)
    socket.to(roomId).emit("user-joined", { callerId: socket.id, name: name || "Guest" });

    console.log(`${name} joined ${roomId}`);
  });

  socket.on("sending-signal", (payload) => {
    // payload: { userToSignal, callerId, signal, name }
    io.to(payload.userToSignal).emit("user-joined", {
      signal: payload.signal,
      callerId: payload.callerId,
      name: payload.name,
    });
  });

  socket.on("returning-signal", (payload) => {
    // payload: { signal, callerId }
    io.to(payload.callerId).emit("receiving-returned-signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("leave-room", (roomId) => {
    if (!rooms[roomId]) return;
    rooms[roomId] = rooms[roomId].filter((u) => u.socketId !== socket.id);
    socket.to(roomId).emit("user-left", socket.id);
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    // remove from all rooms
    for (const r of Object.keys(rooms)) {
      const before = rooms[r].length;
      rooms[r] = rooms[r].filter((u) => u.socketId !== socket.id);
      if (rooms[r].length !== before) {
        io.to(r).emit("user-left", socket.id);
      }
    }
    console.log("socket disconnected", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("MeetChat backend running");
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log("Server listening on", port));
