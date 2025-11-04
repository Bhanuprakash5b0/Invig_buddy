import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [processedUrls, setProcessedUrls] = useState({}); // keyed by camera id
  const [uploadedFiles, setUploadedFiles] = useState({}); // keyed by camera id
  const [streaming, setStreaming] = useState({}); // keyed by camera id
  const [webcamStream, setWebcamStream] = useState(null);
  const webcamRef = useRef(null); // hidden element for capturing webcam
  const captureCanvasRef = useRef(document.createElement('canvas'));
  const webcamIntervalRef = useRef(null);
  const webcamBusyRef = useRef(false);
  const latestFrameRef = useRef(null);
  const [camerasState, setCamerasState] = useState({
    // keep RTSP editable per-camera in local state
    3: { rtspUrl: 'rtsp://your-camera-ip:554/stream' }
  });
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceImage, setEvidenceImage] = useState(null);
  const [alerts, setAlerts] = useState([]); // Real alerts from API
  const [loadingAlerts, setLoadingAlerts] = useState(false);

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

  // Fetch alerts from API
  const fetchAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const response = await fetch('http://localhost:5000/api/alerts');
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.alerts)) {
          console.log('Fetched alerts:', data.alerts);
          setAlerts(data.alerts);
        } else {
          console.warn('Unexpected alerts payload:', data);
          setAlerts([]);
        }
      } else {
        console.error('Failed to fetch alerts');
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoadingAlerts(false);
    }
  };

  // Delete alert by ID
  const deleteAlert = async (alertId) => {
    if (!window.confirm('Are you sure you want to delete this alert?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/alerts/${alertId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Remove from local state
        setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));
        alert('Alert deleted successfully');
      } else {
        const data = await response.json();
        alert('Failed to delete alert: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      alert('Error deleting alert');
    }
  };

  // Auto-refresh alerts when on alerts tab
  useEffect(() => {
    fetchAlerts(); // Fetch on mount

    // Auto-refresh every 3 seconds when on alerts tab
    let interval;
    if (activeTab === 'alerts') {
      interval = setInterval(fetchAlerts, 3000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeTab]);

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  // Get alert type display name
  const getAlertTypeDisplay = (alertType) => {
    if (alertType === 'web') return '📹 Webcam';
    if (alertType === 'cctv') return '🎥 CCTV';
    return alertType;
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
    const file = uploadedFiles[cameraId];
    if (!file) {
      alert('Please upload a video first.');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('cameraId', cameraId);

    try {
      const res = await fetch('http://localhost:5000/api/process-video', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        let errBody = null;
        try { errBody = await res.json(); } catch (_) {
          try { errBody = await res.text(); } catch (__) { errBody = res.statusText; }
        }
        throw new Error((errBody && (errBody.error || errBody)) || 'Processing failed');
      }

      const data = await res.json();
      console.log('Processed video URL:', data);

      if (data && data.processedVideoUrl) {
        const processedUrl = data.processedVideoUrl;
        const buster = `${processedUrl}${processedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
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
      const response = await fetch('http://localhost:5000/api/start-webcam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ camera_id: cameraId })
      });

      if (!response.ok) {
        throw new Error('Failed to start webcam stream');
      }

      setStreaming(prev => ({ ...prev, [cameraId]: true }));

      const eventSource = new EventSource(`http://localhost:5000/api/webcam-stream/${cameraId}`);
      
      eventSource.onmessage = (event) => {
        const frame = JSON.parse(event.data);
        if (frame.image) {
          const frameUrl = `data:image/jpeg;base64,${frame.image}`;
          setProcessedUrls(prev => ({ ...prev, [cameraId]: frameUrl }));
          latestFrameRef.current = frameUrl;
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource failed:', error);
        eventSource.close();
        stopWebcamRecording(cameraId);
      };

      setWebcamStream(eventSource);

    } catch (err) {
      console.error('Error starting webcam:', err);
      alert('Failed to start webcam stream');
      setStreaming(prev => ({ ...prev, [cameraId]: false }));
    }
  };

  const stopWebcamRecording = async (cameraId) => {
    try {
      if (webcamStream) {
        webcamStream.close();
        setWebcamStream(null);
      }

      await fetch('http://localhost:5000/api/stop-webcam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ camera_id: cameraId })
      });

      setProcessedUrls(prev => ({ ...prev, [cameraId]: null }));
      latestFrameRef.current = null;

    } catch (err) {
      console.error('Error stopping webcam:', err);
    } finally {
      setStreaming(prev => ({ ...prev, [cameraId]: false }));
    }
  };

  // ---------- CCTV: send RTSP to backend, receive processed stream URL for this camera ----------
  const startCCTVProcessing = async (cameraId) => {
    const rtspUrl = camerasState[cameraId]?.rtspUrl;
    if (!rtspUrl) {
      alert('Enter RTSP URL first');
      return;
    }

    try {
      // Initialize CCTV stream
      const response = await fetch('http://localhost:5000/api/start-cctv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          camera_id: cameraId,
          rtsp_url: rtspUrl 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start CCTV stream');
      }

      setStreaming(prev => ({ ...prev, [cameraId]: true }));

      // Start receiving processed frames
      const eventSource = new EventSource(`http://localhost:5000/api/cctv-stream/${cameraId}`);
      
      eventSource.onmessage = (event) => {
        const frame = JSON.parse(event.data);
        if (frame.image) {
          const frameUrl = `data:image/jpeg;base64,${frame.image}`;
          setProcessedUrls(prev => ({ ...prev, [cameraId]: frameUrl }));
        }
      };

      eventSource.onerror = (error) => {
        console.error('CCTV EventSource failed:', error);
        eventSource.close();
        stopCCTVProcessing(cameraId);
      };

      setWebcamStream(eventSource); // Reuse webcam stream state

    } catch (err) {
      console.error('Error starting CCTV:', err);
      alert('Failed to start CCTV stream');
      setStreaming(prev => ({ ...prev, [cameraId]: false }));
    }
  };

  const stopCCTVProcessing = async (cameraId) => {
    try {
      // Close EventSource if exists
      if (webcamStream) {
        webcamStream.close();
        setWebcamStream(null);
      }

      await fetch('http://localhost:5000/api/stop-cctv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ camera_id: cameraId })
      });

      // Clear the last frame
      setProcessedUrls(prev => ({ ...prev, [cameraId]: null }));

    } catch (err) {
      console.error('Error stopping CCTV:', err);
    } finally {
      setStreaming(prev => ({ ...prev, [cameraId]: false }));
    }
  };

  const clearProcessedOutput = (cameraId) => {
    setProcessedUrls(prev => ({ ...prev, [cameraId]: null }));
    setUploadedFiles(prev => ({ ...prev, [cameraId]: null }));
  };

  const openEvidence = (alert) => {
    // prefer backend URL, append cache-buster to avoid stale 404/caching
    let img = alert?.imageurl || alert?.image || alert?.evidenceUrl || '/placeholder-evidence.jpg';
    if (img && typeof img === 'string') {
      img = `${img}${img.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }
    setEvidenceImage(img || '/placeholder-evidence.jpg');
    setEvidenceModalOpen(true);
  };

  const closeEvidence = () => {
    setEvidenceModalOpen(false);
    setEvidenceImage(null);
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
                      {/* Consistent video display area for all camera types */}
                      {processedUrls[camera.id] ? (
                        camera.type === 'testing' ? (
                          // Testing camera shows video
                          <video
                            key={processedUrls[camera.id]}
                            src={processedUrls[camera.id]}
                            controls
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', maxHeight: 360, backgroundColor: '#000' }}
                            onCanPlay={(e) => { try { e.currentTarget.play(); } catch (_) { } }}
                            onError={(e) => { console.error('Video playback error', e); alert('Video playback failed - check console'); }}
                          />
                        ) : (
                          // Webcam and CCTV show image stream
                          <img
                            key={processedUrls[camera.id]}
                            src={processedUrls[camera.id]}
                            alt="Processed stream"
                            style={{ 
                              width: '100%', 
                              maxHeight: 360, 
                              objectFit: 'contain',
                              backgroundColor: '#000'
                            }}
                            onError={(e) => { console.error('Stream display error', e); }}
                          />
                        )
                      ) : (
                        // Placeholder when no output
                        <div className="video-placeholder" style={{
                          height: '360px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#000',
                          color: '#fff',
                          borderRadius: '4px'
                        }}>
                          {camera.type === 'testing' ? 'Upload and start processing to see results' :
                           camera.type === 'webcam' ? 'Start detection to see processed output' :
                           'Start CCTV to see processed output'}
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
                            onClick={(e) => { e.preventDefault(); startProcessingTest(camera.id) }}
                            style={{ marginLeft: 8 }}
                          >
                            ▶️ Start Processing
                          </button>
                          <button
                            className="clear-btn"
                            onClick={() => clearProcessedOutput(camera.id)}
                            style={{ marginLeft: 8 }}
                          >
                            🗑️ Clear Output
                          </button>
                        </>
                      )}

                      {/* Webcam: single start/stop button */}
                      {camera.type === 'webcam' && (
                        <button
                          className={`stream-btn ${streaming[camera.id] ? 'streaming' : ''}`}
                          onClick={() => streaming[camera.id] ? stopWebcamRecording(camera.id) : startWebcamRecording(camera.id)}
                        >
                          {streaming[camera.id] ? '⏹️ Stop Detection' : '▶️ Start Detection'}
                        </button>
                      )}

                      {/* CCTV: start/stop processing */}
                      {camera.type === 'cc' && (
                        <button
                          className={`stream-btn ${streaming[camera.id] ? 'streaming' : ''}`}
                          onClick={() => streaming[camera.id] ? stopCCTVProcessing(camera.id) : startCCTVProcessing(camera.id)}
                        >
                          {streaming[camera.id] ? '⏹️ Stop CCTV' : '▶️ Start CCTV'}
                        </button>
                      )}
                    </div>

                    {/* CCTV RTSP input area */}
                    {camera.type === 'cc' && (
                      <div className="cctv-settings" style={{ marginTop: '10px' }}>
                        <input
                          type="text"
                          placeholder="RTSP URL (e.g., rtsp://ip:554/stream)"
                          value={camerasState[camera.id]?.rtspUrl || ''}
                          onChange={(e) => setCamerasState(prev => ({ ...prev, [camera.id]: { ...(prev[camera.id] || {}), rtspUrl: e.target.value } }))}
                          className="rtsp-input"
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                    )}

                    {/* Status message */}
                    <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                      {processedUrls[camera.id] ? 'Processed output displayed above' : 'No processed output yet'}
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
                  <button className="primary-btn" onClick={fetchAlerts} disabled={loadingAlerts}>
                    {loadingAlerts ? '🔄 Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>
              </div>

              <div className="alerts-table">
                {loadingAlerts && alerts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading alerts...</p>
                  </div>
                ) : alerts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No alerts detected yet.</p>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>Start monitoring with webcam or CCTV to detect suspicious activities.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Alert Type</th>
                        <th>Severity</th>
                        <th>Timestamp</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map(alert => (
                        <tr key={alert.id}>
                          <td>
                            <div className="alert-type">
                              <div className="alert-dot" style={{ backgroundColor: getSeverityColor(alert.severity) }}></div>
                              {getAlertTypeDisplay(alert.alert_type)}
                            </div>
                          </td>
                          <td>
                            <span className={`severity-badge ${alert.severity}`}>
                              {alert.severity.toUpperCase()}
                            </span>
                          </td>
                          <td>{formatTimestamp(alert.timestamp)}</td>
                          <td>
                            <div className="action-buttons">
                              <button className="icon-btn" title="View Evidence" onClick={() => openEvidence(alert)}>👁️</button>
                              <button className="icon-btn" title="Delete" onClick={() => deleteAlert(alert.id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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

      {/* Evidence Modal */}
      {evidenceModalOpen && (
        <div className="modal-overlay" onClick={closeEvidence}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <span className="close-modal" onClick={closeEvidence}>✖️</span>
            <h2>Evidence Details</h2>
            <div className="evidence-image-container">
              <img src={evidenceImage} alt="Evidence" className="evidence-image" />
            </div>
            <div className="evidence-actions">
              <button className="primary-btn" onClick={closeEvidence}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;