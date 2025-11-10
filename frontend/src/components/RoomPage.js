// src/components/RoomPage.js
import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import "../App.css";

const socket = io("https://meetingapp-backend.onrender.com"); // your deployed backend URL
const VIRTUAL_RE = /virtual|vcam|obs|snap|animaze|nvidia|mmhmm/i;

export default function RoomPage() {
  const { roomId } = useParams();
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const name = query.get("name") || "Guest";
  const mic = query.get("mic") === "true";
  const video = query.get("video") === "true";

  const [peers, setPeers] = useState([]);
  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(mic);
  const [videoOn, setVideoOn] = useState(video);
  const videoRef = useRef(null);
  const peersRef = useRef({});

  // get real camera
  useEffect(() => {
    const initMedia = async () => {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
        tmp.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const realCam = devices.find(
          (d) => d.kind === "videoinput" && !VIRTUAL_RE.test(d.label)
        );
        const s = await navigator.mediaDevices.getUserMedia({
          video: realCam ? { deviceId: { exact: realCam.deviceId } } : true,
          audio: true,
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
        socket.emit("join-room", { roomId, name });
      } catch (e) {
        console.error(e);
      }
    };
    initMedia();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [roomId]);

  // handle mic/video toggles
  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    stream.getVideoTracks().forEach((t) => (t.enabled = videoOn));
  }, [micOn, videoOn, stream]);

  return (
    <div className="room-container">
      <h3>Room ID: {roomId}</h3>

      <div className="video-grid">
        <div className="video-box">
          <video ref={videoRef} autoPlay muted playsInline className="video-self" />
          <p>{name} (You)</p>
        </div>

        {peers.map((peerObj, i) => (
          <div key={i} className="video-box">
            <video ref={(ref) => (peerObj.ref = ref)} autoPlay playsInline />
            <p>{peerObj.name}</p>
          </div>
        ))}
      </div>

      <div className="control-buttons">
        <button onClick={() => setMicOn((m) => !m)} className={`btn ${micOn ? "on" : "off"}`}>
          {micOn ? "Mic On" : "Mic Off"}
        </button>
        <button onClick={() => setVideoOn((v) => !v)} className={`btn ${videoOn ? "on" : "off"}`}>
          {videoOn ? "Video On" : "Video Off"}
        </button>
      </div>
    </div>
  );
}
