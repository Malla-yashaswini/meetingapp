import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const VIRTUAL_RE = /(virtual|snap|obs|xsplit|manycam|camlink|ndi|dummy)/i;

const PreviewPage = () => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const initMedia = async () => {
    try {
      // Stop any previous camera stream
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

      // Double-check it's not virtual
      const track = s.getVideoTracks()[0];
      if (VIRTUAL_RE.test(track.label)) {
        s.getTracks().forEach((t) => t.stop());
        alert("Virtual camera detected! Please use a real webcam.");
        return;
      }

      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (e) {
      console.error("Camera init error:", e);
      alert("Camera access failed. Please allow camera/mic permissions.");
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

  const joinRoom = () => {
    if (!name.trim()) return alert("Enter your name");
    navigate(`/room?name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="preview-container">
      <div className="video-preview">
        <video ref={videoRef} autoPlay playsInline muted className="preview-video" />
      </div>
      <div className="controls">
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="buttons">
          <button onClick={toggleMic}>{micOn ? "Mute Mic" : "Unmute Mic"}</button>
          <button onClick={toggleCam}>{camOn ? "Turn Off Cam" : "Turn On Cam"}</button>
        </div>
        <button onClick={joinRoom} className="join-btn">Join Room</button>
      </div>
    </div>
  );
};

export default PreviewPage;
