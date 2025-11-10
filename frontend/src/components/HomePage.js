// src/pages/HomePage.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

export default function HomePage() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const createRoom = () => {
    const newRoom = Math.random().toString(36).substring(2, 9);
    navigate(`/preview/${newRoom}`);
  };

  const joinRoom = () => {
    if (!roomId.trim()) return alert("Enter Room ID");
    navigate(`/preview/${roomId.trim()}`);
  };

  return (
    <div className="page-center white-bg">
      <div className="card">
        <h1 className="title">MeetChat</h1>

        <div className="row">
          <button className="btn primary" onClick={createRoom}>Create Room</button>

          <div className="join-inline">
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter Room ID"
              className="input"
            />
            <button className="btn" onClick={joinRoom}>Join</button>
          </div>
        </div>

        <p className="muted">Create a room and share the preview link with friends.</p>
      </div>
    </div>
  );
}
