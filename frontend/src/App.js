import React, { useState, useEffect } from "react";
import axios from "axios";
import leafIcon from "./assets/leafs.png"; // same logo used in Home
import "./App.css";

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
};

const getRemediesFor = (diseaseName) => {
  if (!diseaseName) return ["No recommendation available."];
  const lower = diseaseName.toLowerCase();
  for (const key of Object.keys(REMEDIES)) {
    if (lower.includes(key)) return REMEDIES[key];
  }
  return ["Inspect severity and consult local agronomist."];
};

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [data, setData] = useState(null);
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
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

    try {
      const durl = await fileToDataUrl(file);
      setPreviewDataUrl(durl);
    } catch {
      setPreviewDataUrl(null);
    }
  };

  const saveToHistory = (entry) => {
    try {
      const next = [entry, ...history].slice(0, 5);
      setHistory(next);
      localStorage.setItem("pred_history_v1", JSON.stringify(next));
    } catch {}
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

        <div className="remedies">
          <h4>Recommended Actions</h4>
          <ul>
            {remedies.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

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

  const downloadResultPDF = ({
    cropName,
    diseaseRaw,
    confidencePct,
    imageUrl,
    remedies,
  }) => {
    const html = `...`; // trimmed here to keep file short - use your previous implementation
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      alert("Popup blocked. Please allow popups to download the PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 400);
  };

  const loadHistoryItem = (item) => {
    if (!item) return;
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

  const handleStartClick = () => {
    // scroll to upload area if present
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
      {/* navbar (same as Home) */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={leafIcon} alt="leaf" style={{ width: 28, height: 28 }} />
            <div className="navbar-title">AgriPredAI</div>
          </div>

          <div className="navbar-links">
            <a href="#predict" className="nav-link nav-active">
              Predict
            </a>
          </div>
        </div>
      </nav>

      <main className="page">
        {/* The hero used on the Home is not repeated here; navigation landed here from Home. */}
        <section className="upload-section" id="predict">
          <h1 className="upload-title">AI Crop Disease Classifier</h1>
          <p className="upload-subtitle">
            Detect plant problems with AI and protect your crops.
          </p>

          <div className="card two-column">
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
                  {isLoading && <Loader />}{" "}
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
            </div>
          </div>

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
