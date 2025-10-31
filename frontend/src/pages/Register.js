import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Register.css';

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    institution: '',
    role: ''
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
    
    if (!formData.fullName || !formData.email || !formData.password || !formData.institution || !formData.role) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    
    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }

    console.log('Registration data:', formData);
    
    // After successful registration, redirect to dashboard
    alert('Registration successful! Redirecting to dashboard...');
    navigate('/dashboard');
  };

  const handleFormReset = () => {
    setFormData({
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      institution: '',
      role: ''
    });
  };

  return (
    <div className="register-page">
      <nav className="register-nav">
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

      <div className="register-container">
        <div className="register-card">
          <div className="register-header">
            <h1>Create Admin Account</h1>
            <p>Join our secure invigilation platform</p>
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fullName">Full Name *</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="institution">Institution *</label>
                <input
                  type="text"
                  id="institution"
                  name="institution"
                  value={formData.institution}
                  onChange={handleInputChange}
                  placeholder="Your institution name"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a password (min. 6 characters)"
                  required
                  minLength="6"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password *</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="role">Role *</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
              >
                <option value="">Select your role</option>
                <option value="exam_supervisor">Exam Supervisor</option>
                <option value="admin">Administrator</option>
                <option value="faculty">Faculty Member</option>
                <option value="institution_admin">Institution Admin</option>
              </select>
            </div>

            <div className="form-terms">
              <label className="checkbox-label">
                <input type="checkbox" required />
                <span className="checkmark"></span>
                I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>
              </label>
            </div>

            <div className="form-buttons">
              <button type="submit" className="register-btn">
                Create Account
              </button>
              <button type="button" className="reset-btn" onClick={handleFormReset}>
                Clear Form
              </button>
            </div>

            <div className="login-redirect">
              <p>
                Already have an account? <Link to="/login">Sign in here</Link>
              </p>
            </div>
          </form>
        </div>

        <div className="register-features">
          <div className="features-content">
            <h3>Why Join Our Platform?</h3>
            <div className="feature-list">
              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <div>
                  <h4>Advanced Dashboard</h4>
                  <p>Comprehensive monitoring and analytics dashboard</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📹</div>
                <div>
                  <h4>Multi-Camera Support</h4>
                  <p>Monitor multiple exam halls with live camera feeds</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🚨</div>
                <div>
                  <h4>Real-time Alerts</h4>
                  <p>Instant notifications for suspicious activities</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📈</div>
                <div>
                  <h4>Detailed Reports</h4>
                  <p>Generate comprehensive exam monitoring reports</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;