import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../App.css";

const VIRTUAL_RE = /(virtual|snap|obs|xsplit|manycam|vcam|animaze|ndi|camlink|dummy|mmhmm)/i;

export default function PreviewPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [name, setName] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");

  // pick a real camera only
  useEffect(() => {
    let mounted = true;
    let active = null;

    const init = async () => {
      try {
        // request any permission to get device labels
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        tmp.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");

        // prefer non-virtual camera
        const real = cams.find((c) => !VIRTUAL_RE.test(c.label));
        const constraints = real
          ? { video: { deviceId: { exact: real.deviceId }, width: 1280, height: 720 }, audio: true }
          : { video: true, audio: true };

        active = await navigator.mediaDevices.getUserMedia(constraints);

        if (!mounted) {
          active.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(active);
        if (videoRef.current) videoRef.current.srcObject = active;
        setError("");
      } catch (e) {
        console.error("Preview media error:", e);
        setError("Could not access camera/microphone. Check permissions or hardware.");
      }
    };

    init();
    return () => {
      mounted = false;
      if (active) active.getTracks().forEach((t) => t.stop());
    };
  }, [roomId]);

  useEffect(() => {
    if (!stream) return;
    const audio = stream.getAudioTracks()[0];
    const video = stream.getVideoTracks()[0];
    if (audio) audio.enabled = micOn;
    if (video) video.enabled = videoOn;
  }, [micOn, videoOn, stream]);

  const onJoin = () => {
    if (!name.trim()) return alert("Enter your name");
    // pass initial settings via state to RoomPage
    navigate(`/room/${roomId}`, { state: { name: name.trim(), micOn, videoOn } });
  };

  const copyLink = () => {
    const link = `${window.location.origin}/preview/${roomId}`;
    navigator.clipboard.writeText(link);
    alert("Preview link copied!");
  };

  return (
    <div className="preview-page meeting-container">
      <div className="preview-card card">
        <h2>Preview</h2>

        {error && <div className="error">{error}</div>}

        <div className="preview-video-wrap">
          <video ref={videoRef} autoPlay playsInline muted className={`preview-video ${!videoOn ? "hidden" : ""}`} />
          {!videoOn && <div className="video-placeholder">Camera off</div>}
        </div>

        <div className="controls-row" style={{ marginTop: 8 }}>
          <button className={`btn ${micOn ? "on" : "off"}`} onClick={() => setMicOn((s) => !s)}>
            {micOn ? "Mic On" : "Mic Off"}
          </button>
          <button className={`btn ${videoOn ? "on" : "off"}`} onClick={() => setVideoOn((s) => !s)}>
            {videoOn ? "Video On" : "Video Off"}
          </button>
        </div>

        <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="actions-row" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <button className="btn primary" onClick={onJoin}>Join Room</button>
          <button className="btn" onClick={copyLink}>Copy Preview Link</button>
        </div>

        <small className="muted" style={{ marginTop: 8 }}>Room ID: <code>{roomId}</code></small>
      </div>
    </div>
  );
}
