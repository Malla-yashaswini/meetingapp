import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import "../App.css";

export default function HomePage() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const createRoom = () => {
    const newRoomId = uuidv4();
    navigate(`/preview/${newRoomId}`);
  };

  const joinRoom = () => {
    if (!roomId.trim()) return alert("Enter Room ID");
    navigate(`/preview/${roomId}`);
  };

  return (
    <div className="home-page">
      <div className="home-card">
        <h1>Meet Chat</h1>
        <div className="actions">
          <button className="btn primary" onClick={createRoom}>
            Create Room
          </button>
          <input
            className="text-input"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button className="btn" onClick={joinRoom}>
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
