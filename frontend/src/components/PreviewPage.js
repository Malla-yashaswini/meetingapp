import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../App.css";

/*
 PreviewPage:
 - Uses a real (non-virtual) camera when available
 - Lets user set name, mic/video toggles
 - Generates or accepts a roomId (URL param)
 - "Join Room" navigates to /room/:roomId with query params name/mic/video
*/

const VIRTUAL_RE = /virtual|vcam|snap|animaze|obs/i;

export default function PreviewPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [name, setName] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");

  // choose a non-virtual camera if possible
  useEffect(() => {
    let mounted = true;
    let activeStream = null;

    const start = async () => {
      try {
        // first request permission (labels show only after permission)
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        tmp.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");

        // prefer first camera that does not match virtual regex
        let chosen = videoInputs.find((d) => !VIRTUAL_RE.test(d.label))?.deviceId;
        if (!chosen && videoInputs.length) chosen = videoInputs[0].deviceId;

        activeStream = await navigator.mediaDevices.getUserMedia({
          video: chosen ? { deviceId: { exact: chosen } } : true,
          audio: true,
        });

        if (!mounted) {
          activeStream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStream(activeStream);
        if (videoRef.current) videoRef.current.srcObject = activeStream;
        setError("");
      } catch (e) {
        console.error("Preview media error:", e);
        setError("Could not access camera/microphone. Check permissions or hardware.");
      }
    };

    start();

    return () => {
      mounted = false;
      if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // toggle mic/video on preview stream
  useEffect(() => {
    if (!stream) return;
    const audio = stream.getAudioTracks()[0];
    const video = stream.getVideoTracks()[0];
    if (audio) audio.enabled = micOn;
    if (video) video.enabled = videoOn;
  }, [micOn, videoOn, stream]);

  const onJoin = () => {
    if (!name.trim()) return alert("Enter your name");
    // pass via query params
    const qs = `?name=${encodeURIComponent(name)}&mic=${micOn}&video=${videoOn}`;
    navigate(`/room/${roomId}${qs}`);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/preview/${roomId}`;
    navigator.clipboard.writeText(link);
    alert("Preview link copied!");
  };

  return (
    <div className="preview-page">
      <div className="preview-card">
        <h2>Preview</h2>

        {error && <div className="error">{error}</div>}

        <div className="video-wrap">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`preview-video ${!videoOn ? "hidden" : ""}`}
          />
          {!videoOn && <div className="video-off">Camera is off</div>}
        </div>

        <div className="controls-row">
          <button className={`btn ${micOn ? "active" : ""}`} onClick={() => setMicOn((s) => !s)}>
            {micOn ? "Mic On" : "Mic Off"}
          </button>
          <button
            className={`btn ${videoOn ? "active" : ""}`}
            onClick={() => setVideoOn((s) => !s)}
          >
            {videoOn ? "Video On" : "Video Off"}
          </button>
        </div>

        <input
          className="text-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="actions-row">
          <button className="btn primary" onClick={onJoin}>
            Join Room
          </button>
          <button className="btn" onClick={copyLink}>
            Copy Preview Link
          </button>
        </div>

        <small className="muted">Room ID: {roomId}</small>
      </div>
    </div>
  );
}
