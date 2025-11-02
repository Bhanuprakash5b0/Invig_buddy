import os
import re
import cv2
from flask import Flask, request, jsonify, send_from_directory, Response, abort
from flask_cors import CORS
from ultralytics import YOLO
from datetime import datetime
from werkzeug.utils import secure_filename

# ================================
#  SETUP
# ================================
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

model = YOLO('./best.pt')  # Load your model
ALLOWED_EXT = {'mp4', 'mov', 'avi', 'mkv', 'webm'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT


@app.route('/')
def greet():
    return "✅ Flask YOLO video processor running!"


# =========================================================
#  Upload + Process video using YOLO and return both URLs
# =========================================================
@app.route('/api/upload-video', methods=['POST'])
def upload_and_process_video():
    if 'video' not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    video = request.files['video']
    camera_id = request.form.get('cameraId', 'unknown')

    if video.filename == '' or not allowed_file(video.filename):
        return jsonify({"error": "Invalid or missing video file"}), 400

    filename = secure_filename(video.filename)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    input_filename = f"{camera_id}_{timestamp}.mp4"
    output_filename = f"{camera_id}_{timestamp}_processed.mp4"

    input_path = os.path.join(UPLOAD_FOLDER, input_filename)
    output_path = os.path.join(PROCESSED_FOLDER, output_filename)
    video.save(input_path)

    # =====================================================
    #  PROCESS VIDEO USING YOLO
    # =====================================================
    cap = cv2.VideoCapture(input_path)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    # fourcc = cv2.VideoWriter_fourcc(*'avc1')
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
    out.release()  # 🔥 Important: finalize MP4 container

    # =====================================================
    #  Return both URLs to frontend
    # =====================================================
    host_url = request.host_url.rstrip('/')
    return jsonify({
        "message": "Video uploaded and processed successfully",
        "originalVideoUrl": f"{host_url}/uploads/{input_filename}",
        "processedVideoUrl": f"{host_url}/processed/{output_filename}"
    }), 200


# =====================================================
# Serve uploaded & processed videos (with range support)
# =====================================================
@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_uploaded(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)


@app.route('/processed/<path:filename>', methods=['GET'])
def serve_processed(filename):
    full_path = os.path.join(PROCESSED_FOLDER, filename)
    if not os.path.exists(full_path):
        abort(404)

    file_size = os.path.getsize(full_path)
    range_header = request.headers.get('Range', None)

    if range_header:
        match = re.search(r'bytes=(\d+)-(\d*)', range_header)
        if match:
            start = int(match.group(1))
            end = match.group(2)
            end = int(end) if end else file_size - 1
            end = min(end, file_size - 1)
            length = end - start + 1

            with open(full_path, 'rb') as f:
                f.seek(start)
                data = f.read(length)

            resp = Response(data, 206, mimetype='video/mp4', direct_passthrough=True)
            resp.headers.add('Content-Range', f'bytes {start}-{end}/{file_size}')
            resp.headers.add('Accept-Ranges', 'bytes')
            resp.headers.add('Content-Length', str(length))
            return resp

    # No Range header → send entire file
    resp = send_from_directory(PROCESSED_FOLDER, filename, as_attachment=False)
    resp.headers.add('Accept-Ranges', 'bytes')
    return resp


# =====================================================
#  Add Accept-Ranges globally
# =====================================================
@app.after_request
def add_headers(response):
    response.headers['Accept-Ranges'] = 'bytes'
    return response


if __name__ == '__main__':
    # 🔥 Threaded is essential for browsers to stream properly
    app.run(host='0.0.0.0', port=8000, debug=True, threaded=True)
