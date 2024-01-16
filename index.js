const express = require('express');
const { spawn } = require('child_process');

const app = express();

class FFmpegStreamer {
    constructor() {
        this.process = null;
        this.lock = false;
    }

    startFFmpeg() {
        const command = 'ffmpeg -f alsa -i hw:1,0 -acodec libmp3lame -b:a 192k -f mp3 -';
        this.process = spawn(command, { shell: true });

        this.process.stdout.on('data', (data) => {
            if (!this.lock) {
                process.stdout.write('.');//process.stdout.write(data); Printing data to console is a mess - its RAW
            }
        });

        this.process.stderr.on('data', (data) => {
            console.error(`FFmpeg stderr: ${data}`);
        });

        this.process.on('close', (code) => {
            console.log(`FFmpeg process closed with code ${code}`);
            this.startFFmpeg();
        });
    }

    start() {
        this.startFFmpeg();
    }
}

const ffmpegStreamer = new FFmpegStreamer();
ffmpegStreamer.start();

app.get('/stream.mp3', (req, res) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    ffmpegStreamer.lock = false;

    req.on('close', () => {
        ffmpegStreamer.lock = true;
    });

    ffmpegStreamer.process.stdout.pipe(res);
});

const port = 8093;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});