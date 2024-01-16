# RecordStreamer

This is an express server that I run on my Record Player Raspberry Pi.  Its simply a Record Player plugged into a Pi via USB.  I take that input and PIPE it into node via FFMPEG.  The FFMPEG command could be modified to stream any audio input over http for playback on something like VLC player like I do with my central Media center VM in our house.

You will need to install FFMPEG and this Node/Express app to run it.