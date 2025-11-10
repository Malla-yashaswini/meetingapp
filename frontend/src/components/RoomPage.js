import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import { useLocation } from "react-router-dom";

const socket = io("http://localhost:5000");
const VIRTUAL_RE = /(virtual|snap|obs|xsplit|manycam|camlink|ndi|dummy)/i;

const RoomPage = () => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const location = useLocation();
  const name = new URLSearchParams(location.search).get("name");

  const initMedia = async () => {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const realCam = devices.find(
        (d) => d.kind === "videoinput" && !VIRTUAL_RE.test(d.label)
      );

      const constraints = {
        video: realCam
          ? { deviceId: { exact: realCam.deviceId }, width: 1280, height: 720 }
          : true,
        audio: true,
      };

      const s = await navigator.mediaDevices.getUserMedia(constraints);

      const track = s.getVideoTracks()[0];
      if (VIRTUAL_RE.test(track.label)) {
        s.getTracks().forEach((t) => t.stop());
        alert("Virtual camera detected! Please use a real webcam.");
        return;
      }

      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;

      socket.emit("join-room", { name });
    } catch (err) {
      console.error("Camera init error:", err);
      alert("Camera/mic access failed. Please allow permissions.");
    }
  };

  useEffect(() => {
    initMedia();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line
  }, []);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setMicOn(!micOn);
    }
  };

  const toggleCam = () => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setCamOn(!camOn);
    }
  };

  return (
    <div className="room-container">
      <div className="video-wrapper">
        <video ref={videoRef} autoPlay playsInline muted className="room-video" />
      </div>
      <div className="controls">
        <button onClick={toggleMic}>{micOn ? "Mute Mic" : "Unmute Mic"}</button>
        <button onClick={toggleCam}>{camOn ? "Turn Off Cam" : "Turn On Cam"}</button>
      </div>
    </div>
  );
};

export default RoomPage;
