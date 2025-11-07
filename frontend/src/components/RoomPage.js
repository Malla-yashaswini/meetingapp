import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { getSocket } from "../utils/socket";
import { createPeer, addPeer } from "../utils/peer";
import "../App.css";

function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const userName = query.get("name") || "Guest";
  const initialMic = query.get("mic") === "true";
  const initialVideo = query.get("video") === "true";

  const [peers, setPeers] = useState([]);
  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(initialMic);
  const [videoOn, setVideoOn] = useState(initialVideo);
  const userVideo = useRef();
  const peersRef = useRef([]);
  const socket = getSocket();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((mediaStream) => {
      setStream(mediaStream);
      if (userVideo.current) userVideo.current.srcObject = mediaStream;
      mediaStream.getAudioTracks()[0].enabled = initialMic;
      mediaStream.getVideoTracks()[0].enabled = initialVideo;

      socket.emit("join-room", { roomId, name: userName });

      socket.on("all-users", (users) => {
        const peersList = [];
        users.forEach(({ id, name }) => {
          const peer = createPeer(id, socket.id, mediaStream, userName);
          peersRef.current.push({ peerID: id, peer, name });
          peersList.push({ peer, name });
        });
        setPeers(peersList);
      });

      socket.on("user-joined", (payload) => {
        const peer = addPeer(payload.signal, payload.callerId, mediaStream);
        peersRef.current.push({ peerID: payload.callerId, peer, name: payload.name });
        setPeers((prev) => [...prev, { peer, name: payload.name }]);
      });

      socket.on("receiving-returned-signal", (payload) => {
        const item = peersRef.current.find((p) => p.peerID === payload.id);
        if (item) item.peer.signal(payload.signal);
      });

      socket.on("user-left", (id) => {
        const peerObj = peersRef.current.find((p) => p.peerID === id);
        if (peerObj) peerObj.peer.destroy();
        peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
        setPeers((prev) => prev.filter((p) => p.peer !== peerObj.peer));
      });
    });
  }, []);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = !micOn;
      setMicOn(!micOn);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks()[0].enabled = !videoOn;
      setVideoOn(!videoOn);
    }
  };

  const leaveRoom = () => {
    socket.emit("leave-room", roomId);
    navigate("/");
  };

  return (
    <div className="room-container">
      <div className="video-grid">
        <div className="video-card">
          <video ref={userVideo} autoPlay playsInline muted className="video" />
          <p className="name-tag">{userName} (You)</p>
        </div>
        {peers.map((p, i) => (
          <Video key={i} peer={p.peer} name={p.name} />
        ))}
      </div>

      <div className="control-bar">
        <button onClick={toggleMic}>{micOn ? "Mic On" : "Mic Off"}</button>
        <button onClick={toggleVideo}>{videoOn ? "Video On" : "Video Off"}</button>
        <button className="btn-danger" onClick={leaveRoom}>Leave Room</button>
      </div>
    </div>
  );
}

function Video({ peer, name }) {
  const ref = useRef();
  useEffect(() => {
    peer.on("stream", (stream) => {
      if (ref.current) ref.current.srcObject = stream;
    });
  }, [peer]);

  return (
    <div className="video-card">
      <video ref={ref} autoPlay playsInline className="video" />
      <p className="name-tag">{name}</p>
    </div>
  );
}

export default RoomPage;
