// src/components/PreviewPage.js
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../App.css";

const VIRTUAL_RE = /virtual|vcam|obs|snap|animaze|nvidia|mmhmm/i;

export default function PreviewPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [name, setName] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");

  // pick real camera
  useEffect(() => {
    let mounted = true;
    let localStream;

    const init = async () => {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        tmp.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const realCam = devices.find(
          (d) => d.kind === "videoinput" && !VIRTUAL_RE.test(d.label)
        );

        localStream = await navigator.mediaDevices.getUserMedia({
          video: realCam ? { deviceId: { exact: realCam.deviceId } } : true,
          audio: true,
        });

        if (!mounted) return;
        setStream(localStream);
        if (videoRef.current) videoRef.current.srcObject = localStream;
      } catch (err) {
        console.error("Camera access error:", err);
        setError("Could not access camera/mic. Please check permissions.");
      }
    };

    init();
    return () => {
      mounted = false;
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // toggle mic/video
  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    stream.getVideoTracks().forEach((t) => (t.enabled = videoOn));
  }, [micOn, videoOn, stream]);

  const joinRoom = () => {
    if (!name.trim()) return alert("Please enter your name");
    const qs = `?name=${encodeURIComponent(name)}&mic=${micOn}&video=${videoOn}`;
    navigate(`/room/${roomId}${qs}`);
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/preview/${roomId}`;
    navigator.clipboard.writeText(link);
    alert("Room link copied!");
  };

  return (
    <div className="preview-container">
      <div className="preview-card">
        <h2>Meeting Preview</h2>

        {error && <p className="error">{error}</p>}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`preview-video ${!videoOn ? "hidden" : ""}`}
        />
        {!videoOn && <div className="video-off-msg">Camera Off</div>}

        <div className="control-buttons">
          <button onClick={() => setMicOn((m) => !m)} className={`btn ${micOn ? "on" : "off"}`}>
            {micOn ? "Mic On" : "Mic Off"}
          </button>
          <button onClick={() => setVideoOn((v) => !v)} className={`btn ${videoOn ? "on" : "off"}`}>
            {videoOn ? "Video On" : "Video Off"}
          </button>
        </div>

        <input
          className="name-input"
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="actions">
          <button className="btn primary" onClick={joinRoom}>
            Join Room
          </button>
          <button className="btn secondary" onClick={copyRoomLink}>
            Copy Room Link
          </button>
        </div>
      </div>
    </div>
  );
}
