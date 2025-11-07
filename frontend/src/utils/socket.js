import { io } from "socket.io-client";

let socket;

export const connectSocket = () => {
  if (!socket) {
    socket = io("https://meetingapp-8q7o.onrender.com", {
      transports: ["websocket"],
    });
  }
  return socket;
};

export const getSocket = () => socket;
