// src/utils/socket.js
import { io } from "socket.io-client";

// Use your backend Render URL here
const BACKEND_URL = "https://meetingapp-backend.onrender.com";

const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ["websocket"],
});

export const getSocket = () => socket;
