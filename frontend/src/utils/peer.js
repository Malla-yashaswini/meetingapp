import Peer from "simple-peer";

export const createPeer = (userToSignal, callerId, stream) => {
  const peer = new Peer({
    initiator: true,
    trickle: false,
    stream,
  });

  peer.on("signal", signal => {
    const socket = require("./socket").getSocket();
    socket.emit("sending-signal", { userToSignal, callerId, signal });
  });

  return peer;
};

export const addPeer = (incomingSignal, callerId, stream) => {
  const peer = new Peer({
    initiator: false,
    trickle: false,
    stream,
  });

  peer.on("signal", signal => {
    const socket = require("./socket").getSocket();
    socket.emit("returning-signal", { signal, callerId });
  });

  peer.signal(incomingSignal);
  return peer;
};
