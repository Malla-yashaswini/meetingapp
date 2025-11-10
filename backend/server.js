import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://meetingapp-frontend.onrender.com"],
    methods: ["GET", "POST"]
  }
});

// ✅ Track rooms and users
const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // --- Join Room ---
  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, name: userName });

    io.to(roomId).emit("user-joined", { id: socket.id, name: userName });
    io.to(roomId).emit("update-participants", rooms[roomId]);
  });

  // --- WebRTC Signaling ---
  socket.on("offer", (data) => {
    socket.to(data.target).emit("offer", {
      sdp: data.sdp,
      caller: data.caller,
    });
  });

  socket.on("answer", (data) => {
    socket.to(data.target).emit("answer", {
      sdp: data.sdp,
      callee: data.callee,
    });
  });

  socket.on("ice-candidate", (data) => {
    socket.to(data.target).emit("ice-candidate", data.candidate);
  });

  // --- Subtitles ---
  socket.on("subtitle", ({ roomId, text, userName }) => {
    socket.to(roomId).emit("subtitle", { userName, text });
  });

  // --- Screen Share Start/Stop ---
  socket.on("start-screen-share", ({ roomId, userId }) => {
    socket.to(roomId).emit("start-screen-share", { userId });
  });

  socket.on("stop-screen-share", ({ roomId, userId }) => {
    socket.to(roomId).emit("stop-screen-share", { userId });
  });

  // --- Leave Room ---
  socket.on("leave-room", ({ roomId }) => {
    socket.leave(roomId);
    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
      io.to(roomId).emit("update-participants", rooms[roomId]);
      io.to(roomId).emit("user-left", socket.id);
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const userIndex = rooms[roomId].findIndex(u => u.id === socket.id);
      if (userIndex !== -1) {
        const [user] = rooms[roomId].splice(userIndex, 1);
        io.to(roomId).emit("update-participants", rooms[roomId]);
        io.to(roomId).emit("user-left", socket.id);
        break;
      }
    }
  });
});

app.get("/", (req, res) => {
  res.send("Video Meeting App Backend is running ✅");
});

server.listen(5000 || process.env.PORT, () => {
  console.log("Server running on port 5000");
});
