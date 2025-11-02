import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Homepage from './pages/Homepage';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
        {/* <>
          <h3>🎥 Test Video Upload & Processing (using fetch)</h3>

          <input
            type="file"
            accept="video/*"
            id="videoInput"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              window.selectedVideo = file; // store globally for the button to use
              console.log("🎬 Selected file:", file.name);
            }}
          />

          <br />
          <button
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: "#007bff",
              color: "white",
              cursor: "pointer",
            }}
            onClick={async () => {
              const file = window.selectedVideo;
              if (!file) {
                alert("Please select a video first!");
                return;
              }

              const formData = new FormData();
              formData.append("video", file);
              formData.append("cameraId", "testCamera");

              try {
                console.log("⏳ Uploading & processing...");
                const res = await fetch("http://localhost:8000/api/upload-video", {
                  method: "POST",
                  body: formData,
                });

                if (!res.ok) {
                  const errText = await res.text();
                  throw new Error(errText || "Upload failed");
                }

                const data = await res.json();
                console.log("✅ Original video URL:", data.originalVideoUrl);
                console.log("✅ Processed video URL:", data.processedVideoUrl);

                // Set both videos in UI
                const uploadedEl = document.getElementById("uploadedVideo");
                const processedEl = document.getElementById("processedVideo");

                if (uploadedEl && data.originalVideoUrl) {
                  uploadedEl.src = data.originalVideoUrl;
                  uploadedEl.load();
                }

                // if (processedEl && data.processedVideoUrl) {
                //   processedEl.src = data.processedVideoUrl;
                //   processedEl.load();
                //   processedEl.play();
                // }
                if (processedEl && data.processedVideoUrl) {
                  processedEl.src = data.processedVideoUrl;
                  processedEl.load();

                  processedEl.oncanplay = () => {
                    processedEl.play().catch(err => {
                      console.log("Autoplay blocked:", err);
                    });
                  };
                }

              } catch (err) {
                console.error("Upload or processing failed:", err);
                alert("Failed: " + err.message);
              }
            }}
          >
            🚀 Upload & Process Video
          </button>

          <div style={{ marginTop: 30 }}>
            <h4>📤 Uploaded Video</h4>
            <video
              id="uploadedVideo"
              controls
              style={{ width: "80%", borderRadius: 8, marginBottom: 20 }}
            />

            <h4>🧠 Processed Video</h4>
            <video
              id="processedVideo"
              controls
              autoPlay
              muted
              style={{ width: "80%", borderRadius: 8 }}
            />
          </div>
        </> */}




      </div>
    </Router>
  );
}

export default App;