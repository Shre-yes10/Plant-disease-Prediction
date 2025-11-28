import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Home from "./Home";
import "./App.css";

const Root = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/upload" element={<App />} />
      {/* Optionally redirect unknown routes to home */}
      <Route path="*" element={<Home />} />
    </Routes>
  </BrowserRouter>
);

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<Root />);
