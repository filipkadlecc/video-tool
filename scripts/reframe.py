#!/usr/bin/env python3
"""Auto-reframe: detect the subject (YuNet), smooth a crop path, and bake a
subject-tracked reframed video via hardware ffmpeg — cropping to a TARGET aspect
(e.g. 16:9 source -> 9:16 short) and tracking the subject inside it.

Invoked by lib/reframe.ts. Requires a Python with opencv (cv2) + ffmpeg/ffprobe
on PATH. Emits a one-line JSON summary on stdout when done.
"""
import argparse, json, os, subprocess, tempfile
import cv2

def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)

def probe(path):
    out = subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
        "stream=width,height","-of","json",path], capture_output=True, text=True).stdout
    s = json.loads(out)["streams"][0]
    return int(s["width"]), int(s["height"])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--target-w", type=int, default=0)   # output width  (0 = source)
    ap.add_argument("--target-h", type=int, default=0)   # output height (0 = source)
    ap.add_argument("--ss", type=float, default=0.0)
    ap.add_argument("--t", type=float, default=None)
    ap.add_argument("--sample-fps", type=float, default=2.0)
    ap.add_argument("--target-face", type=float, default=0.14)  # face width as frac of OUTPUT width
    ap.add_argument("--max-zoom", type=float, default=3.2)
    args = ap.parse_args()

    W, H = probe(args.inp)
    OW = args.target_w or W
    OH = args.target_h or H
    A = OW / OH  # target aspect
    tmp = tempfile.mkdtemp()

    # 1) Sample frames (hw decode), downscaled, at sample-fps.
    SW = 640; SH = round(H * SW / W / 2) * 2
    ss = ["-ss", str(args.ss)] + (["-t", str(args.t)] if args.t else [])
    run(["ffmpeg","-y","-hide_banner","-loglevel","error","-hwaccel","videotoolbox",
         *ss,"-i",args.inp,"-vf",f"fps={args.sample_fps},scale={SW}:{SH}",
         os.path.join(tmp,"f_%05d.jpg")])
    files = sorted(f for f in os.listdir(tmp) if f.endswith(".jpg"))
    det = cv2.FaceDetectorYN.create(args.model,"",(SW,SH),0.6,0.3,5000)
    det.setInputSize((SW,SH))

    # 2) Detect largest face per sample (normalized center + width).
    pts = []
    for i, fn in enumerate(files):
        t = i / args.sample_fps
        img = cv2.imread(os.path.join(tmp, fn))
        _, faces = det.detect(img)
        if faces is not None and len(faces) > 0:
            f = max(faces, key=lambda x: x[2]*x[3])
            pts.append([t, float((f[0]+f[2]/2)/SW), float((f[1]+f[3]/2)/SH), float(f[2]/SW)])
        else:
            pts.append([t, None, None, None])

    # 3) Fill gaps + smooth.
    def fill(idx):
        vals = [p[idx] for p in pts]; last = None
        for i, v in enumerate(vals):
            if v is None: vals[i] = last
            else: last = v
        nxt = None
        for i in range(len(vals)-1, -1, -1):
            if vals[i] is None: vals[i] = nxt
            else: nxt = vals[i]
        return [v if v is not None else 0.5 for v in vals]
    def smooth(a, win=5):
        return [sum(a[max(0,i-win):min(len(a),i+win+1)]) /
                (min(len(a),i+win+1)-max(0,i-win)) for i in range(len(a))]
    cxs = smooth(fill(1)); cys = smooth(fill(2)); ws = fill(3)
    medw = sorted(ws)[len(ws)//2] or 0.05

    # 4) Crop window at TARGET aspect, sized so the face ~= target-face of output.
    cw = medw * W / args.target_face
    cw = min(max(cw, W/args.max_zoom), W)
    ch = cw / A
    scale = min(1.0, W/cw, H/ch)
    cw *= scale; ch *= scale
    cw = round(cw/2)*2; ch = round(ch/2)*2

    def clampx(cx): return min(max(cx*W - cw/2, 0), W-cw)
    def clampy(cy): return min(max(cy*H - ch*0.42, 0), H-ch)  # headroom: face ~42% down
    kx = [(pts[i][0], round(clampx(cxs[i]))) for i in range(len(pts))]
    ky = [(pts[i][0], round(clampy(cys[i]))) for i in range(len(pts))]

    # Downsample the crop path so the ffmpeg piecewise expression stays small —
    # a keyframe per sample (2fps) over a long clip makes a 50KB nested if() that
    # ffmpeg's parser rejects. The smoothed path is gradual, so ~60 points is plenty.
    def downsample(kf, maxn=60):
        if len(kf) <= maxn:
            return kf
        step = (len(kf) - 1) / (maxn - 1)
        idxs = sorted({round(i * step) for i in range(maxn)} | {0, len(kf) - 1})
        return [kf[i] for i in idxs]
    kx = downsample(kx)
    ky = downsample(ky)

    # 5) Piecewise-linear ffmpeg expressions x(t), y(t).
    def expr(kf):
        if len(kf) == 1: return str(kf[0][1])
        e = str(kf[-1][1])
        for i in range(len(kf)-2, -1, -1):
            t0, v0 = kf[i]; t1, v1 = kf[i+1]
            seg = str(v0) if t1 == t0 else f"({v0}+({v1}-{v0})*(t-{t0})/({t1-t0}))"
            e = f"if(lt(t,{t1}),{seg},{e})"
        return e
    vf = f"crop={cw}:{ch}:'{expr(kx)}':'{expr(ky)}',scale={OW}:{OH}"
    run(["ffmpeg","-y","-hide_banner","-loglevel","error","-hwaccel","videotoolbox",
         *ss,"-i",args.inp,"-vf",vf,"-c:v","h264_videotoolbox","-b:v","12M",
         "-c:a","aac","-shortest",args.out])
    print(json.dumps({"src":[W,H],"out":[OW,OH],"aspect":round(A,3),"crop":[cw,ch],
        "medFaceW":round(medw,3),"samples":len(pts),
        "detected":sum(1 for p in pts if p[1] is not None),
        "cx_range":[round(min(cxs),2),round(max(cxs),2)]}))

if __name__ == "__main__":
    main()
