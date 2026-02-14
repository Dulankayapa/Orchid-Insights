// src\components\Navbar\Navbar.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";
import logo from "../../assets/orchid insight logo.png";
import user from "../../assets/User.png";
import bellIcon from "../../assets/notification bell.png";
import settingsIcon from "../../assets/settings.png";
import viewMoreIcon from "../../assets/view more.png";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active button based on current route
  const getActiveButton = () => {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      return 'Dashboard';
    } else if (location.pathname === '/care-guide') {
      return 'Care Guide';
    }
    return 'Dashboard';
  };

  const activeButton = getActiveButton();

  const handleButtonClick = (buttonName) => {
    if (buttonName === "Dashboard") {
      navigate('/dashboard');
    } else if (buttonName === "Care Guide") {
      navigate('/care-guide');
    }
  };

  return (
    <nav className="navbar">
      {/* LEFT: Logo only */}
      <div className="nav-left">
        <img 
          src={logo} 
          alt="Orchid Logo" 
          className="logo" 
          onClick={() => navigate('/dashboard')}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* CENTER: Navigation buttons */}
      <div className="nav-center">
        <button 
          className={`nav-btn ${activeButton === "Dashboard" ? "active" : ""}`}
          onClick={() => handleButtonClick("Dashboard")}
        >
          Dashboard
        </button>
        <button 
          className={`nav-btn ${activeButton === "Care Guide" ? "active" : ""}`}
          onClick={() => handleButtonClick("Care Guide")}
        >
          Care Guide
        </button>
      </div>

      {/* RIGHT: Icons and User Profile */}
      <div className="nav-right">
        <div className="nav-icon-container">
          <img src={bellIcon} alt="Notifications" className="nav-icon-img" />
        </div>
        <div className="nav-icon-container">
          <img src={settingsIcon} alt="Settings" className="nav-icon-img" />
        </div>
        <div className="user-profile">
          <img src={user} alt="User" className="user-img" />
          <img src={viewMoreIcon} alt="View More" className="view-more-icon" />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;