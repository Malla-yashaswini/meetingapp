import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import SimplePeer from "simple-peer";
import { getSocket } from "../utils/socket";
import "../App.css";

/*
RoomPage:
- Real camera only (filters out virtual devices)
- Receives mic/video settings & username from PreviewPage
- Supports multiple users in same room
- Has in-room mic/video toggles
- Generates a shareable preview link
*/

const VIRTUAL_RE = /virtual|vcam|snap|animaze|obs/i;

export default function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const userName = query.get("name") || "Guest";
  const initialMic = query.get("mic") === "true";
  const initialVideo = query.get("video") === "true";

  const socket = getSocket();
  const [peers, setPeers] = useState([]); // {id, peer, name}
  const userVideo = useRef();
  const peersRef = useRef([]);
  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(initialMic);
  const [videoOn, setVideoOn] = useState(initialVideo);

  // 🔹 Initialize local stream + socket logic
  useEffect(() => {
    socket.connect();

    let mounted = true;
    const init = async () => {
      try {
        // request permission so device labels are visible
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        tmp.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        const real = videoInputs.find((d) => !VIRTUAL_RE.test(d.label))?.deviceId;

        const constraints = {
          video: real ? { deviceId: { exact: real } } : true,
          audio: true,
        };

        const localStream = await navigator.mediaDevices.getUserMedia(constraints);

        if (!mounted) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(localStream);
        if (userVideo.current) userVideo.current.srcObject = localStream;

        // Apply initial mic/video settings
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];
        if (audioTrack) audioTrack.enabled = micOn;
        if (videoTrack) videoTrack.enabled = videoOn;

        socket.emit("join-room", { roomId, userName });

        // Handle existing users
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

        // Handle new user joining
        socket.on("user-joined", (payload) => {
          const peer = addPeer(payload.signal, payload.callerId, localStream);
          peersRef.current.push({
            peerID: payload.callerId,
            peer,
            name: payload.name,
          });
          setPeers((users) => [...users, { id: payload.callerId, peer, name: payload.name }]);
        });

        // Handle signal return
        socket.on("receiving-returned-signal", (payload) => {
          const item = peersRef.current.find((p) => p.peerID === payload.id);
          if (item) item.peer.signal(payload.signal);
        });

        // Handle user leaving
        socket.on("user-left", (id) => {
          const peerObj = peersRef.current.find((p) => p.peerID === id);
          if (peerObj) peerObj.peer.destroy();
          peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
          setPeers((prev) => prev.filter((p) => p.id !== id));
        });
      } catch (err) {
        console.error("Room init error:", err);
        alert("Could not access camera/microphone. Please check permissions.");
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

  // 🔹 Peer connection helpers
  function createPeer(userToSignal, callerId, stream) {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("sending-signal", { userToSignal, callerId, signal, name: userName });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerId, stream) {
    const peer = new SimplePeer({
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

  // 🔹 Mic toggle
  const toggleMic = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  // 🔹 Video toggle
  const toggleVideo = () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoOn(videoTrack.enabled);
    }
  };

  // 🔹 Copy preview link
  const copyPreviewLink = () => {
    const link = `${window.location.origin}/preview/${roomId}`;
    navigator.clipboard.writeText(link);
    alert("Preview link copied!");
  };

  return (
    <div className="room-page">
      <h2>Room ID: {roomId}</h2>

      <div className="share-row">
        <button className="btn" onClick={copyPreviewLink}>
          Copy Preview Link
        </button>
        <div className="participants-count">{peers.length + 1} participant(s)</div>
      </div>

      <div className="videos-grid">
        <div className="video-card">
          <video ref={userVideo} autoPlay playsInline muted className="video" />
          <div className="name-tag">{userName} (You)</div>
        </div>

        {peers.map((p) => (
          <PeerVideo key={p.id} peer={p.peer} name={p.name} />
        ))}
      </div>

      <div className="controls-row">
        <button className={`btn ${micOn ? "active" : ""}`} onClick={toggleMic}>
          {micOn ? "🎤 Mic On" : "🔇 Mic Off"}
        </button>
        <button className={`btn ${videoOn ? "active" : ""}`} onClick={toggleVideo}>
          {videoOn ? "📹 Video On" : "📷 Video Off"}
        </button>
      </div>
    </div>
  );
}

// 🔹 Component for remote user’s video
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
