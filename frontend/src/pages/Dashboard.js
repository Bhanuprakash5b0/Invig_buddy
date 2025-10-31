import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [processedUrls, setProcessedUrls] = useState({}); // keyed by camera id
  const [uploadedFiles, setUploadedFiles] = useState({}); // keyed by camera id
  const [streaming, setStreaming] = useState({}); // keyed by camera id
  const webcamRef = useRef(null); // hidden element for capturing webcam
  const captureCanvasRef = useRef(document.createElement('canvas'));
  const webcamIntervalRef = useRef(null);
  const webcamBusyRef = useRef(false);
  const [camerasState, setCamerasState] = useState({
    // keep RTSP editable per-camera in local state
    3: { rtspUrl: 'rtsp://your-camera-ip:554/stream' }
  });

  const navigate = useNavigate();

  // Mock data for demonstration
  const dashboardData = {
    overview: {
      totalCameras: 3,
      activeCameras: 2,
      alertsToday: 3,
      examsToday: 5
    },
    cameras: [
      { id: 1, name: 'Testing Sample Camera', type: 'testing' },
      { id: 2, name: 'Web Camera', type: 'webcam' },
      { id: 3, name: 'CC Camera', type: 'cc' }
    ],
    alerts: [
      { id: 1, camera: 'Testing Sample Camera', type: 'suspicious_movement', severity: 'high', timestamp: '10:30 AM', status: 'new' },
      { id: 2, camera: 'Web Camera', type: 'multiple_faces', severity: 'medium', timestamp: '10:15 AM', status: 'reviewed' },
      { id: 3, camera: 'CC Camera', type: 'phone_detected', severity: 'high', timestamp: '09:45 AM', status: 'new' }
    ],
    exams: [
      { id: 1, name: 'Final Exams - CS101', hall: 'Hall A', time: '9:00 AM - 12:00 PM', status: 'ongoing' },
      { id: 2, name: 'Midterm - MATH202', hall: 'Hall B', time: '10:00 AM - 1:00 PM', status: 'upcoming' },
      { id: 3, name: 'Quiz - PHYS101', hall: 'Hall C', time: '2:00 PM - 3:00 PM', status: 'upcoming' }
    ]
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      navigate('/login');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#ff4757';
      case 'medium': return '#ffa502';
      case 'low': return '#2ed573';
      default: return '#a4b0be';
    }
  };

  const getAlertTypeText = (type) => {
    switch (type) {
      case 'suspicious_movement': return 'Suspicious Movement';
      case 'multiple_faces': return 'Multiple Faces Detected';
      case 'phone_detected': return 'Mobile Phone Detected';
      case 'object_passing': return 'Object Passing';
      default: return type;
    }
  };

  const getCameraTypeIcon = (type) => {
    switch (type) {
      case 'testing': return '🧪';
      case 'webcam': return '🌐';
      case 'cc': return '📹';
      default: return '📷';
    }
  };

  // ---------- Testing sample: upload + separate "Start Processing" ----------
  const handleFileSelect = (cameraId, event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadedFiles(prev => ({ ...prev, [cameraId]: file }));
    // clear old processed result for this camera
    setProcessedUrls(prev => ({ ...prev, [cameraId]: null }));
  };

  const startProcessingTest = async (cameraId) => {
    //e.preventDefault();
    const file = uploadedFiles[cameraId];
    if (!file) {
      alert('Please upload a video first.');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('cameraId', cameraId);

    try {
      // ensure correct backend port
      const res = await fetch('http://localhost:5000/api/process-video', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Processing failed');
      }

      const data = await res.json();
      console.log('Processing result', data);
      if (data && data.processedVideoUrl) {
        // add cache-buster to avoid stale caching between uploads
        const processedUrl = data.processedVideoUrl;
        const buster = `${processedUrl}${processedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
        // force React to re-render video element by using the URL as key
        setProcessedUrls(prev => ({ ...prev, [cameraId]: buster }));
      } else {
        throw new Error('No processedVideoUrl returned');
      }
    } catch (err) {
      console.error('Error processing test video', err);
      alert('Processing failed: ' + err.message);
    }
  };

  // Webcam: capture frames and send to backend for annotation; display MJPEG frames
  const startWebcamRecording = async (cameraId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream; // hidden capture element
        await webcamRef.current.play().catch(() => {});
      }

      setProcessedUrls(prev => ({ ...prev, [cameraId]: null }));
      setStreaming(prev => ({ ...prev, [cameraId]: true }));

      // Start capture loop
      if (webcamIntervalRef.current) clearInterval(webcamIntervalRef.current);
      webcamIntervalRef.current = setInterval(async () => {
        if (!webcamRef.current || webcamBusyRef.current) return;
        const videoEl = webcamRef.current;
        const canvas = captureCanvasRef.current;
        const w = videoEl.videoWidth || 640;
        const h = videoEl.videoHeight || 360;
        if (w === 0 || h === 0) return;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoEl, 0, 0, w, h);
        webcamBusyRef.current = true;
        canvas.toBlob(async (blob) => {
          try {
            if (!blob) return;
            const form = new FormData();
            form.append('frame', blob, 'frame.jpg');
            const res = await fetch('http://localhost:5000/api/process-frame', {
              method: 'POST',
              body: form
            });
            if (!res.ok) throw new Error('frame process failed');
            const annotatedBlob = await res.blob();
            const url = URL.createObjectURL(annotatedBlob);
            setProcessedUrls(prev => ({ ...prev, [cameraId]: url }));
          } catch (e) {
            // swallow intermittent errors to keep loop alive
          } finally {
            webcamBusyRef.current = false;
          }
        }, 'image/jpeg', 0.8);
      }, 200);
    } catch (err) {
      console.error('Error accessing webcam', err);
      alert('Unable to access webcam');
    }
  };

  const stopWebcamRecording = (cameraId) => {
    if (webcamIntervalRef.current) {
      clearInterval(webcamIntervalRef.current);
      webcamIntervalRef.current = null;
    }
    if (webcamRef.current && webcamRef.current.srcObject) {
      const tracks = webcamRef.current.srcObject.getTracks();
      tracks.forEach(t => t.stop());
      webcamRef.current.srcObject = null;
    }
    setStreaming(prev => ({ ...prev, [cameraId]: false }));
  };

  // ---------- CCTV: send RTSP to backend, receive processed stream URL for this camera ----------
  const startCCTVProcessing = async (cameraId) => {
    const rtspUrl = camerasState[cameraId]?.rtspUrl;
    if (!rtspUrl) {
      alert('Enter RTSP URL first');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/process-rtsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId, rtspUrl })
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        const streamUrl = data.processedStreamUrl;
        const buster = `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
        setProcessedUrls(prev => ({ ...prev, [cameraId]: buster }));
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setProcessedUrls(prev => ({ ...prev, [cameraId]: url }));
      }

      setStreaming(prev => ({ ...prev, [cameraId]: true }));
    } catch (err) {
      console.error('Error starting CCTV processing', err);
      alert('Failed to start CCTV processing');
    }
  };

  const stopCCTVProcessing = async (cameraId) => {
    try {
      await fetch('http://localhost:5000/api/stop-rtsp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId })
      });
    } catch (e) {
      console.error('Error stopping CCTV processing', e);
    } finally {
      setStreaming(prev => ({ ...prev, [cameraId]: false }));
      // keep last processedUrls[cameraId] if any
    }
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>Invigilation Buddy</h2>
          <button
            className="toggle-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button
            className={`nav-item ${activeTab === 'cameras' ? 'active' : ''}`}
            onClick={() => setActiveTab('cameras')}
          >
            📹 Cameras
          </button>
          <button
            className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            🚨 Alerts
          </button>
          <button
            className={`nav-item ${activeTab === 'exams' ? 'active' : ''}`}
            onClick={() => setActiveTab('exams')}
          >
            📝 Exams
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <h1>Dashboard</h1>
            <p>Welcome back, Administrator</p>
          </div>
          <div className="header-right">
            <div className="notification-bell">
              🔔
              <span className="notification-count">3</span>
            </div>
            <div className="user-profile">
              <div className="avatar">A</div>
              <span>Admin User</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="dashboard-content">

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-content">
              <div className="overview-intro">
                <h2>About Invigilation Buddy</h2>
                <p>
                  Invigilation Buddy is a secure platform for automated exam monitoring and proctoring. It integrates live camera feeds to provide real-time surveillance of examination halls, ensuring that academic integrity is maintained. The system generates real-time alerts for any suspicious activities detected by the cameras, allowing administrators to respond promptly to potential incidents. Additionally, the platform includes exam scheduling tools that help administrators manage exam times, locations, and participant lists efficiently. Each component is designed to work seamlessly together, providing a comprehensive solution for monitoring and managing examinations while prioritizing reliability and user privacy.
                </p>
              </div>
            </div>
          )}

          {/* Cameras Tab */}
          {activeTab === 'cameras' && (
            <div className="tab-content">
              <div className="tab-header">
                <h2>Camera Options</h2>
              </div>

              <div className="cameras-grid">
                {/* Hidden video element used only for capturing webcam stream (not displayed) */}
                <video ref={webcamRef} style={{ display: 'none' }} autoPlay playsInline muted />

                {dashboardData.cameras.map(camera => (
                  <div key={camera.id} className="camera-card">
                    <div className="camera-header">
                      <div className="camera-title">
                        <span className="camera-icon">{getCameraTypeIcon(camera.type)}</span>
                        <h4>{camera.name}</h4>
                      </div>
                    </div>

                    <div className="camera-preview">
                      {/* Each camera shows ONLY its processed output in its region */}
                      {processedUrls[camera.id] ? (
                        camera.type === 'testing' ? (
                          <video
                            key={processedUrls[camera.id]}          // force reload when URL changes
                            src={processedUrls[camera.id]}
                            controls
                            autoPlay
                            playsInline
                            muted
                            preload="auto"
                            onCanPlay={(e) => { try { e.currentTarget.play(); } catch (_) {} }}
                            onError={(e) => { console.error('Video playback error', e); }}
                            className="video-feed"
                          />
                        ) : (
                          <img
                            key={processedUrls[camera.id]}
                            src={processedUrls[camera.id]}
                            alt="Processed stream"
                            className="video-feed"
                            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                            onError={(e) => { console.error('Stream display error', e); }}
                          />
                        )
                      ) : (
                        <div className="video-placeholder">
                          {camera.type === 'testing' ? 'Upload and start processing to see results' :
                           camera.type === 'webcam' ? 'Start detection to stream processed output here' :
                           'Start CCTV to see processed output here'}
                        </div>
                      )}
                    </div>

                    <div className="camera-actions">
                      {/* Testing camera: upload + start processing */}
                      {camera.type === 'testing' && (
                        <>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => handleFileSelect(camera.id, e)}
                            id={`video-upload-${camera.id}`}
                            hidden
                          />
                          <label htmlFor={`video-upload-${camera.id}`} className="upload-btn">
                            📤 Upload Video
                          </label>
                          <button
                            className="primary-btn"
                            onClick={(e) => {e.preventDefault(); startProcessingTest(camera.id)}}
                            style={{ marginLeft: 8 }}
                          >
                            ▶️ Start Processing
                          </button>
                        </>
                      )}

                      {/* Webcam: start/stop recording (hidden raw), processed output will appear above */}
                      {camera.type === 'webcam' && (
                        <>
                          <button
                            className={`stream-btn ${streaming[camera.id] ? 'streaming' : ''}`}
                            onClick={() => streaming[camera.id] ? stopWebcamRecording(camera.id) : startWebcamRecording(camera.id)}
                          >
                            {streaming[camera.id] ? '⏹️ Stop Detection' : '▶️ Start Detection'}
                          </button>
                        </>
                      )}

                      {/* CCTV: start/stop processing and RTSP input */}
                      {camera.type === 'cc' && (
                        <>
                          <button
                            className={`stream-btn ${streaming[camera.id] ? 'streaming' : ''}`}
                            onClick={() => streaming[camera.id] ? stopCCTVProcessing(camera.id) : startCCTVProcessing(camera.id)}
                          >
                            {streaming[camera.id] ? '⏹️ Stop CCTV' : '▶️ Start CCTV'}
                          </button>
                        </>
                      )}
                    </div>

                    {/* CCTV RTSP input area */}
                    {camera.type === 'cc' && (
                      <div className="cctv-settings">
                        <input
                          type="text"
                          placeholder="RTSP URL (e.g., rtsp://ip:554/stream)"
                          value={camerasState[camera.id]?.rtspUrl || ''}
                          onChange={(e) => setCamerasState(prev => ({ ...prev, [camera.id]: { ...(prev[camera.id] || {}), rtspUrl: e.target.value } }))}
                          className="rtsp-input"
                        />
                      </div>
                    )}

                    {/* Small output label / status */}
                    <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                      {processedUrls[camera.id] ? 'Processed output below' : 'No processed output yet'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="tab-content">
              <div className="tab-header">
                <h2>Security Alerts</h2>
                <div className="filter-options">
                  <select>
                    <option>All Severity</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                  <select>
                    <option>All Status</option>
                    <option>New</option>
                    <option>Reviewed</option>
                    <option>Resolved</option>
                  </select>
                </div>
              </div>

              <div className="alerts-table">
                <table>
                  <thead>
                    <tr>
                      <th>Alert Type</th>
                      <th>Camera</th>
                      <th>Severity</th>
                      <th>Timestamp</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.alerts.map(alert => (
                      <tr key={alert.id}>
                        <td>
                          <div className="alert-type">
                            <div className="alert-dot" style={{backgroundColor: getSeverityColor(alert.severity)}}></div>
                            {getAlertTypeText(alert.type)}
                          </div>
                        </td>
                        <td>{alert.camera}</td>
                        <td>
                          <span className={`severity-badge ${alert.severity}`}>
                            {alert.severity}
                          </span>
                        </td>
                        <td>{alert.timestamp}</td>
                        <td>
                          <span className={`status-badge ${alert.status}`}>
                            {alert.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="icon-btn" title="View Evidence">👁️</button>
                            <button className="icon-btn" title="Mark Reviewed">✅</button>
                            <button className="icon-btn" title="Delete">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Exams Tab */}
          {activeTab === 'exams' && (
            <div className="tab-content">
              <div className="tab-header">
                <h2>Exam Schedule</h2>
                <button className="primary-btn">📝 Schedule New Exam</button>
              </div>

              <div className="exams-table">
                <table>
                  <thead>
                    <tr>
                      <th>Exam Name</th>
                      <th>Hall</th>
                      <th>Time Slot</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.exams.map(exam => (
                      <tr key={exam.id}>
                        <td>{exam.name}</td>
                        <td>{exam.hall}</td>
                        <td>{exam.time}</td>
                        <td>
                          <span className={`status-badge ${exam.status}`}>
                            {exam.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="icon-btn" title="View Details">👁️</button>
                            <button className="icon-btn" title="Edit">✏️</button>
                            <button className="icon-btn" title="Monitor">📹</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Dashboard;