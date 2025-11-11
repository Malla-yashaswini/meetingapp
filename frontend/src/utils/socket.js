import { io } from "socket.io-client";

// Use your deployed backend HTTPS URL
const BACKEND = "https://meetingapp-8q7o.onrender.com";

const socket = io(BACKEND, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  withCredentials: true,
});

export const getSocket = () => socket;
export default socket;
