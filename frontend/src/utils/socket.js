// persistent socket with unlimited reconnect attempts
import { io } from "socket.io-client";

const BACKEND = "https://meetingapp-8q7o.onrender.com"; // your deployed backend

const socket = io(BACKEND, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export default socket;
