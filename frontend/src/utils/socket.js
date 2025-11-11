import { io } from "socket.io-client";

const BACKEND = "https://meetingapp-8q7o.onrender.com"; // deployed backend URL

const socket = io(BACKEND, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export const getSocket = () => socket; // <— add this line
export default socket;
