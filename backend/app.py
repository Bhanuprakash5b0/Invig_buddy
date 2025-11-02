import os
import re
import cv2
import sqlite3
from flask import Flask, request, jsonify, send_from_directory, Response, abort
from flask_cors import CORS
from ultralytics import YOLO
from datetime import datetime
from werkzeug.utils import secure_filename
import base64
import time
import json


# ================================
#  SETUP
# ================================
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # enable CORS for all routes

UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

# Load YOLO model
model = YOLO('./best.pt')   # your trained model path

ALLOWED_EXT = {'mp4', 'mov', 'avi', 'mkv', 'webm'}

# Class names mapping
CLASS_NAMES = ['backwardMove', 'correctPosture', 'leftSideMove', 'passingNotes', 'rightSideMove']
TARGET_CLASSES = [0, 1, 2, 3, 4]  # Classes to track for alerts

# Rate limiting for alerts (avoid spam)
last_alert_time = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT

# ================================
#  DATABASE SETUP
# ================================
DATABASE = 'alerts.db'

def init_db():
    """Initialize the alerts database"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            image_url TEXT NOT NULL,
            camera_id TEXT
        )
    ''')
    conn.commit()
    conn.close()

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize database on startup
init_db()

# ================================
#  HELPER FUNCTIONS
# ================================
def determine_severity(confidence):
    """Determine severity based on confidence"""
    if confidence >= 0.7:
        return 'high'
    elif confidence >= 0.4:
        return 'medium'
    else:
        return 'low'

def save_alert_frame(annotated_frame, alert_type, camera_id, base_url='http://localhost:5000'):
    """Save annotated frame and create alert record"""
    try:
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"alert_{alert_type}_{camera_id}_{timestamp}.jpg"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Save frame
        cv2.imwrite(filepath, annotated_frame)
        
        # Create image URL
        image_url = f"{base_url}/uploads/{filename}"
        
        return filepath, image_url
    except Exception as e:
        print(f"Error saving alert frame: {str(e)}")
        return None, None

def check_and_store_alerts(results, annotated_frame, alert_type, camera_id, base_url='http://localhost:5000'):
    """Check for target classes and store alerts if found"""
    detected_classes = []
    
    if results[0].boxes is not None and len(results[0].boxes) > 0:
        for box in results[0].boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            
            # Only alert for target classes (0,1,2,3,4)
            if class_id in TARGET_CLASSES:
                detected_classes.append((class_id, confidence))
        
        # If any target classes detected, save alert (with rate limiting)
        if detected_classes:
            # Rate limit: only one alert per camera every 3 seconds
            camera_key = f"{alert_type}_{camera_id}"
            current_time = time.time()
            last_time = last_alert_time.get(camera_key, 0)
            
            if current_time - last_time < 3.0:
                return False  # Skip this alert due to rate limiting
            
            # Use highest confidence for severity
            max_confidence = max(detected_classes, key=lambda x: x[1])[1]
            severity = determine_severity(max_confidence)
            
            # Save frame
            filepath, image_url = save_alert_frame(annotated_frame, alert_type, camera_id, base_url)
            
            if image_url:
                # Store in database
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO alerts (alert_type, severity, timestamp, image_url, camera_id)
                    VALUES (?, ?, ?, ?, ?)
                ''', (alert_type, severity, timestamp, image_url, camera_id))
                conn.commit()
                conn.close()
                
                # Update last alert time
                last_alert_time[camera_key] = current_time
                
                return True
    
    return False

# ================================
#  ROUTE: Upload + Process Video
# ================================


@app.route('/')
def greet():
    return "Hello"

@app.route('/api/process-video', methods=['POST'])
def process_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video uploaded'}), 400

    video_file = request.files['video']
    camera_id = request.form.get('cameraId', 'unknown')

    if video_file.filename == '' or not allowed_file(video_file.filename):
        return jsonify({'error': 'Invalid file'}), 400

    # Save uploaded video
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename_safe = secure_filename(f"{camera_id}_{timestamp}.mp4")
    input_path = os.path.join(UPLOAD_FOLDER, filename_safe)
    output_basename = f"{camera_id}_{timestamp}_processed.mp4"
    output_path = os.path.join(PROCESSED_FOLDER, output_basename)
    video_file.save(input_path)

    # ================================
    #  PROCESS VIDEO USING YOLO
    # ================================
    cap = cv2.VideoCapture(input_path)
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        results = model(frame, verbose=False)
        annotated = results[0].plot()
        out.write(annotated)

    cap.release()
    out.release()

    # Return a playable URL that the frontend can set as <video src="...">
    processed_url = f"{request.host_url.rstrip('/')}/processed/{output_basename}"
    return jsonify({"processedVideoUrl": processed_url})


# Serve processed files with Range support so <video> can play progressively
@app.route('/processed/<path:filename>', methods=['GET'])
def serve_processed(filename):
    full_path = os.path.join(PROCESSED_FOLDER, filename)
    if not os.path.exists(full_path):
        abort(404)

    range_header = request.headers.get('Range', None)
    if not range_header:
        # simple full-response; send_from_directory sets Content-Type
        return send_from_directory(PROCESSED_FOLDER, filename, as_attachment=False)

    # Parse range header "bytes=start-end"
    size = os.path.getsize(full_path)
    m = re.search(r'bytes=(\d+)-(\d*)', range_header)
    if not m:
        return send_from_directory(PROCESSED_FOLDER, filename, as_attachment=False)

    start = int(m.group(1))
    end = int(m.group(2)) if m.group(2) else size - 1
    if end >= size:
        end = size - 1
    length = end - start + 1

    with open(full_path, 'rb') as f:
        f.seek(start)
        data = f.read(length)

    resp = Response(data, 206, mimetype='video/mp4', direct_passthrough=True)
    resp.headers.add('Content-Range', f'bytes {start}-{end}/{size}')
    resp.headers.add('Accept-Ranges', 'bytes')
    resp.headers.add('Content-Length', str(length))
    return resp

# Serve uploaded alert images
@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)

# Required Flask endpoints

@app.route('/api/start-webcam', methods=['POST'])
def start_webcam():
    try:
        camera_id = request.json.get('camera_id')
        
        # Release existing camera if any
        existing_cap = app.config.get(f'camera_{camera_id}')
        if existing_cap:
            existing_cap.release()
            
        # Initialize OpenCV capture
        cap = cv2.VideoCapture(0)
        
        # Verify camera opened successfully
        if not cap.isOpened():
            return jsonify({'error': 'Failed to open camera'}), 500
            
        # Set camera properties
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        
        # Store capture object in app context
        app.config[f'camera_{camera_id}'] = cap
        
        return jsonify({'status': 'started'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/webcam-stream/<camera_id>')
def webcam_stream(camera_id):
    def generate_frames():
        cap = app.config.get(f'camera_{camera_id}')
        if not cap:
            return
        
        base_url = request.host_url.rstrip('/')
            
        while True:
            success, frame = cap.read()
            if not success:
                break
                
            try:
                # Process frame with ML model and get annotated frame
                results = model(frame, verbose=False)
                processed_frame = results[0].plot()  # Get the annotated frame
                
                # Check for alerts and store if detected
                check_and_store_alerts(results, processed_frame, 'web', camera_id, base_url)
                
                # Encode frame to base64
                _, buffer = cv2.imencode('.jpg', processed_frame)
                frame_bytes = base64.b64encode(buffer).decode('utf-8')
                
                # Send the frame data
                yield f"data: {json.dumps({'image': frame_bytes})}\n\n"
                
                time.sleep(1/30)  # Cap at 30 FPS
                
                
            except Exception as e:
                print(f"Error processing frame: {str(e)}")
                break
        
        # Cleanup if loop breaks
        if cap:
            cap.release()
            try:
                del app.config[f'camera_{camera_id}']
            except:
                pass
    
    return Response(generate_frames(), 
                   mimetype='text/event-stream',
                   headers={
                       'Cache-Control': 'no-cache',
                       'Connection': 'keep-alive',
                       'X-Accel-Buffering': 'no'
                   })

@app.route('/api/stop-webcam', methods=['POST'])
def stop_webcam():
    camera_id = request.json.get('camera_id')
    cap = app.config.get(f'camera_{camera_id}')
    if cap:
        cap.release()
        del app.config[f'camera_{camera_id}']
    return jsonify({'status': 'stopped'})

# Store CCTV captures in app context
app.config['cctv_captures'] = {}

@app.route('/api/start-cctv', methods=['POST'])
def start_cctv():
    try:
        data = request.json
        camera_id = data.get('camera_id')
        rtsp_url = data.get('rtsp_url')

        # Initialize capture for this camera
        cap = cv2.VideoCapture(rtsp_url)
        if not cap.isOpened():
            return jsonify({'error': 'Failed to open RTSP stream'}), 500

        # Store capture in app context
        app.config['cctv_captures'][camera_id] = cap
        
        return jsonify({'status': 'started'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cctv-stream/<camera_id>')
def cctv_stream(camera_id):
    def generate_frames():
        cap = app.config['cctv_captures'].get(camera_id)
        if not cap:
            return
        
        base_url = request.host_url.rstrip('/')
            
        while True:
            success, frame = cap.read()
            if not success:
                break
                
            try:
                # Process frame with ML model
                results = model(frame, verbose=False)
                processed_frame = results[0].plot()  # Get annotated frame
                
                # Check for alerts and store if detected
                check_and_store_alerts(results, processed_frame, 'cctv', camera_id, base_url)
                
                # Encode frame to base64
                _, buffer = cv2.imencode('.jpg', processed_frame)
                frame_bytes = base64.b64encode(buffer).decode('utf-8')
                
                # Send frame data
                yield f"data: {json.dumps({'image': frame_bytes})}\n\n"
                
                time.sleep(1/30)  # Cap at 30 FPS
                
            except Exception as e:
                print(f"Error processing CCTV frame: {str(e)}")
                break
        
        # Cleanup if loop breaks
        if cap:
            cap.release()
            try:
                del app.config['cctv_captures'][camera_id]
            except:
                pass
    
    return Response(
        generate_frames(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )

@app.route('/api/stop-cctv', methods=['POST'])
def stop_cctv():
    try:
        camera_id = request.json.get('camera_id')
        cap = app.config['cctv_captures'].get(camera_id)
        if cap:
            cap.release()
            del app.config['cctv_captures'][camera_id]
        return jsonify({'status': 'stopped'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ================================
#  ALERTS API ENDPOINTS
# ================================

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Retrieve all alerts from database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM alerts ORDER BY timestamp DESC')
        alerts = cursor.fetchall()
        conn.close()
        
        # Convert to list of dictionaries
        alerts_list = []
        for alert in alerts:
            alerts_list.append({
                'id': alert['id'],
                'alert_type': alert['alert_type'],
                'severity': alert['severity'],
                'timestamp': alert['timestamp'],
                'image_url': alert['image_url'],
                'camera_id': alert['camera_id']
            })
        
        return jsonify(alerts_list), 200
    except Exception as e:
        print(f"Error retrieving alerts: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alerts/<int:alert_id>', methods=['DELETE'])
def delete_alert(alert_id):
    """Delete alert and associated image"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get alert details before deletion
        cursor.execute('SELECT * FROM alerts WHERE id = ?', (alert_id,))
        alert = cursor.fetchone()
        
        if not alert:
            conn.close()
            return jsonify({'error': 'Alert not found'}), 404
        
        # Extract filename from image_url
        image_url = alert['image_url']
        filename = image_url.split('/')[-1]
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Delete from database
        cursor.execute('DELETE FROM alerts WHERE id = ?', (alert_id,))
        conn.commit()
        conn.close()
        
        # Delete image file if exists
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as e:
                print(f"Error deleting image file: {str(e)}")
        
        return jsonify({'message': 'Alert deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting alert: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
