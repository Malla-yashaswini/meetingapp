import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";

const socket = io("https://meetingapp-8q7o.onrender.com");

const PreviewPage = () => {
  const videoRef = useRef(null);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomFromLink = params.get("room");
    if (roomFromLink) setRoomId(roomFromLink);
  }, [location]);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const realCamera = devices.find(
          (device) =>
            device.kind === "videoinput" &&
            !/virtual|obs|snap|cam/i.test(device.label)
        );
        const stream = await navigator.mediaDevices.getUserMedia({
          video: realCamera ? { deviceId: realCamera.deviceId } : true,
          audio: true,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera access denied or failed:", err);
        alert("Unable to access real camera. Please allow camera access.");
      }
    };
    initCamera();
  }, []);

  const handleJoin = () => {
    if (!name || !roomId) return alert("Enter name and room ID");
    socket.emit("join-room", { roomId, userName: name });
    navigate(`/room/${roomId}?name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="meeting-container">
      <h2>Preview Before Joining</h2>
      <div className="video-wrapper">
        <video ref={videoRef} autoPlay muted playsInline />
      </div>
      <div className="preview-inputs">
        <input
          type="text"
          placeholder="Enter Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
      </div>
      <button onClick={handleJoin} className="join-btn">Join Room</button>
    </div>
  );
};

export default PreviewPage;
