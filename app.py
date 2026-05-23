"""
Goose Migration Game - Flask Web Server
"""
from flask import Flask, jsonify, send_from_directory
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/api/highscore', methods=['GET'])
def get_highscore():
    """API endpoint for high scores (can expand later)"""
    return jsonify({
        'highscore': 0,
        'message': 'High score system coming soon!'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
