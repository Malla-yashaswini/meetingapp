import React from "react";
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/">Meet App</Link>
    </nav>
  );
}

export default Navbar;
