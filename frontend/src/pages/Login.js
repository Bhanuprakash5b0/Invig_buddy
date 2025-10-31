import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      alert('Please fill in all fields');
      return;
    }

    console.log('Login attempt:', formData);
    
    // After successful login, redirect to dashboard
    alert('Login successful! Redirecting to dashboard...');
    navigate('/dashboard');
  };

  const handleDemoLogin = () => {
    setFormData({
      email: 'admin@smartinvigilation.com',
      password: 'admin123'
    });
    alert('Demo credentials filled! Click Sign In to proceed.');
  };

  return (
    <div className="login-page">
      <nav className="login-nav">
        <div className="nav-brand">
          <Link to="/">
            <h2>Smart Invigilation System</h2>
          </Link>
        </div>
        <div className="nav-links">
          <Link to="/" className="back-home">
            ← Back to Home
          </Link>
        </div>
      </nav>

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Admin Login</h1>
            <p>Access your invigilation dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your admin email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span className="checkmark"></span>
                Remember me
              </label>
              <a href="#forgot" className="forgot-password">
                Forgot Password?
              </a>
            </div>

            <button type="submit" className="login-btn">
              Sign In
            </button>

            <div className="demo-section">
              <button type="button" className="demo-btn" onClick={handleDemoLogin}>
                Try Demo Account
              </button>
            </div>

            <div className="register-redirect">
              <p>
                Don't have an account? <Link to="/register">Create one here</Link>
              </p>
            </div>
          </form>
        </div>

        <div className="login-features">
          <div className="features-content">
            <h3>Welcome Back!</h3>
            <p>Access your exam monitoring dashboard with advanced features:</p>
            <div className="feature-list">
              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <div>
                  <h4>Live Dashboard</h4>
                  <p>Real-time monitoring and analytics</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📹</div>
                <div>
                  <h4>Camera Management</h4>
                  <p>Monitor multiple exam halls simultaneously</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🚨</div>
                <div>
                  <h4>Smart Alerts</h4>
                  <p>Instant notifications for suspicious activities</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📈</div>
                <div>
                  <h4>Advanced Reports</h4>
                  <p>Comprehensive analytics and reporting</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;