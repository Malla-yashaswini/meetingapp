import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

export default function HomePage() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const createRoom = () => {
    const id = uuidv4().slice(0, 8);
    navigate(`/preview/${id}`);
  };

  const joinRoom = () => {
    if (!roomId.trim()) return alert("Enter a Room ID");
    navigate(`/preview/${roomId.trim()}`);
  };

  return (
    <div className="page-center white-bg">
      <div className="card">
        <h1 className="title">MeetChat</h1>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
          <button className="btn primary" onClick={createRoom}>Create Room</button>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input" placeholder="Enter Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
            <button className="btn" onClick={joinRoom}>Join</button>
          </div>
        </div>

        <p className="muted">Create a room and share the preview link with friends.</p>
      </div>
    </div>
  );
}
