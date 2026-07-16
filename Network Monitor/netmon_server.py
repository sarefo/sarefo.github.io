"""Local backend for the Network Monitor applet.

Serves netmon.html and a /api/ports endpoint that reports which ports are
in use (via netstat) and which process owns them (via tasklist).
Listens on 127.0.0.1 only. Exits by itself once the applet window has been
closed (no requests for IDLE_TIMEOUT seconds).
"""
import csv
import http.server
import io
import json
import os
import subprocess
import sys
import threading
import time

PORT = 8399
DIR = os.path.dirname(os.path.abspath(__file__))
# Safety net only: the page explicitly signals shutdown via /api/shutdown when
# closed. This just catches cases where that signal never arrives (crash,
# force-kill). Kept long because Chrome throttles background/minimized tabs'
# timers, which previously made the applet look "dead" after a normal
# 90s idle timeout even though the window was still open.
IDLE_TIMEOUT = 1800  # seconds without a request before the server exits
CREATE_NO_WINDOW = 0x08000000

last_request = time.time()


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
        global last_request
        last_request = time.time()
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

    def do_POST(self):
        if self.path == "/api/shutdown":
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
            # give the response a moment to reach the OS send buffer before
            # the process disappears
            threading.Timer(0.2, os._exit, args=[0]).start()
        else:
            self.send_error(404)


def watchdog():
    while True:
        time.sleep(10)
        if time.time() - last_request > IDLE_TIMEOUT:
            os._exit(0)


def main():
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        sys.exit(0)  # already running
    threading.Thread(target=watchdog, daemon=True).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
