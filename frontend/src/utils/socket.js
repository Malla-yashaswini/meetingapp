// src/utils/socket.js
import { io } from "socket.io-client";

const BACKEND = "https://meetingapp-8q7o.onrender.com"; // your deployed backend

const socket = io(BACKEND, {
  transports: ["websocket"],
  // autoConnect true by default; we keep default
});

export default socket;
