import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

function HomePage() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const createRoom = async () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    navigate(`/preview/${newRoomId}`);
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      navigate(`/preview/${roomId}`);
    } else {
      alert("Please enter a Room ID");
    }
  };

  return (
    <div className="homepage">
      <h1 className="title">MeetChat</h1>
      <div className="home-card">
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="room-input"
        />
        <div className="button-group">
          <button className="create-btn" onClick={createRoom}>
            Create Room
          </button>
          <button className="join-btn" onClick={joinRoom}>
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
