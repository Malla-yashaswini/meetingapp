import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

function PreviewPage() {
  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const videoRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    // ✅ Access real camera and mic
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => console.error("Camera error:", err));
  }, []);

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoOn;
        setVideoOn(!videoOn);
      }
    }
  };

  const handleJoin = () => {
    if (!roomId.trim()) return alert("Enter Room ID");
    navigate(`/room/${roomId}?name=${name || "Guest"}&mic=${micOn}&video=${videoOn}`);
  };

  const handleCreate = () => {
    const id = Math.random().toString(36).substring(2, 8);
    navigate(`/room/${id}?name=${name || "Host"}&mic=${micOn}&video=${videoOn}`);
  };

  return (
    <div className="preview-container">
      <div className="preview-box">
        <video ref={videoRef} autoPlay playsInline muted className="preview-video" />
        <div className="controls">
          <button onClick={toggleMic}>{micOn ? "Mic On" : "Mic Off"}</button>
          <button onClick={toggleVideo}>{videoOn ? "Video On" : "Video Off"}</button>
        </div>
      </div>

      <div className="preview-details">
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <div className="buttons">
          <button className="join-btn" onClick={handleJoin}>Join Room</button>
          <button className="create-btn" onClick={handleCreate}>Create Room</button>
        </div>
      </div>
    </div>
  );
}

export default PreviewPage;
