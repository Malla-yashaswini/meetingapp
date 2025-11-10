// src/pages/PreviewPage.js
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../App.css";

const VIRTUAL_RE = /(virtual|snap|obs|xsplit|manycam|vcam|animaze|ndi|camlink|dummy)/i;

export default function PreviewPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [name, setName] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");

  // pick a real camera if possible
  useEffect(() => {
    let mounted = true;
    let local;

    const init = async () => {
      try {
        // request permission to get labels
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        tmp.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        const real = cams.find((c) => !VIRTUAL_RE.test(c.label));

        local = await navigator.mediaDevices.getUserMedia({
          video: real ? { deviceId: { exact: real.deviceId }, width: 1280, height: 720 } : true,
          audio: true,
        });

        if (!mounted) {
          local.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(local);
        if (videoRef.current) videoRef.current.srcObject = local;
      } catch (e) {
        console.error("PreviewPage camera error", e);
        setError("Unable to access camera/microphone. Check permissions.");
      }
    };

    init();
    return () => {
      mounted = false;
      if (local) local.getTracks().forEach((t) => t.stop());
    };
  }, [roomId]);

  // apply toggles
  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    stream.getVideoTracks().forEach((t) => (t.enabled = videoOn));
  }, [micOn, videoOn, stream]);

  const copyLink = () => {
    const link = `${window.location.origin}/preview/${roomId}`;
    navigator.clipboard.writeText(link);
    alert("Preview link copied!");
  };

  const joinRoom = () => {
    if (!name.trim()) return alert("Please enter your name");
    navigate(`/room/${roomId}`, { state: { name: name.trim(), micOn, videoOn, lang: "en-US" } });
  };

  return (
    <div className="page-center white-bg">
      <div className="card preview-card">
        <h2>Preview</h2>
        {error && <div className="error">{error}</div>}

        <div className="preview-video-wrap">
          <video ref={videoRef} autoPlay playsInline muted className={`preview-video ${!videoOn ? "hidden" : ""}`} />
          {!videoOn && <div className="video-placeholder">Camera off</div>}
        </div>

        <div className="controls-row">
          <button className={`btn ${micOn ? "on" : "off"}`} onClick={() => setMicOn((s) => !s)}>
            {micOn ? "Mic On" : "Mic Off"}
          </button>
          <button className={`btn ${videoOn ? "on" : "off"}`} onClick={() => setVideoOn((s) => !s)}>
            {videoOn ? "Video On" : "Video Off"}
          </button>
        </div>

        <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="actions-row">
          <button className="btn primary" onClick={joinRoom}>Join Room</button>
          <button className="btn" onClick={copyLink}>Copy Preview Link</button>
        </div>

        <small className="muted">Room ID: <code>{roomId}</code></small>
      </div>
    </div>
  );
}
