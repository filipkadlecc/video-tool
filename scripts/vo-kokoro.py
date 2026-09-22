#!/usr/bin/env python
"""
Local Kokoro TTS worker — the generation half of scripts/vo.ts.

Runs as a long-lived child process because model load and the first Metal
compile cost ~5s, while every line after that takes ~0.2s (measured: 23-25x
realtime on an M1 Max). Spawning a process per line would make a 40-line
script 200s instead of 10s, so vo.ts starts this once and feeds it jobs.

Protocol — newline-delimited JSON both ways:

  stdin   {"model": "mlx-community/Kokoro-82M-bf16"}     <- config, first line
          {"id": 0, "text": "...", "voice": "af_heart",
           "speed": 1.0, "out": "/abs/path.wav"}          <- then one job per line
  stdout  {"ready": true}
          {"id": 0, "ok": true, "durationSec": 3.575, "sampleRate": 24000}
          {"id": 1, "ok": false, "error": "..."}

mlx_audio and its dependencies print progress chatter to stdout, which would
corrupt that stream, so fd 1 is pointed at stderr on startup and the protocol
is written to a saved dup of the original. Anything a library prints becomes
human-readable log output; only this file writes to the real stdout.

Audio is always written as 24kHz mono PCM-16 so vo.ts can concatenate line
files and its own generated silence without a resample step.

Not run directly — see `npx tsx scripts/vo.ts --help`.
"""
import os
import sys
import json

# Take the real stdout for the protocol, then let every library write to stderr.
_protocol_fd = os.dup(1)
os.dup2(2, 1)
PROTOCOL = os.fdopen(_protocol_fd, "w", buffering=1)

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402

SAMPLE_RATE = 24000

# Kokoro picks its G2P backend from a language code, and a voice name carries
# it in the first character (af_heart -> 'a' American, bm_george -> 'b' British,
# jf_alpha -> 'j' Japanese, ...). Deriving it from the voice keeps the CLI from
# having to ask for something it can already know.
LANG_FROM_VOICE_PREFIX = set("abefhijpz")


def emit(obj):
    PROTOCOL.write(json.dumps(obj) + "\n")


def lang_code_for(voice: str) -> str:
    head = voice[:1].lower()
    return head if head in LANG_FROM_VOICE_PREFIX else "a"


def synth(model, job):
    """Generate one line and write it to job['out']. Returns duration in seconds."""
    segments = list(
        model.generate(
            text=job["text"],
            voice=job["voice"],
            speed=float(job.get("speed", 1.0)),
            lang_code=lang_code_for(job["voice"]),
        )
    )
    if not segments:
        raise RuntimeError("model returned no audio segments")

    # Long lines come back split on the model's own sentence boundaries; the
    # caller asked for one file per script line, so glue them back together.
    audio = np.concatenate([np.asarray(s.audio).reshape(-1) for s in segments])
    rate = int(getattr(segments[0], "sample_rate", SAMPLE_RATE))

    os.makedirs(os.path.dirname(job["out"]), exist_ok=True)
    sf.write(job["out"], audio, rate, subtype="PCM_16")
    return len(audio) / rate, rate


def main():
    config_line = sys.stdin.readline()
    if not config_line:
        return
    config = json.loads(config_line)

    from mlx_audio.tts.utils import load_model

    model = load_model(config.get("model", "mlx-community/Kokoro-82M-bf16"))
    emit({"ready": True})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        job = json.loads(line)
        try:
            duration, rate = synth(model, job)
            emit({"id": job["id"], "ok": True, "durationSec": duration, "sampleRate": rate})
        except Exception as exc:  # one bad line must not kill the batch
            emit({"id": job["id"], "ok": False, "error": f"{type(exc).__name__}: {exc}"})


if __name__ == "__main__":
    main()
