"""Local backend for the Network Monitor applet.

Serves netmon.html and a /api/ports endpoint that reports which ports are
in use (via netstat) and which process owns them (via tasklist).
Listens on 127.0.0.1 only. Exits by itself once the applet's Chrome window
has been closed.
"""
import csv
import ctypes
import http.server
import io
import json
import os
import subprocess
import sys
import threading
import time
from ctypes import wintypes

PORT = 8399
DIR = os.path.dirname(os.path.abspath(__file__))
CREATE_NO_WINDOW = 0x08000000

# Lifetime: the server lives exactly as long as the applet's Chrome window does
# (found via Win32, see find_window). Earlier versions inferred that from
# request timing -- an idle timeout plus a close beacon sent on `pagehide` --
# and both misfired under a still-open window, which the page then showed as
# "no port data" until netmon.bat was run again:
#   * Chrome freezes or discards the tab under memory pressure (and throttles
#     its timers when occluded), so the polls stop and pagehide fires even
#     though the window is still there.
#   * A laptop sleep longer than the idle timeout made the wall-clock idle
#     check fire the moment the machine woke, before the page could poll.
# So the watchdog now asks Windows whether the window exists, and counts time
# in its own ticks rather than wall clock so a sleep does not look like a long
# absence on resume.
TICK = 2               # seconds between watchdog checks
WINDOW_GONE_TIMEOUT = 30  # seconds the window must be missing before exiting
STARTUP_GRACE = 90     # seconds allowed for Chrome to bring the window up
# Fallback for the case where the window never matched (say, Chrome changes
# how it titles --app windows): fall back to request-based liveness, kept long
# because a frozen tab sends nothing for a while.
IDLE_TIMEOUT = 1800    # seconds without a request before exiting

request_count = 0  # bumped by every request; the watchdog watches it move


GEOM_FILE = os.path.join(DIR, "netmon_geometry.json")
WINDOW_TITLE = "Network Monitor"


def find_window():
    """HWND of the applet's Chrome --app window, or None."""
    u = ctypes.windll.user32
    hits = []
    proto = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

    def cb(hwnd, _):
        if not u.IsWindowVisible(hwnd):
            return True
        n = u.GetWindowTextLengthW(hwnd)
        if not n:
            return True
        title = ctypes.create_unicode_buffer(n + 1)
        u.GetWindowTextW(hwnd, title, n + 1)
        cls = ctypes.create_unicode_buffer(256)
        u.GetClassNameW(hwnd, cls, 256)
        if title.value == WINDOW_TITLE and "Chrome_WidgetWin" in cls.value:
            hits.append(hwnd)
        return True

    u.EnumWindows(proto(cb), 0)
    return hits[0] if hits else None


def window_rect(u, hwnd):
    r = wintypes.RECT()
    u.GetWindowRect(hwnd, ctypes.byref(r))
    return [r.left, r.top, r.right - r.left, r.bottom - r.top]


def manage_geometry():
    """Restore the window to its last size/position, then keep recording it.

    Chrome does not persist an --app window's bounds (verified: reopening one
    always lands at ~half screen), and window.resizeTo() silently clamps to a
    100px minimum height, which is taller than this applet's one-row bar needs.
    Win32 MoveWindow has neither limitation, so the sizing lives here instead of
    in the page. Everything in this function is in physical pixels, which is also
    what MoveWindow wants -- no CSS-pixel/DPI conversion is involved.
    """
    u = ctypes.windll.user32
    u.SetProcessDPIAware()
    try:
        with open(GEOM_FILE) as f:
            saved = json.load(f)
    except (OSError, ValueError):
        saved = None

    hwnd = None
    deadline = time.time() + 30  # Chrome still starting up
    while hwnd is None and time.time() < deadline:
        hwnd = find_window()
        if hwnd is None:
            time.sleep(0.5)
    if hwnd is None:
        return

    if saved and len(saved) == 4:
        # Chrome may still size the window itself for a moment after it appears,
        # which would undo a single MoveWindow -- and the recording loop below
        # would then save that as the new preference. Reassert briefly, and only
        # start recording once it has settled.
        settle = time.time() + 3
        while time.time() < settle:
            u.MoveWindow(hwnd, saved[0], saved[1], saved[2], saved[3], True)
            time.sleep(0.3)

    while True:
        time.sleep(2)
        if not u.IsWindow(hwnd):
            hwnd = find_window()
            if hwnd is None:
                continue
        cur = window_rect(u, hwnd)
        # ignore nonsense from a minimized or animating window
        if cur[2] < 50 or cur[3] < 20 or cur == saved:
            continue
        saved = cur
        try:
            with open(GEOM_FILE, "w") as f:
                json.dump(cur, f)
        except OSError:
            pass


def run_hidden(args):
    return subprocess.run(
        args, capture_output=True, text=True, creationflags=CREATE_NO_WINDOW
    ).stdout


def get_process_names():
    """Map PID -> process name using tasklist."""
    procs = {}
    out = run_hidden(["tasklist", "/fo", "csv", "/nh"])
    for row in csv.reader(io.StringIO(out)):
        if len(row) >= 2:
            try:
                procs[int(row[1])] = row[0]
            except ValueError:
                pass
    return procs


def get_ports():
    """Parse `netstat -ano` into listening ports and established connections."""
    procs = get_process_names()
    listening = {}
    established = []
    for line in run_hidden(["netstat", "-ano"]).splitlines():
        parts = line.split()
        if not parts or parts[0] not in ("TCP", "UDP"):
            continue
        proto = parts[0]
        if proto == "TCP" and len(parts) >= 5:
            local, remote, state, pid = parts[1], parts[2], parts[3], parts[4]
        elif proto == "UDP" and len(parts) >= 4:
            local, remote, state, pid = parts[1], parts[2], "", parts[3]
        else:
            continue
        try:
            port = int(local.rsplit(":", 1)[1])
            pid = int(pid)
        except (ValueError, IndexError):
            continue
        proc = procs.get(pid, "?")
        if proto == "UDP" or state == "LISTENING":
            # collapse IPv4/IPv6 duplicates of the same port+process
            listening[(proto, port, pid)] = {
                "proto": proto, "port": port, "pid": pid, "proc": proc,
            }
        elif state == "ESTABLISHED":
            established.append({
                "port": port, "remote": remote, "pid": pid, "proc": proc,
            })
    return {
        "listening": sorted(listening.values(), key=lambda e: (e["port"], e["proto"])),
        "established": sorted(established, key=lambda e: e["port"]),
    }


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # silent

    def do_GET(self):
        global request_count
        request_count += 1
        if self.path == "/" or self.path == "/netmon.html":
            with open(os.path.join(DIR, "netmon.html"), "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/api/ports":
            body = json.dumps(get_ports()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)


def watchdog():
    """Exit once the applet window has been gone for WINDOW_GONE_TIMEOUT.

    Requests only matter as a rescue: a window that stops matching while the
    page is still polling keeps the server up, and if the window never matched
    at all the plain idle timeout takes over.
    """
    uptime = window_gone = idle = 0
    window_seen = False
    seen_requests = request_count
    while True:
        time.sleep(TICK)
        uptime += TICK
        if find_window() is not None:
            window_seen = True
            window_gone = 0
        else:
            window_gone += TICK
        if request_count != seen_requests:
            seen_requests = request_count
            idle = 0
        else:
            idle += TICK
        if uptime < STARTUP_GRACE:
            continue
        if window_seen:
            if window_gone >= WINDOW_GONE_TIMEOUT and idle >= WINDOW_GONE_TIMEOUT:
                os._exit(0)
        elif idle >= IDLE_TIMEOUT:
            os._exit(0)


def main():
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        sys.exit(0)  # already running
    threading.Thread(target=watchdog, daemon=True).start()
    threading.Thread(target=manage_geometry, daemon=True).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
