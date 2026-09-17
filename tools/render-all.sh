#!/bin/bash
# Renders every film deliverable from the current scene code: masters, delivery
# encodes, web encode, poster, social image and stills. Needs the dist server
# on FLY_BASE (default http://127.0.0.1:5178).
set -euo pipefail
cd "$(dirname "$0")/.."
F=${FFMPEG:-$HOME/bin/ffmpeg}
mkdir -p build/audio build/film build/stills build/captions
for e in main teaser vertical; do python3 tools/soundtrack.py $e build/audio/FLY-$e.wav; done
node tools/export-captions.mjs build/captions
node tools/render-film.mjs main build/film/FLY-main-68s.master.mp4 build/audio/FLY-main.wav --frames build/stills --stills 0.5,4,12,22,30,38,45,52,60,66
node tools/render-film.mjs teaser build/film/FLY-teaser-20s.master.mp4 build/audio/FLY-teaser.wav --frames build/stills --stills 1.5,7.5,13,18.5
node tools/render-film.mjs vertical build/film/FLY-vertical-30s.master.mp4 build/audio/FLY-vertical.wav --frames build/stills --stills 2,10,15,23,28.5
enc() { "$F" -hide_banner -loglevel error -y -i "$1" -c:v libx264 -preset slow -crf 19 -maxrate 14M -bufsize 28M -pix_fmt yuv420p -profile:v high -level:v 4.2 -g 60 -c:a copy -movflags +faststart "$2"; }
enc build/film/FLY-main-68s.master.mp4 build/film/FLY-main-68s.mp4
enc build/film/FLY-teaser-20s.master.mp4 build/film/FLY-teaser-20s.mp4
enc build/film/FLY-vertical-30s.master.mp4 build/film/FLY-vertical-30s.mp4
for pass in 1 2; do
  if [ $pass = 1 ]; then OUT=(-an -f mp4 /dev/null); else OUT=(-c:a aac -b:a 128k -movflags +faststart build/film/FLY-main-68s.web.mp4); fi
  "$F" -hide_banner -loglevel error -y -i build/film/FLY-main-68s.master.mp4 -c:v libx264 -preset slow -b:v 2600k -maxrate 3600k -bufsize 7200k -pass $pass -passlogfile build/film/web2pass -pix_fmt yuv420p -profile:v high -level:v 4.1 -g 60 "${OUT[@]}"
done
"$F" -hide_banner -loglevel error -y -i build/audio/FLY-main.wav -c:a aac -b:a 160k -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 build/film/FLY-soundtrack.m4a
node tools/film-stills.mjs
echo done
