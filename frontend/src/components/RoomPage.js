import React, { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import Peer from "simple-peer";
import { getSocket } from "../utils/socket";
import "../App.css";

/*
  RoomPage notes:
  - Uses simple-peer for P2P streams with socket signaling
  - Expects ?name=...&mic=true/false&video=true/false in URL
  - Shows local + remote videos, allows toggling mic/video in-room
*/

export default function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const name = query.get("name") || "Guest";
  const initialMic = query.get("mic") === "true";
  const initialVideo = query.get("video") === "true";

  const [peers, setPeers] = useState([]); // {id, peer, name}
  const userVideo = useRef();
  const peersRef = useRef([]);
  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(initialMic);
  const [videoOn, setVideoOn] = useState(initialVideo);
  const socket = getSocket();

  useEffect(() => {
    // connect to socket already created in utils/socket.js
    
    socket.connect();

    // obtain local media (prefer real camera)
    let mounted = true;
    const init = async () => {
      try {
        // permission prompt first so labels are visible
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        tmp.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        const real = videoInputs.find((d) => !/virtual|vcam|snap|animaze|obs/i.test(d.label))?.deviceId;
        const constraints = {
          video: real ? { deviceId: { exact: real } } : true,
          audio: true,
        };

        const localStream = await navigator.mediaDevices.getUserMedia(constraints);

        // apply initial settings
        if (localStream.getAudioTracks()[0]) localStream.getAudioTracks()[0].enabled = initialMic;
        if (localStream.getVideoTracks()[0]) localStream.getVideoTracks()[0].enabled = initialVideo;

        if (!mounted) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(localStream);
        if (userVideo.current) userVideo.current.srcObject = localStream;

        socket.emit("join-room", { roomId, name });

        // existing users
        socket.on("all-users", (users) => {
          const peersList = [];
          users.forEach((user) => {
            const peer = createPeer(user.socketId, socket.id, localStream);
            peersRef.current.push({
              peerID: user.socketId,
              peer,
              name: user.name,
            });
            peersList.push({ id: user.socketId, peer, name: user.name });
          });
          setPeers(peersList);
        });

        socket.on("user-joined", (payload) => {
          const peer = addPeer(payload.signal, payload.callerId, localStream);
          peersRef.current.push({
            peerID: payload.callerId,
            peer,
            name: payload.name,
          });
          setPeers((users) => [...users, { id: payload.callerId, peer, name: payload.name }]);
        });

        socket.on("receiving-returned-signal", (payload) => {
          const item = peersRef.current.find((p) => p.peerID === payload.id);
          if (item) item.peer.signal(payload.signal);
        });

        socket.on("user-left", (id) => {
          const peerObj = peersRef.current.find((p) => p.peerID === id);
          if (peerObj) peerObj.peer.destroy();
          peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
          setPeers((prev) => prev.filter((p) => p.id !== id));
        });
      } catch (err) {
        console.error("Room media/init error:", err);
      }
    };

    init();

    return () => {
      mounted = false;
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-returned-signal");
      socket.off("user-left");
      socket.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createPeer(userToSignal, callerId, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("sending-signal", { userToSignal, callerId, signal, name });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerId, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("returning-signal", { signal, callerId });
    });

    peer.signal(incomingSignal);

    return peer;
  }

  const toggleMic = () => {
    if (!stream) return;
    const t = stream.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setMicOn(t.enabled);
    }
  };

  const toggleVideo = () => {
    if (!stream) return;
    const t = stream.getVideoTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setVideoOn(t.enabled);
    }
  };

  const copyPreviewLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/preview/${roomId}`);
    alert("Preview link copied!");
  };

  return (
    <div className="room-page">
      <h2>Room {roomId}</h2>

      <div className="share-row">
        <button className="btn" onClick={copyPreviewLink}>
          Copy Preview Link
        </button>
        <div className="participants-count">{peers.length + 1} participant(s)</div>
      </div>

      <div className="videos-grid">
        <div className="video-card">
          <video ref={userVideo} autoPlay playsInline muted className="video" />
          <div className="name-tag">{name} (You)</div>
        </div>

        {peers.map((p) => (
          <PeerVideo key={p.id} peer={p.peer} name={p.name} />
        ))}
      </div>

      <div className="controls-row">
        <button className={`btn ${micOn ? "active" : ""}`} onClick={toggleMic}>
          {micOn ? "Mic On" : "Mic Off"}
        </button>
        <button className={`btn ${videoOn ? "active" : ""}`} onClick={toggleVideo}>
          {videoOn ? "Video On" : "Video Off"}
        </button>
      </div>
    </div>
  );
}

function PeerVideo({ peer, name }) {
  const ref = useRef();

  useEffect(() => {
    peer.on("stream", (stream) => {
      if (ref.current) ref.current.srcObject = stream;
    });
    return () => {
      peer.removeAllListeners("stream");
    };
  }, [peer]);

  return (
    <div className="video-card">
      <video ref={ref} autoPlay playsInline className="video" />
      <div className="name-tag">{name}</div>
    </div>
  );
}
