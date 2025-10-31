import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

const Homepage = () => {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 50;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleRegisterClick = () => {
    navigate('/register');
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleGetStartedClick = () => {
    navigate('/register');
  };

  const handleViewDemo = () => {
    alert('Demo feature coming soon! Contact us for a live demo.');
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    alert('Thank you for your message! We will get back to you soon.');
    e.target.reset();
  };

  return (
    <div className="homepage">
      {/* Fixed Navigation Bar */}
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-brand">
          <h2>Smart Invigilation System</h2>
        </div>
        <div className="nav-center-links">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav-auth">
          <button className="login-btn" onClick={handleLoginClick}>Login</button>
          <button className="register-btn" onClick={handleRegisterClick}>Register</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>Campus Exam Monitoring</h1>
          <p>Secure and automated exam supervision system for your institution. Maintain academic integrity with reliable monitoring technology.</p>
          <div className="hero-buttons">
            <button className="cta-primary" onClick={handleGetStartedClick}>Get Started</button>
            <button className="cta-secondary" onClick={handleViewDemo}>View Demo</button>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <h3>24/7</h3>
              <p>Monitoring</p>
            </div>
            <div className="stat">
              <h3>Secure</h3>
              <p>Data Protection</p>
            </div>
            <div className="stat">
              <h3>Easy</h3>
              <p>Setup & Use</p>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="dashboard-preview">
            <div className="preview-header">
              <div className="header-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="header-title">Campus Monitoring Dashboard</div>
            </div>
            <div className="preview-cameras">
              <div className="camera-feed active">
                <div className="camera-label">Main Hall - Cam 1</div>
              </div>
              <div className="camera-feed">
                <div className="camera-label">North Wing - Cam 2</div>
              </div>
              <div className="camera-feed">
                <div className="camera-label">South Wing - Cam 3</div>
              </div>
              <div className="camera-feed">
                <div className="camera-label">Library - Cam 4</div>
              </div>
            </div>
            <div className="preview-alerts">
              <div className="alert-item">
                <span className="alert-dot"></span>
                <span>System monitoring active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2>Campus Monitoring Features</h2>
          <p>Comprehensive exam supervision tailored for your institution</p>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📹</div>
            <h3>Live Camera Monitoring</h3>
            <p>Real-time streaming from campus cameras with activity monitoring and frame capture.</p>
            <ul className="feature-list">
              <li>Multi-camera support</li>
              <li>Real-time streaming</li>
              <li>Activity monitoring</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>Smart Monitoring</h3>
            <p>Automated detection of unusual behavior and activities during exam sessions.</p>
            <ul className="feature-list">
              <li>Activity detection</li>
              <li>Motion tracking</li>
              <li>Behavior monitoring</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🚨</div>
            <h3>Instant Alerts</h3>
            <p>Immediate notifications for any unusual activities with evidence capture.</p>
            <ul className="feature-list">
              <li>Real-time alerts</li>
              <li>Evidence capture</li>
              <li>Notification system</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Monitoring Dashboard</h3>
            <p>Centralized dashboard with live feeds and session monitoring.</p>
            <ul className="feature-list">
              <li>Live feeds</li>
              <li>Session monitoring</li>
              <li>Activity logs</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure Storage</h3>
            <p>Protected evidence storage with timestamped records and access control.</p>
            <ul className="feature-list">
              <li>Secure storage</li>
              <li>Access logs</li>
              <li>Data protection</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Session Reports</h3>
            <p>Comprehensive reporting for exam sessions and monitoring activities.</p>
            <ul className="feature-list">
              <li>Session reports</li>
              <li>Activity summaries</li>
              <li>Export functionality</li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="section-header">
          <h2>How It Works</h2>
          <p>Simple setup for your campus monitoring needs</p>
        </div>
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Setup Campus Cameras</h3>
            <p>Connect your existing campus cameras or install new ones</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Configure Monitoring</h3>
            <p>Set up monitoring schedules and alert preferences</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Monitor Exams</h3>
            <p>Watch live feeds and receive alerts during exam sessions</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Review Sessions</h3>
            <p>Access monitoring data and generate session reports</p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="about-content">
          <div className="about-text">
            <h2>About Our Campus System</h2>
            <p>
              Our exam monitoring system is designed specifically for educational institutions, 
              providing reliable and secure monitoring for all your examination needs.
            </p>
            <div className="stats">
              <div className="stat">
                <h3>Reliable</h3>
                <p>Monitoring</p>
              </div>
              <div className="stat">
                <h3>Secure</h3>
                <p>Data Handling</p>
              </div>
              <div className="stat">
                <h3>Easy</h3>
                <p>To Use</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact-section">
        <div className="section-header">
          <h2>Get In Touch</h2>
          <p>Interested in implementing our system? Contact us for more information</p>
        </div>
        <div className="contact-content">
          <div className="contact-info">
            <div className="contact-item">
              <div className="contact-icon">📧</div>
              <div>
                <h4>Email</h4>
                <p>support@campussystem.edu</p>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-icon">📞</div>
              <div>
                <h4>IT Support</h4>
                <p>Campus IT Department</p>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-icon">🏢</div>
              <div>
                <h4>Location</h4>
                <p>IT Services Building, Main Campus</p>
              </div>
            </div>
          </div>
          <form className="contact-form" onSubmit={handleContactSubmit}>
            <div className="form-row">
              <div className="form-group">
                <input type="text" placeholder="Your Name" required />
              </div>
              <div className="form-group">
                <input type="email" placeholder="Your Email" required />
              </div>
            </div>
            <div className="form-group">
              <input type="text" placeholder="Department" required />
            </div>
            <div className="form-group">
              <textarea placeholder="Your Message" rows="5" required></textarea>
            </div>
            <button type="submit" className="submit-btn">Send Message</button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Campus Exam Monitoring</h3>
            <p>Secure exam monitoring system for educational institutions.</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#about">About</a></li>
              <li><a href="#contact">Contact</a></li>
              <li><button className="footer-link" onClick={handleLoginClick}>Login</button></li>
              <li><button className="footer-link" onClick={handleRegisterClick}>Register</button></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 Campus Exam Monitoring System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;