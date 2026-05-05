#!/usr/bin/env bash
# Regenerate the music tracks at public/audio/music-{menu,game}.ogg.
# Layered ffmpeg synthesis: bass + pad + melody.
#
#   menu : C - Am - F - G dreamy progression, 8 s loop
#   game : C - G - Am - F upbeat progression, 8 s loop
#
# Re-run with:
#   bash scripts/generate-music.sh
#
# Strategy: build all intermediates as PCM WAV (lossless, no encoder
# quirks). Vorbis is invoked only once per output file, on the final
# mixdown — this avoids the ffmpeg built-in vorbis encoder asserting
# on multi-pass / very-quiet inputs.

set -euo pipefail

cd "$(dirname "$0")/.."
OUT=public/audio
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FFMPEG=(ffmpeg -y -hide_banner -loglevel error)

# ---------- helpers (all WAV intermediates) ----------

# Single sine note with attack/release envelope, mono → stereo PCM.
# Args: out_wav freq_hz duration_s [volume=0.18]
mknote() {
  local out=$1 freq=$2 dur=$3 vol=${4:-0.18}
  local rel
  rel=$(awk -v d="$dur" 'BEGIN{r=d*0.4; if(r<0.12)r=0.12; if(r>d-0.02)r=d-0.02; print r}')
  local rel_start
  rel_start=$(awk -v d="$dur" -v r="$rel" 'BEGIN{print d-r}')
  "${FFMPEG[@]}" -f lavfi -t "$dur" -i "sine=f=$freq:sample_rate=44100" \
    -filter:a "volume=$vol,afade=t=in:st=0:d=0.02,afade=t=out:st=$rel_start:d=$rel,aformat=channel_layouts=stereo" \
    "$out"
}

# Triad pad (3 sines, low-passed).
# Args: out_wav f1 f2 f3 duration_s [vol_root=0.10]
mkpad() {
  local out=$1 f1=$2 f2=$3 f3=$4 dur=$5 v1=${6:-0.10}
  local v2 v3
  v2=$(awk -v v="$v1" 'BEGIN{print v*0.8}')
  v3=$(awk -v v="$v1" 'BEGIN{print v*0.7}')
  local rel=0.4
  local rel_start
  rel_start=$(awk -v d="$dur" -v r="$rel" 'BEGIN{print d-r}')
  "${FFMPEG[@]}" \
    -f lavfi -t "$dur" -i "sine=f=$f1:sample_rate=44100" \
    -f lavfi -t "$dur" -i "sine=f=$f2:sample_rate=44100" \
    -f lavfi -t "$dur" -i "sine=f=$f3:sample_rate=44100" \
    -filter_complex "[0:a]volume=$v1[a];[1:a]volume=$v2[b];[2:a]volume=$v3[c];[a][b][c]amix=inputs=3:duration=first,afade=t=in:st=0:d=0.15,afade=t=out:st=$rel_start:d=$rel,lowpass=f=1900,aformat=channel_layouts=stereo" \
    "$out"
}

# Plucky bass note (short attack, fast decay) for arcade pulse.
mkpulse() {
  local out=$1 freq=$2 dur=${3:-0.5} vol=${4:-0.22}
  "${FFMPEG[@]}" -f lavfi -t "$dur" -i "sine=f=$freq:sample_rate=44100" \
    -filter:a "volume=$vol,afade=t=in:st=0:d=0.005,afade=t=out:st=$(awk -v d="$dur" 'BEGIN{print d*0.55}'):d=$(awk -v d="$dur" 'BEGIN{print d*0.4}'),aformat=channel_layouts=stereo" \
    "$out"
}

# Concat WAVs (lossless).
# Args: out_wav file1 file2 ...
concatto() {
  local out=$1; shift
  local list="$TMP/concat.txt"
  : > "$list"
  for f in "$@"; do printf "file '%s'\n" "$f" >> "$list"; done
  "${FFMPEG[@]}" -f concat -safe 0 -i "$list" -c copy "$out"
}

# Mix WAVs to ogg-vorbis (final step). Encoder is invoked once.
# Args: out_ogg file1 file2 ...
mix_to_ogg() {
  local out=$1; shift
  local n=$#
  local args=() refs=""
  local idx=0
  for f in "$@"; do
    args+=(-i "$f")
    refs+="[${idx}:a]"
    idx=$((idx + 1))
  done
  "${FFMPEG[@]}" "${args[@]}" \
    -filter_complex "${refs}amix=inputs=$n:duration=longest:dropout_transition=0,volume=1.4,alimiter=limit=0.95,aformat=channel_layouts=stereo" \
    -c:a vorbis -strict experimental -q:a 5 "$out"
}

# ---------- MENU TRACK: dreamy 8-second loop ----------

echo "[music] menu: bass"
mknote "$TMP/m_b1.wav" 65.41 2 0.20   # C2
mknote "$TMP/m_b2.wav" 55.00 2 0.20   # A1
mknote "$TMP/m_b3.wav" 43.65 2 0.20   # F1
mknote "$TMP/m_b4.wav" 49.00 2 0.20   # G1
concatto "$TMP/menu_bass.wav" "$TMP/m_b1.wav" "$TMP/m_b2.wav" "$TMP/m_b3.wav" "$TMP/m_b4.wav"

echo "[music] menu: pad"
mkpad "$TMP/m_p1.wav" 261.63 329.63 392.00 2   # C major
mkpad "$TMP/m_p2.wav" 220.00 261.63 329.63 2   # A minor
mkpad "$TMP/m_p3.wav" 174.61 220.00 261.63 2   # F major
mkpad "$TMP/m_p4.wav" 196.00 246.94 293.66 2   # G major
concatto "$TMP/menu_pad.wav" "$TMP/m_p1.wav" "$TMP/m_p2.wav" "$TMP/m_p3.wav" "$TMP/m_p4.wav"

echo "[music] menu: melody"
mknote "$TMP/m_C5.wav" 523.25 0.5 0.14
mknote "$TMP/m_E5.wav" 659.25 0.5 0.14
mknote "$TMP/m_G5.wav" 783.99 0.5 0.14
mknote "$TMP/m_A4.wav" 440.00 0.5 0.14
mknote "$TMP/m_F4.wav" 349.23 0.5 0.14
mknote "$TMP/m_G4.wav" 392.00 0.5 0.14
mknote "$TMP/m_B4.wav" 493.88 0.5 0.14
mknote "$TMP/m_D5.wav" 587.33 0.5 0.14

# C: C5 E5 G5 E5    Am: A4 C5 E5 C5    F: F4 A4 C5 A4    G: G4 B4 D5 B4
concatto "$TMP/menu_mel.wav" \
  "$TMP/m_C5.wav" "$TMP/m_E5.wav" "$TMP/m_G5.wav" "$TMP/m_E5.wav" \
  "$TMP/m_A4.wav" "$TMP/m_C5.wav" "$TMP/m_E5.wav" "$TMP/m_C5.wav" \
  "$TMP/m_F4.wav" "$TMP/m_A4.wav" "$TMP/m_C5.wav" "$TMP/m_A4.wav" \
  "$TMP/m_G4.wav" "$TMP/m_B4.wav" "$TMP/m_D5.wav" "$TMP/m_B4.wav"

echo "[music] menu: mixdown"
mix_to_ogg "$OUT/music-menu.ogg" "$TMP/menu_bass.wav" "$TMP/menu_pad.wav" "$TMP/menu_mel.wav"

# ---------- GAME TRACK: upbeat 8-second loop ----------

echo "[music] game: bass (pulsing quarter notes)"
build_bass_chord() {
  local out=$1 freq=$2
  mkpulse "$TMP/_p.wav" "$freq" 0.5 0.22
  concatto "$out" "$TMP/_p.wav" "$TMP/_p.wav" "$TMP/_p.wav" "$TMP/_p.wav"
}
build_bass_chord "$TMP/g_b1.wav" 130.81   # C3
build_bass_chord "$TMP/g_b2.wav"  98.00   # G2
build_bass_chord "$TMP/g_b3.wav" 110.00   # A2
build_bass_chord "$TMP/g_b4.wav"  87.31   # F2
concatto "$TMP/game_bass.wav" "$TMP/g_b1.wav" "$TMP/g_b2.wav" "$TMP/g_b3.wav" "$TMP/g_b4.wav"

echo "[music] game: pad"
mkpad "$TMP/g_p1.wav" 261.63 329.63 392.00 2   # C
mkpad "$TMP/g_p2.wav" 196.00 246.94 293.66 2   # G
mkpad "$TMP/g_p3.wav" 220.00 261.63 329.63 2   # Am
mkpad "$TMP/g_p4.wav" 174.61 220.00 261.63 2   # F
concatto "$TMP/game_pad.wav" "$TMP/g_p1.wav" "$TMP/g_p2.wav" "$TMP/g_p3.wav" "$TMP/g_p4.wav"

echo "[music] game: melody (energetic)"
mknote "$TMP/g_C5.wav" 523.25 0.5 0.16
mknote "$TMP/g_E5.wav" 659.25 0.5 0.16
mknote "$TMP/g_G5.wav" 783.99 0.5 0.16
mknote "$TMP/g_A5.wav" 880.00 0.5 0.16
mknote "$TMP/g_D5.wav" 587.33 0.5 0.16
mknote "$TMP/g_B4.wav" 493.88 0.5 0.16
mknote "$TMP/g_F5.wav" 698.46 0.5 0.16

# C: C5 E5 G5 E5    G: D5 G5 B4 D5    Am: C5 E5 A5 E5    F: F5 A5 C5 A5
concatto "$TMP/game_mel.wav" \
  "$TMP/g_C5.wav" "$TMP/g_E5.wav" "$TMP/g_G5.wav" "$TMP/g_E5.wav" \
  "$TMP/g_D5.wav" "$TMP/g_G5.wav" "$TMP/g_B4.wav" "$TMP/g_D5.wav" \
  "$TMP/g_C5.wav" "$TMP/g_E5.wav" "$TMP/g_A5.wav" "$TMP/g_E5.wav" \
  "$TMP/g_F5.wav" "$TMP/g_A5.wav" "$TMP/g_C5.wav" "$TMP/g_A5.wav"

echo "[music] game: mixdown"
mix_to_ogg "$OUT/music-game.ogg" "$TMP/game_bass.wav" "$TMP/game_pad.wav" "$TMP/game_mel.wav"

echo
echo "[music] done:"
ls -la "$OUT"/music-{menu,game}.ogg
