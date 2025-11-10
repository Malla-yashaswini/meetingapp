import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

export default function HomePage() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleCreate = () => {
    // generate a reasonably short id
    const id = Math.random().toString(36).substring(2, 9);
    navigate(`/preview/${id}`);
  };

  const handleJoin = () => {
    if (!roomId.trim()) return alert("Enter Room ID to join");
    navigate(`/preview/${roomId.trim()}`);
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1 className="brand">MeetChat</h1>

        <input
          className="room-input"
          placeholder="Enter Room ID to join"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />

        <div className="home-actions">
          <button className="btn primary" onClick={handleCreate}>
            Create Room
          </button>
          <button className="btn" onClick={handleJoin}>
            Join Room
          </button>
        </div>

        <p className="helper">Create → get link → others open link → land on preview page</p>
      </div>
    </div>
  );
}
