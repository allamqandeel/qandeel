# D-3 CP4 focused validation (PO review 2026-11-19). VALIDATION BRANCH ONLY; never merged.
# One row per decoded frame of a `simctl io recordVideo` file: its presentation time (ms from the first frame), the mean
# absolute grey difference from the previous frame in four bands (status bar, header, stage, bottom; points of an
# iPhone 17), and the stage's frame-to-frame shift (phase correlation, points) with its response. The frame times say
# when the screen changed; the analysis maps them to the touches recorded by the test.
# usage: python d3-focus-frames.py <video.mp4> <out.csv> <width in points>
import csv
import sys

import cv2
import numpy as np

video, out, wpt = sys.argv[1], sys.argv[2], float(sys.argv[3])
cap = cv2.VideoCapture(video)
if not cap.isOpened():
    sys.exit(f"cannot open {video}")
BANDS = {"status": (0, 54), "header": (54, 165), "stage": (165, 730), "bottom": (730, 10000)}
prev = None
n = 0
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["frame", "t_ms", *BANDS.keys(), "stage_dx", "stage_dy", "stage_resp"])
    while True:
        ok, img = cap.read()
        if not ok:
            break
        t = cap.get(cv2.CAP_PROP_POS_MSEC)
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, wd = g.shape
        small = cv2.resize(g, (wd // 4, h // 4), interpolation=cv2.INTER_AREA).astype(np.float32)
        k = (wd / wpt) / 4  # small pixels per point

        def band(a, y0, y1):
            return a[int(y0 * k):min(a.shape[0], int(y1 * k)), :]

        if prev is None:
            diffs = [0.0] * len(BANDS)
            dx = dy = resp = 0.0
        else:
            diffs = [float(np.mean(np.abs(band(small, *v) - band(prev, *v)))) for v in BANDS.values()]
            (dx, dy), resp = cv2.phaseCorrelate(band(prev, *BANDS["stage"]), band(small, *BANDS["stage"]))
            dx, dy = dx / k, dy / k
        w.writerow([n, round(t, 1), *[round(d, 3) for d in diffs], round(dx, 1), round(dy, 1), round(resp, 3)])
        prev = small
        n += 1
print(f"{video}: {n} frames")
