import React from "react";
import { useNavigate } from "react-router-dom";
import leafIcon from "./assets/leafs.png"; // add a small leaf icon at src/leaf.png
import cropImg from "./assets/crop-ai.png"; // keep your hero image path

export default function Home() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate("/upload");
  };

  return (
    <div className="root">
      {/* Shared navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={leafIcon} alt="leaf" style={{ width: 28, height: 28 }} />
            <div className="navbar-title">AgriPredAI</div>
          </div>

          <div className="navbar-links">
            <a className="nav-link nav-active" href="#predict">
              Predict
            </a>
            {/* You may add other links here */}
          </div>
        </div>
      </nav>

      {/* Hero (Home) */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-left">
            <div className="mini-tag">AGRIPREDAI</div>

            <h2 className="hero-title">
              <span>Crop</span>
              <span>Disease</span>
              <span>Detection</span>
              <span className="hero-ai">AI</span>
            </h2>

            <p className="hero-sub">
              Use AI to find plant diseases and improve your yield
            </p>

            <div className="hero-cta">
              <button className="btn btn-primary" onClick={handleStart}>
                Start Detection
              </button>
            </div>
          </div>

          <div className="hero-right">
            <div className="hero-graphic">
              <div className="graphic-inner">
                <img
                  src={cropImg}
                  alt="AI Crop Analysis"
                  className="hero-image"
                />
              </div>
              <div className="graphic-tag">AI Vision</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
