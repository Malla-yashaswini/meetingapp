import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import socket from "../utils/socket";
import "../App.css";

const VIRTUAL_RE = /(virtual|snap|obs|xsplit|manycam|vcam|animaze|ndi|camlink|dummy|mmhmm)/i;
const CAPTIONS_LIMIT = 6;

export default function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const userName = state.name || new URLSearchParams(location.search).get("name") || "Guest";

  const localVideoRef = useRef(null);
  const pcsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const [remotePeers, setRemotePeers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(state.micOn ?? true);
  const [videoOn, setVideoOn] = useState(state.videoOn ?? true);
  const [captions, setCaptions] = useState([]);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);

  async function getRealCameraConstraints() {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tmp.getTracks().forEach((t) => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      const real = cams.find((c) => !VIRTUAL_RE.test(c.label));
      if (real) return { video: { deviceId: { exact: real.deviceId }, width: 1280, height: 720 }, audio: true };
      return { video: true, audio: true };
    } catch (e) {
      console.warn("getRealCameraConstraints failed:", e);
      return { video: true, audio: true };
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (socket && !socket.connected) socket.connect();

      const constraints = await getRealCameraConstraints();
      try {
        if (localStream) localStream.getTracks().forEach((t) => t.stop());
        const s = await navigator.mediaDevices.getUserMedia(constraints);

        const videoTrack = s.getVideoTracks()[0];
        if (videoTrack && VIRTUAL_RE.test(videoTrack.label)) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === "videoinput" && !VIRTUAL_RE.test(d.label));
          if (cams.length) {
            s.getTracks().forEach((t) => t.stop());
            const s2 = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cams[0].deviceId }, width: 1280, height: 720 }, audio: true });
            if (!mounted) { s2.getTracks().forEach((t) => t.stop()); return; }
            setLocalStream(s2);
            if (localVideoRef.current) localVideoRef.current.srcObject = s2;
          } else {
            console.warn("No non-virtual camera found; using current camera");
            setLocalStream(s);
            if (localVideoRef.current) localVideoRef.current.srcObject = s;
          }
        } else {
          if (!mounted) { s.getTracks().forEach((t) => t.stop()); return; }
          setLocalStream(s);
          if (localVideoRef.current) localVideoRef.current.srcObject = s;
        }

        s.getAudioTracks().forEach((t) => (t.enabled = micOn));
        s.getVideoTracks().forEach((t) => (t.enabled = videoOn));
      } catch (err) {
        console.error("Local media error:", err);
        alert("Please allow camera & mic and ensure a real webcam is connected.");
        return;
      }

      // socket listeners
      socket.on("update-participants", (participants) => {
        const others = participants.filter((p) => p.id !== socket.id);
        setRemotePeers(others);
      });

      socket.on("offer", async ({ sdp, caller }) => {
        await handleReceiveOffer(caller, sdp);
      });

      socket.on("answer", async ({ sdp, callee }) => {
        await handleReceiveAnswer(callee, sdp);
      });

      socket.on("ice-candidate", async ({ candidate, from }) => {
        const pc = pcsRef.current[from];
        if (pc && candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.warn(e); }
        }
      });

      socket.on("user-left", (id) => {
        const pc = pcsRef.current[id];
        if (pc) { try { pc.close(); } catch {} delete pcsRef.current[id]; }
        delete remoteStreamsRef.current[id];
        setRemotePeers((prev) => prev.filter((p) => p.id !== id));
      });

      socket.on("subtitle", ({ userName: u, text }) => {
        if (!text || !text.trim()) return;
        setCaptions((prev) => [...prev.slice(-CAPTIONS_LIMIT + 1), { userName: u, text }]);
      });

      socket.emit("join-room", { roomId, userName });
    }

    init();

    return () => {
      mounted = false;
      socket.off("update-participants");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-left");
      socket.off("subtitle");
      Object.values(pcsRef.current).forEach((pc) => { try { pc.close(); } catch {} });
      pcsRef.current = {};
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const createPeerAndOffer = async (targetId) => {
    if (!localStream) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const inbound = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => inbound.addTrack(t));
      remoteStreamsRef.current[targetId] = inbound;
      setRemotePeers((prev) => (!prev.find((p) => p.id === targetId) ? [...prev, { id: targetId, name: "Participant" }] : prev));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("ice-candidate", { target: targetId, candidate: event.candidate, from: socket.id });
    };

    pcsRef.current[targetId] = pc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { target: targetId, sdp: offer, caller: socket.id });
  };

  const handleReceiveOffer = async (callerId, sdp) => {
    if (pcsRef.current[callerId]) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    if (localStream) localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    const inbound = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => inbound.addTrack(t));
      remoteStreamsRef.current[callerId] = inbound;
      setRemotePeers((prev) => (!prev.find((p) => p.id === callerId) ? [...prev, { id: callerId, name: "Participant" }] : prev));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("ice-candidate", { target: callerId, candidate: event.candidate, from: socket.id });
    };

    pcsRef.current[callerId] = pc;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { target: callerId, sdp: answer, callee: socket.id });
    } catch (err) {
      console.error("handleReceiveOffer error:", err);
    }
  };

  const handleReceiveAnswer = async (calleeId, sdp) => {
    const pc = pcsRef.current[calleeId];
    if (!pc) return;
    try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); } catch (e) { console.warn(e); }
  };

  useEffect(() => {
    const toConnect = remotePeers.map((p) => p.id).filter((id) => id !== socket.id && !pcsRef.current[id]);
    toConnect.forEach((id) => createPeerAndOffer(id).catch((e) => console.error(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remotePeers, localStream]);

  const toggleMic = () => {
    if (!localStream) return;
    const t = localStream.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); }
  };
  const toggleVideo = () => {
    if (!localStream) return;
    const t = localStream.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setVideoOn(t.enabled); }
  };

  const startScreenShare = async () => {
    if (screenSharing) { stopScreenShare(); return; }
    if (!navigator.mediaDevices.getDisplayMedia) return alert("Screen share not supported.");
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = s;
      const screenTrack = s.getVideoTracks()[0];
      if (localVideoRef.current) localVideoRef.current.srcObject = s;
      Object.values(pcsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((sdr) => sdr.track && sdr.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack).catch((e) => console.warn(e));
      });
      setScreenSharing(true);
      screenTrack.onended = () => stopScreenShare();
    } catch (e) {
      console.error("startScreenShare error", e);
    }
  };

  const stopScreenShare = () => {
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
    const originalTrack = localStream?.getVideoTracks()[0];
    if (originalTrack) {
      Object.values(pcsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((sdr) => sdr.track && sdr.track.kind === "video");
        if (sender) sender.replaceTrack(originalTrack).catch((e) => console.warn(e));
      });
    }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach((t) => t.stop()); screenStreamRef.current = null; }
    setScreenSharing(false);
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { console.warn("SpeechRecognition not supported"); return; }
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) transcript += event.results[i][0].transcript;
      socket.emit("subtitle", { roomId, text: transcript, userName });
      setCaptions((prev) => [...prev.slice(-CAPTIONS_LIMIT + 1), { userName, text: transcript }]);
    };

    recog.onerror = (e) => console.warn("SpeechRecognition error", e);
    try { recog.start(); } catch (e) {}
    return () => { try { recog.stop(); } catch (e) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName]);

  const leaveRoom = () => {
    socket.emit("leave-room", { roomId });
    Object.values(pcsRef.current).forEach((pc) => { try { pc.close(); } catch {} });
    pcsRef.current = {};
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
    navigate("/");
  };

  const getRemoteStream = (id) => remoteStreamsRef.current[id] || null;

  return (
    <div className="room-container white-bg meeting-container">
      <div className="room-header" style={{ width: "100%", padding: "8px 16px", boxSizing: "border-box" }}>
        <div><strong>Room:</strong> {roomId}</div>
        <div>Participants: {remotePeers.length + 1}</div>
      </div>

      <div className="video-grid" style={{ width: "100%", flex: "1 1 auto" }}>
        <div className="video-tile">
          <video ref={localVideoRef} autoPlay playsInline muted className="video-element" />
          <div className="name-tag">{userName} (You){screenSharing ? " • presenting" : ""}</div>
        </div>

        {remotePeers.map((p) => {
          const stream = getRemoteStream(p.id);
          return <RemoteVideoTile key={p.id} id={p.id} name={p.name} stream={stream} />;
        })}
      </div>

      <div className="captions-wrapper">
        {captions.slice(-3).map((c, i) => (
          <div className="caption-line" key={i}><strong>{c.userName}:</strong> {c.text}</div>
        ))}
      </div>

      <div className="controls-bar">
        <button onClick={toggleMic} className="control-btn">
         {micOn ? <Mic size={20}/> : <MicOff size={20} color="red"/>}
         </button>
        <button onClick={toggleVideo} className="control-btn">
         {videoOn ? <Video size={20}/> : <VideoOff size={20} color="red"/>}
         </button>
        <button className={`control-btn ${screenSharing ? "active" : ""}`} onClick={startScreenShare}>{screenSharing ? "Stop Share" : "Share Screen"}</button>
        <button className="control-btn end" onClick={leaveRoom}>Leave</button>
      </div>
    </div>
  );
}

function RemoteVideoTile({ id, name, stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="video-tile">
      <video ref={ref} autoPlay playsInline className="video-element" />
      <div className="name-tag">{name}</div>
    </div>
  );
}
