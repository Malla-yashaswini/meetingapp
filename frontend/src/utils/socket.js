import { io } from "socket.io-client";

let socket;

export const connectSocket = () => {
  if (!socket) {
    socket = io("http://localhost:5000", {
      transports: ["websocket"],
    });
  }
  return socket;
};

export const getSocket = () => socket;
