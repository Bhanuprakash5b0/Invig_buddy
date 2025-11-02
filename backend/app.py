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
import threading


# ================================
#  SETUP
# ================================
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # enable CORS for all routes

UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
DB_PATH = 'invigilation.db'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

# Load YOLO model
model = YOLO('./best.pt')   # your trained model path

ALLOWED_EXT = {'mp4', 'mov', 'avi', 'mkv', 'webm'}

# Class names mapping
CLASS_NAMES = {
    0: 'backwardMove',
    1: 'correctPosture',
    2: 'leftSideMove',
    3: 'passingNotes',
    4: 'rightSideMove'
}

# Classes to alert on
ALERT_CLASSES = [0, 2, 3, 4]  # backwardMove, leftSideMove, passingNotes, rightSideMove

# Lock for database operations
db_lock = threading.Lock()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT

# Initialize database
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            imageurl TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully")

# Check if any alert classes are detected in results
def check_alerts(results):
    """Check if any alert classes (0,2,3,4) are detected in YOLO results"""
    try:
        if results[0].boxes is not None and len(results[0].boxes) > 0:
            classes = results[0].boxes.cls.cpu().numpy()
            confidences = results[0].boxes.conf.cpu().numpy()
            for cls, conf in zip(classes, confidences):
                if int(cls) in ALERT_CLASSES:
                    return True, int(cls), float(conf)
        return False, None, 0.0
    except:
        return False, None, 0.0

# Determine severity based on confidence
def get_severity(confidence):
    if confidence >= 0.7:
        return 'high'
    elif confidence >= 0.5:
        return 'medium'
    else:
        return 'low'

# Save alert to database
def save_alert(alert_type, severity, image_filename, imageurl):
    """Save alert to database with thread safety"""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Use current timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute('''
            INSERT INTO alerts (alert_type, severity, timestamp, imageurl)
            VALUES (?, ?, ?, ?)
        ''', (alert_type, severity, timestamp, imageurl))
        conn.commit()
        print(f"✅ Alert saved: {alert_type}, {severity}, {imageurl}")
    except Exception as e:
        print(f"❌ Error saving alert: {str(e)}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

# Initialize database on startup
init_db()

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


# Serve uploaded files (images and videos)
@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_uploaded(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)

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
        
        frame_count = 0  # Counter to avoid processing every single frame
            
        while True:
            success, frame = cap.read()
            if not success:
                break
            
            frame_count += 1
            process_this_frame = (frame_count % 5 == 0)  # Process every 5th frame for alerts
                
            try:
                # Process frame with ML model and get annotated frame
                results = model(frame, verbose=False)
                processed_frame = results[0].plot()  # Get the annotated frame
                
                # Check for alerts and save if detected
                if process_this_frame:
                    has_alert, class_id, confidence = check_alerts(results)
                    if has_alert:
                        severity = get_severity(confidence)
                        class_name = CLASS_NAMES.get(class_id, 'unknown')
                        
                        # Save annotated frame to uploads folder
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        image_filename = f"webcam_{camera_id}_{timestamp}.jpg"
                        image_path = os.path.join(UPLOAD_FOLDER, image_filename)
                        cv2.imwrite(image_path, processed_frame)
                        
                        # Create image URL
                        imageurl = f"{request.host_url.rstrip('/')}/uploads/{image_filename}"
                        
                        # Save alert to database in background
                        with db_lock:
                            threading.Thread(
                                target=save_alert,
                                args=('web', severity, image_filename, imageurl),
                                daemon=True
                            ).start()
                
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
        
        frame_count = 0  # Counter to avoid processing every single frame
            
        while True:
            success, frame = cap.read()
            if not success:
                break
            
            frame_count += 1
            process_this_frame = (frame_count % 5 == 0)  # Process every 5th frame for alerts
                
            try:
                # Process frame with ML model
                results = model(frame, verbose=False)
                processed_frame = results[0].plot()  # Get annotated frame
                
                # Check for alerts and save if detected
                if process_this_frame:
                    has_alert, class_id, confidence = check_alerts(results)
                    if has_alert:
                        severity = get_severity(confidence)
                        class_name = CLASS_NAMES.get(class_id, 'unknown')
                        
                        # Save annotated frame to uploads folder
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        image_filename = f"cctv_{camera_id}_{timestamp}.jpg"
                        image_path = os.path.join(UPLOAD_FOLDER, image_filename)
                        cv2.imwrite(image_path, processed_frame)
                        
                        # Create image URL
                        imageurl = f"{request.host_url.rstrip('/')}/uploads/{image_filename}"
                        
                        # Save alert to database in background
                        with db_lock:
                            threading.Thread(
                                target=save_alert,
                                args=('cctv', severity, image_filename, imageurl),
                                daemon=True
                            ).start()
                
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

# Get all alerts from database
@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, alert_type, severity, timestamp, imageurl 
            FROM alerts 
            ORDER BY timestamp DESC
        ''')
        rows = cursor.fetchall()
        conn.close()
        
        alerts = []
        for row in rows:
            alerts.append({
                'id': row[0],
                'alert_type': row[1],
                'severity': row[2],
                'timestamp': row[3],
                'imageurl': row[4]
            })
        
        return jsonify({'alerts': alerts}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Delete an alert by ID
@app.route('/api/alerts/<int:alert_id>', methods=['DELETE'])
def delete_alert(alert_id):
    try:
        # First, get the image path from database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT imageurl FROM alerts WHERE id = ?', (alert_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return jsonify({'error': 'Alert not found'}), 404
        
        imageurl = row[0]
        
        # Extract filename from URL
        image_filename = imageurl.split('/')[-1]
        if '?' in image_filename:
            image_filename = image_filename.split('?')[0]
        image_path = os.path.join(UPLOAD_FOLDER, image_filename)
        
        # Delete from database
        cursor.execute('DELETE FROM alerts WHERE id = ?', (alert_id,))
        conn.commit()
        conn.close()
        
        # Delete image file if it exists
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
                print(f"✅ Deleted image: {image_path}")
            except Exception as e:
                print(f"⚠️ Warning: Could not delete image {image_path}: {str(e)}")
        
        return jsonify({'message': 'Alert deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
