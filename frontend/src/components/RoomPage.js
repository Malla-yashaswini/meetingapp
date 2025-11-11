import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp } from "lucide-react";
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
  const [participants, setParticipants] = useState([]);
  const [screenSharing, setScreenSharing] = useState(false);
  const [sharedScreenStream, setSharedScreenStream] = useState(null);
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
            const s2 = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: cams[0].deviceId }, width: 1280, height: 720 },
              audio: true,
            });
            if (!mounted) {
              s2.getTracks().forEach((t) => t.stop());
              return;
            }
            setLocalStream(s2);
            if (localVideoRef.current) localVideoRef.current.srcObject = s2;
          } else {
            console.warn("No non-virtual camera found; using current camera");
            setLocalStream(s);
            if (localVideoRef.current) localVideoRef.current.srcObject = s;
          }
        } else {
          if (!mounted) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
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
      socket.on("update-participants", (participantsList) => {
        setParticipants(participantsList);
        const others = participantsList.filter((p) => p.id !== socket.id);
        setRemotePeers(others);
      });

      socket.on("offer", async ({ sdp, caller }) => await handleReceiveOffer(caller, sdp));
      socket.on("answer", async ({ sdp, callee }) => await handleReceiveAnswer(callee, sdp));
      socket.on("ice-candidate", async ({ candidate, from }) => {
        const pc = pcsRef.current[from];
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn(e);
          }
        }
      });

      socket.on("user-left", (id) => {
        const pc = pcsRef.current[id];
        if (pc) {
          try {
            pc.close();
          } catch {}
          delete pcsRef.current[id];
        }
        delete remoteStreamsRef.current[id];
        setRemotePeers((prev) => prev.filter((p) => p.id !== id));
      });

      socket.on("subtitle", ({ userName: u, text }) => {
        if (!text || !text.trim()) return;
        setCaptions((prev) => [...prev.slice(-CAPTIONS_LIMIT + 1), { userName: u, text }]);
      });

      // Screen share stream from another user
      socket.on("screen-share", ({ from, active }) => {
        if (!active) setSharedScreenStream(null);
      });

      socket.emit("join-room", { roomId, userName });
    }

    init();

    return () => {
      mounted = false;
      socket.off();
      Object.values(pcsRef.current).forEach((pc) => {
        try {
          pc.close();
        } catch {}
      });
      pcsRef.current = {};
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [roomId]);

  // Create Peer Connection + Offer
  const createPeerAndOffer = async (targetId) => {
    if (!localStream) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const inbound = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => inbound.addTrack(t));
      remoteStreamsRef.current[targetId] = inbound;
      setRemotePeers((prev) =>
        !prev.find((p) => p.id === targetId) ? [...prev, { id: targetId, name: "Participant" }] : prev
      );
    };

    pc.onicecandidate = (event) => {
      if (event.candidate)
        socket.emit("ice-candidate", { target: targetId, candidate: event.candidate, from: socket.id });
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
      setRemotePeers((prev) =>
        !prev.find((p) => p.id === callerId) ? [...prev, { id: callerId, name: "Participant" }] : prev
      );
    };

    pc.onicecandidate = (event) => {
      if (event.candidate)
        socket.emit("ice-candidate", { target: callerId, candidate: event.candidate, from: socket.id });
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
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    const toConnect = remotePeers.map((p) => p.id).filter((id) => id !== socket.id && !pcsRef.current[id]);
    toConnect.forEach((id) => createPeerAndOffer(id).catch((e) => console.error(e)));
  }, [remotePeers, localStream]);

  const toggleMic = () => {
    if (!localStream) return;
    const t = localStream.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setMicOn(t.enabled);
    }
  };
  const toggleVideo = () => {
    if (!localStream) return;
    const t = localStream.getVideoTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setVideoOn(t.enabled);
    }
  };

  const startScreenShare = async () => {
    if (screenSharing) return stopScreenShare();
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = s;
      setSharedScreenStream(s);
      socket.emit("screen-share", { roomId, from: socket.id, active: true });

      s.getVideoTracks()[0].onended = stopScreenShare;
      setScreenSharing(true);
    } catch (e) {
      console.error("startScreenShare error", e);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenSharing(false);
    setSharedScreenStream(null);
    socket.emit("screen-share", { roomId, from: socket.id, active: false });
  };

  const leaveRoom = () => {
    socket.emit("leave-room", { roomId });
    Object.values(pcsRef.current).forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    pcsRef.current = {};
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
    navigate("/");
  };

  const getRemoteStream = (id) => remoteStreamsRef.current[id] || null;

  // RESPONSIVE GRID STYLE
  const gridCols = Math.min(remotePeers.length + 1, 4);

  return (
    <div className="room-container meeting-container">
      <div className="room-header">
        <div><strong>Room:</strong> {roomId}</div>
        <div><strong>Participants:</strong> {participants.length}</div>
        <div className="participants-list">
          {participants.map((p) => (
            <span key={p.id} className="participant-name">
              {p.name || "Participant"}
            </span>
          ))}
        </div>
      </div>

      <div
        className="video-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gap: "10px",
          width: "100%",
          maxHeight: "70vh",
          overflow: "hidden",
        }}
      >
        <div className="video-tile">
          <video ref={localVideoRef} autoPlay playsInline muted className="video-element" />
          <div className="name-tag">{userName} (You)</div>
        </div>

        {remotePeers.map((p) => {
          const stream = getRemoteStream(p.id);
          return <RemoteVideoTile key={p.id} id={p.id} name={p.name} stream={stream} />;
        })}
      </div>

      {sharedScreenStream && (
        <div className="shared-screen-tile">
          <video
            autoPlay
            playsInline
            ref={(ref) => ref && (ref.srcObject = sharedScreenStream)}
            className="shared-screen-video"
          />
          <div className="name-tag">Screen Sharing</div>
        </div>
      )}

      <div className="captions-wrapper">
        {captions.slice(-3).map((c, i) => (
          <div className="caption-line" key={i}>
            <strong>{c.userName}:</strong> {c.text}
          </div>
        ))}
      </div>

      <div className="controls-bar">
        <button onClick={toggleMic} className="control-btn">
          {micOn ? <Mic size={20} /> : <MicOff size={20} color="red" />}
        </button>
        <button onClick={toggleVideo} className="control-btn">
          {videoOn ? <Video size={20} /> : <VideoOff size={20} color="red" />}
        </button>
        <button className={`control-btn ${screenSharing ? "active" : ""}`} onClick={startScreenShare}>
          <MonitorUp size={20} />
        </button>
        <button className="control-btn end" onClick={leaveRoom}>
          Leave
        </button>
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
