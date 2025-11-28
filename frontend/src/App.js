import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// hero image import (change path if you store image elsewhere)
import cropImg from "./assets/crop-ai.png";

/* ---------- LOADER SVG ---------- */
const Loader = () => (
  <svg className="loader-spinner" viewBox="0 0 50 50" aria-hidden>
    <circle
      className="path"
      cx="25"
      cy="25"
      r="20"
      fill="none"
      strokeWidth="5"
    />
  </svg>
);

/* ---------- Remedies lookup (editable) ---------- */
const REMEDIES = {
  "early blight": [
    "Remove infected leaves and debris",
    "Use copper-based fungicide",
    "Avoid overhead watering",
  ],
  "late blight": [
    "Use systemic fungicide",
    "Remove heavily infected plants immediately",
  ],
  healthy: ["Plant appears healthy — monitor regularly"],
  // add more rules as needed
};

const getRemediesFor = (diseaseName) => {
  if (!diseaseName) return ["No recommendation available."];
  const lower = diseaseName.toLowerCase();
  // exact match or substring match
  for (const key of Object.keys(REMEDIES)) {
    if (lower.includes(key)) return REMEDIES[key];
  }
  return ["Inspect severity and consult local agronomist."];
};

/* ---------- HERO (same as before) ---------- */
const Hero = ({ onStartClick }) => (
  <section className="hero">
    <div className="hero-inner">
      <div className="hero-left">
        <div className="mini-tag">AGRIPREDAI</div>

        <h2 className="hero-title">
          <span>Crop</span>
          <span>Disease</span>
          {/* <span>
            &amp; <em className="hero-highlight">Detection</em>
          </span> */}
          <span>Detection</span>
          <span className="hero-ai">AI</span>
        </h2>

        {/* <p className="hero-sub">
          Detect plant problems with AI and protect your crops.
        </p> */}
        <p className="hero-sub">
          Use AI to find plant diseases and improve your yield
        </p>

        <div className="hero-cta">
          <button className="btn btn-primary" onClick={onStartClick}>
            Start Detection
          </button>
        </div>
      </div>

      <div className="hero-right">
        <div className="hero-graphic">
          <div className="graphic-inner">
            <img src={cropImg} alt="AI Crop Analysis" className="hero-image" />
          </div>
          <div className="graphic-tag">AI Vision</div>
        </div>
      </div>
    </div>
  </section>
);

/* ---------- App ---------- */
function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  // previewUrl is object URL for immediate display
  const [previewUrl, setPreviewUrl] = useState(null);
  // previewDataUrl is base64 DataURL used for saving in localStorage history
  const [previewDataUrl, setPreviewDataUrl] = useState(null);

  const [data, setData] = useState(null); // API response
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [history, setHistory] = useState(() => {
    try {
      const raw = localStorage.getItem("pred_history_v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const API_URL =
    process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/predict";

  useEffect(() => {
    // cleanup object URL when component unmounts or preview changes
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // helper to create data URL from File for history saving
  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });

  const onFileChange = async (e) => {
    setError(null);
    setData(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setPreviewDataUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      setSelectedFile(null);
      setPreviewUrl(null);
      setPreviewDataUrl(null);
      return;
    }
    setSelectedFile(file);
    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);

    // produce base64 data url for saving to localStorage
    try {
      const durl = await fileToDataUrl(file);
      setPreviewDataUrl(durl);
    } catch (err) {
      setPreviewDataUrl(null);
    }
  };

  // Save to localStorage (max 5 entries)
  const saveToHistory = (entry) => {
    try {
      const next = [entry, ...history].slice(0, 5);
      setHistory(next);
      localStorage.setItem("pred_history_v1", JSON.stringify(next));
    } catch (err) {
      // ignore
    }
  };

  const sendFile = async () => {
    if (!selectedFile) {
      setError("No file selected.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await axios.post(API_URL, formData, { timeout: 120000 });

      if (res.status === 200) {
        setData(res.data);

        // store result to history
        const rawClass = (
          res.data.class ??
          res.data.predicted_class ??
          ""
        ).toString();
        const conf =
          typeof res.data.confidence === "number"
            ? res.data.confidence
            : Number(res.data.confidence || 0);
        const parts = rawClass.split("___");
        const cropName = parts[0] ? parts[0].replace(/_/g, " ") : "Unknown";
        const diseaseRaw =
          parts.length > 1 ? parts[1].replace(/_/g, " ") : rawClass;

        saveToHistory({
          id: Date.now(),
          timestamp: new Date().toISOString(),
          crop: cropName,
          disease: diseaseRaw,
          confidence: conf,
          image: previewDataUrl || null,
          raw: res.data,
        });
      } else {
        setError(`Unexpected server response: ${res.status}`);
      }
    } catch (err) {
      if (err.response)
        setError(
          `Server error: ${err.response.status} ${
            err.response.data?.detail || ""
          }`
        );
      else if (err.request)
        setError("No response from server. Check backend and CORS.");
      else setError("Request error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onClear = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setPreviewDataUrl(null);
    setData(null);
    setError(null);
  };

  const getClassRaw = (d) => (d ? d.class ?? d.predicted_class ?? "" : "");
  const getConfidence = (d) => {
    if (!d) return null;
    return typeof d.confidence === "number"
      ? d.confidence
      : Number(d.confidence || 0);
  };

  const renderResult = (rawClass, confidence, imageUrl) => {
    if (!rawClass) return null;

    const parts = rawClass.split("___");
    const cropName = parts[0] ? parts[0].replace(/_/g, " ") : "Unknown Crop";
    const diseaseRaw =
      parts.length > 1
        ? parts[1].replace(/_/g, " ")
        : rawClass.replace(/___/g, " - ");
    const isHealthy = diseaseRaw.toLowerCase().includes("healthy");
    const confidencePct =
      typeof confidence === "number" && !isNaN(confidence)
        ? (confidence * 100).toFixed(2)
        : null;
    const remedies = getRemediesFor(diseaseRaw);

    return (
      <div className="resultSummary">
        <div
          className={`finalResultLine ${
            isHealthy ? "resultHealthy" : "resultDisease"
          }`}
        >
          <span className="resultIcon">{isHealthy ? "✓" : "!"}</span>
          <span className="resultText">
            {cropName} - {isHealthy ? "Healthy" : diseaseRaw}
          </span>
        </div>

        <div className="confidenceBox">
          <div className="confidenceLabel">Confidence</div>
          <div className="confidenceValue">
            {confidencePct !== null ? `${confidencePct}%` : "—"}
          </div>
        </div>

        {/* Confidence bar */}
        <div className="confidenceBarWrap">
          <div className="confidenceBarOuter">
            <div
              className="confidenceBarInner"
              style={{
                width: confidencePct
                  ? `${Math.min(100, Number(confidencePct))}%`
                  : "0%",
              }}
            />
          </div>
          <div className="confidenceSmall">
            {confidencePct !== null ? `${confidencePct}%` : "—"}
          </div>
        </div>

        {/* Remedies */}
        <div className="remedies">
          <h4>Recommended Actions</h4>
          <ul>
            {remedies.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* Download button */}
        <div className="resultActions">
          <button
            className="btn btn-outline"
            onClick={() =>
              downloadResultPDF({
                cropName,
                diseaseRaw,
                confidencePct,
                imageUrl,
                remedies,
              })
            }
          >
            Download Result (PDF)
          </button>
        </div>
      </div>
    );
  };

  // Opens a printable window with the result info — user can Save as PDF from print dialog
  const downloadResultPDF = ({
    cropName,
    diseaseRaw,
    confidencePct,
    imageUrl,
    remedies,
  }) => {
    const html = `
      <html>
        <head>
          <title>Prediction Result</title>
          <style>
            body { font-family: Arial, sans-serif; padding:20px; color:#111; }
            h1 { font-size:22px; margin-bottom:6px; }
            .meta { margin-bottom:10px; }
            .row { display:flex; gap:12px; align-items:flex-start; }
            .img { width:180px; height:180px; object-fit:cover; border:1px solid #ddd; }
            .box { padding:10px; border:1px solid #ddd; border-radius:6px; background:#fafafa; }
            ul { margin-top:6px; }
            .small { color:#666; font-size:12px; margin-top:10px; }
          </style>
        </head>
        <body>
          <h1>Prediction Result</h1>
          <div class="meta">Date: ${new Date().toLocaleString()}</div>
          <div class="row">
            <div>
              ${
                imageUrl
                  ? `<img src="${imageUrl}" class="img" />`
                  : `<div class="img" style="display:grid;place-items:center;color:#999">No Image</div>`
              }
            </div>
            <div style="flex:1">
              <div class="box"><strong>Crop:</strong> ${cropName}</div>
              <div style="height:8px"></div>
              <div class="box"><strong>Disease:</strong> ${diseaseRaw}</div>
              <div style="height:8px"></div>
              <div class="box"><strong>Confidence:</strong> ${
                confidencePct ?? "—"
              }</div>
              <div style="height:8px"></div>
              <div class="box"><strong>Recommended actions:</strong>
                <ul>
                  ${remedies.map((r) => `<li>${r}</li>`).join("")}
                </ul>
              </div>
            </div>
          </div>

          <div class="small">Generated by AgriPredAI</div>
        </body>
      </html>
    `;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      alert("Popup blocked. Please allow popups to download the PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
    // small delay then call print
    setTimeout(() => {
      w.focus();
      w.print();
    }, 400);
  };

  // Load a history item into the UI
  const loadHistoryItem = (item) => {
    if (!item) return;
    // set data from the stored raw response if available, otherwise build
    if (item.raw) setData(item.raw);
    else {
      setData({
        class: `${item.crop}___${item.disease}`,
        confidence: item.confidence,
      });
    }
    setPreviewUrl(item.image || null);
    setPreviewDataUrl(item.image || null);
    setSelectedFile(null);
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  const clearHistory = () => {
    localStorage.removeItem("pred_history_v1");
    setHistory([]);
  };

  // handle Start Detection click scroll to upload and focus
  const handleStartClick = () => {
    const uploadLabel = document.querySelector(".uploadAreaLabel");
    if (uploadLabel) {
      uploadLabel.scrollIntoView({ behavior: "smooth", block: "center" });
      uploadLabel.querySelector('input[type="file"]')?.focus();
    }
  };

  const rawClass = getClassRaw(data);
  const confidence = getConfidence(data);

  return (
    <div className="root">
      {/* navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-title">AgriPredAI</div>
          <div className="navbar-links">
            <a href="#predict" className="nav-link nav-active">
              Predict
            </a>
          </div>
        </div>
      </nav>

      <main className="page">
        <Hero onStartClick={handleStartClick} />

        <section className="upload-section" id="predict">
          <h1 className="upload-title">AI Crop Disease Classifier</h1>
          <p className="upload-subtitle">
            Detect plant problems with AI and protect your crops.
          </p>

          <div className="card two-column">
            {/* LEFT: upload / preview */}
            <div className="left-col">
              <label className="uploadAreaLabel">
                {previewUrl ? (
                  <div className="previewWrap">
                    <img
                      src={previewUrl}
                      alt="Leaf preview"
                      className="preview"
                    />
                  </div>
                ) : (
                  <div className="uploadPlaceholder">
                    <svg
                      className="uploadIcon"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path
                        d="M16 17L12 13L8 17"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 13V21"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M20 18C20 19.6569 18.6569 21 17 21H7C5.34315 21 4 19.6569 4 18C4 16.3431 5.34315 15 7 15H8.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 3V13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="uploadText">Click to select image</div>
                    <div className="uploadSubtitle">
                      (JPG, PNG, up to 2MB). You can also use History below.
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="fileInput"
                />
              </label>

              <div className="controls">
                <button
                  onClick={sendFile}
                  disabled={isLoading || !selectedFile || data}
                  className={`button predictButton ${
                    isLoading || !selectedFile || data ? "buttonDisabled" : ""
                  }`}
                >
                  {isLoading && <Loader />}
                  {isLoading ? "Analyzing Leaf..." : "Classify Disease"}
                </button>

                <button
                  onClick={onClear}
                  className="clearButton"
                  disabled={!selectedFile && !data}
                >
                  Clear
                </button>
              </div>

              {error && <div className="error">{error}</div>}
            </div>

            {/* RIGHT: result summary */}
            <div className="right-col">
              <h3 className="resultHeading">Prediction Details</h3>

              {rawClass ? (
                renderResult(rawClass, confidence, previewDataUrl)
              ) : (
                <div className="placeholderResult">
                  No prediction yet. Upload an image and click "Classify
                  Disease".
                </div>
              )}

              {/* Raw response toggle - developer debugging (hidden by default) */}
              {/* Remove or leave commented for final submission */}
              {/* {data && <pre className="pre">{JSON.stringify(data, null, 2)}</pre>} */}
            </div>
          </div>

          {/* History */}
          <div className="historyWrap">
            <div className="historyHeader">
              <h4>History</h4>
              <div className="historyActions">
                <button className="btn-small" onClick={clearHistory}>
                  Clear History
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="historyEmpty">No previous predictions yet.</div>
            ) : (
              <div className="historyList">
                {history.map((item) => (
                  <button
                    key={item.id}
                    className="historyItem"
                    onClick={() => loadHistoryItem(item)}
                  >
                    <div className="histThumb">
                      {item.image ? (
                        <img src={item.image} alt="" />
                      ) : (
                        <div className="noThumb">No image</div>
                      )}
                    </div>
                    <div className="histMeta">
                      <div className="histTitle">
                        {item.crop} — {item.disease}
                      </div>
                      <div className="histConf">
                        {(item.confidence * 100).toFixed(2)}%
                      </div>
                      <div className="histTime">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="footer">
          <small>
            Model Endpoint: {API_URL} • Built for project submission
          </small>
        </footer>
      </main>

      {/* Loading overlay */}
      {isLoading && (
        <div className="loadingOverlay" aria-hidden>
          <div className="loadingCard">
            <Loader />
            <div className="loadingText">Analyzing leaf with AI...</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
