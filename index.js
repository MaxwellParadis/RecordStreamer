const express = require('express');
const { spawn } = require('child_process');
const events = require('events');

const app = express();
const port = 8093;

// Increase limit of listeners to prevent memory leak warnings
events.EventEmitter.defaultMaxListeners = 100;

class AudioStreamer {
    constructor() {
        this.ffmpegProcess = null;
        this.clients = new Set(); // Stores all connected response objects
        this.isRestarting = false;
        
        // Bind methods to ensure 'this' context is correct
        this.startFFmpeg = this.startFFmpeg.bind(this);
        this.broadcast = this.broadcast.bind(this);
    }

    startFFmpeg() {
        if (this.ffmpegProcess || this.isRestarting) return;

        console.log('[System] Starting FFmpeg process...');

        // Using array format for spawn is safer and cleaner than shell string
        const args = [
            '-f', 'alsa',
            '-i', 'hw:1,0',       // Your Input Device
            '-acodec', 'libmp3lame',
            '-b:a', '192k',       // Bitrate
            '-bufsize', '192k',   // Helps with buffer management
            '-f', 'mp3',
            '-'                   // Output to stdout
        ];

        this.ffmpegProcess = spawn('ffmpeg', args);

        // 1. Handle Audio Data
        this.ffmpegProcess.stdout.on('data', (chunk) => {
            this.broadcast(chunk);
        });

        // 2. Handle Error Logging (FFmpeg is chatty, we filter slightly)
        this.ffmpegProcess.stderr.on('data', (data) => {
            // Uncomment next line to debug, otherwise keep silent to save logs
            // console.error(`FFmpeg: ${data}`); 
        });

        // 3. Handle Process Close/Crash
        this.ffmpegProcess.on('close', (code) => {
            console.log(`[System] FFmpeg stopped (code ${code}).`);
            this.ffmpegProcess = null;
            this.scheduleRestart();
        });

        this.ffmpegProcess.on('error', (err) => {
            console.error('[System] Failed to start FFmpeg:', err);
            this.scheduleRestart();
        });
    }

    scheduleRestart() {
        if (this.isRestarting) return;
        this.isRestarting = true;
        
        console.log('[System] Restarting audio service in 2 seconds...');
        setTimeout(() => {
            this.isRestarting = false;
            this.startFFmpeg();
        }, 2000); // 2-second delay prevents CPU freeze loops
    }

    broadcast(chunk) {
        // Send the audio chunk to every connected client
        for (const res of this.clients) {
            // We can optionally check res.writable here
            res.write(chunk);
        }
    }

    addClient(req, res) {
        // Headers to force live streaming behavior
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        this.clients.add(res);
        console.log(`[Client] Connected. Total listeners: ${this.clients.size}`);

        // Cleanup when client disconnects
        req.on('close', () => {
            this.clients.delete(res);
            console.log(`[Client] Disconnected. Total listeners: ${this.clients.size}`);
        });
    }
}

// Initialize and Start
const streamer = new AudioStreamer();
streamer.startFFmpeg();

// Route
app.get('/stream.mp3', (req, res) => {
    streamer.addClient(req, res);
});

// Start Server
app.listen(port, () => {
    console.log(`Radio Server running on port ${port}`);
});

// Graceful Shutdown: Kill FFmpeg if you stop the Node app
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    if (streamer.ffmpegProcess) streamer.ffmpegProcess.kill();
    process.exit();
});
