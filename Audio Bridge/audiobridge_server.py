"""Audio Bridge: stream this PC's audio to Android phones over USB.

Captures a Windows output device via WASAPI loopback (soundcard library) and
fans the raw PCM out to any number of TCP clients on 127.0.0.1:44100. Phones
reach that port through `adb reverse`, which this server applies automatically
to every USB-debugging device it sees. Serves audiobridge.html and a small
control API on 127.0.0.1:8400.

A local monitor can additionally play the same audio on one of this PC's own
output devices with an adjustable delay, so the laptop's own headphones can be
lined up with the (slower) phones.

Wire format: 12-byte header ("ABR1", rate u32 LE, channels u8, bits u8,
reserved u16), then unframed int16 LE interleaved stereo frames forever.

Follows the Network Monitor applet's server pattern (shutdown beacon,
idle watchdog, hidden subprocesses).
"""
import collections
import http.server
import json
import os
import socket
import struct
import subprocess
import sys
import threading
import time

import numpy as np
import soundcard as sc  # import on the main thread: it initializes COM (MTA)
# once here; all worker threads then implicitly share that apartment.

HTTP_PORT = 8400
# 44100 chosen empirically: this machine silently reserves ~45000-48100
# (Hyper-V/WSL NAT ranges that netsh does not list) -- binds there fail 10048.
AUDIO_PORT = 44100
RATE = 48000
CHANNELS = 2
BLOCK_FRAMES = 240  # 5 ms at 48 kHz
HEADER = b"ABR1" + struct.pack("<IBBH", RATE, CHANNELS, 16, 0)
# Per-client buffer cap: 40 blocks = 200 ms. When a client falls behind, the
# oldest audio is dropped -- the capture thread must never block on a socket.
QUEUE_BLOCKS = 40
# Local monitor: plays the captured audio on one of this PC's own output
# devices, delayed. Needed because audio can only ever be *delayed*, so the
# fastest listener must wait for the slowest -- and Windows offers no way to
# delay its own output. Cap the line at 4 s (delay is clamped to 3 s).
MONITOR_BLOCKS = 800
MAX_DELAY_MS = 3000
# Write to the monitor in ~40 ms batches. A Bluetooth endpoint cannot service
# the 5 ms period the capture runs at and distorts audibly if asked to.
MONITOR_PLAY_FRAMES = 1920
# The monitor device's clock is not the capture device's, so playback slowly
# falls behind. Skip ahead past 300 ms rather than let latency creep.
MONITOR_MAX_BACKLOG = 60

DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_FILE = os.path.join(DIR, "audiobridge_settings.json")
ADB = os.path.join(
    os.environ["LOCALAPPDATA"], "Android", "Sdk", "platform-tools", "adb.exe"
)
CREATE_NO_WINDOW = 0x08000000

# Same arrangement as netmon: the page's close beacon only *schedules* an
# exit, because Chrome fires pagehide when it merely discards/freezes the tab
# under memory pressure; any later request cancels the pending exit.
IDLE_TIMEOUT = 1800
SHUTDOWN_GRACE = 20

last_request = time.time()
shutdown_at = None

# --- shared state -----------------------------------------------------------

lock = threading.Lock()
clients = []  # list[Client]
capture_wanted = threading.Event()  # set while >= 1 client is connected
capture_generation = 0  # bumped to make the capture loop reopen its device
capture_device_name = None  # None = current default speaker's loopback
capture_status = "idle"  # idle | running | error: ...
adb_serials = {}  # serial -> "ok" | error text

monitor_device_name = None  # None = local monitor off
monitor_delay_ms = 0
monitor_status = "off"  # off | running | error: ...
monitor_drops = 0  # blocks skipped to keep the monitor from drifting late
monitor_generation = 0
monitor_queue = collections.deque(maxlen=MONITOR_BLOCKS)
monitor_have = threading.Event()


class Client:
    def __init__(self, sock, addr):
        self.sock = sock
        self.addr = addr
        self.queue = collections.deque(maxlen=QUEUE_BLOCKS)
        self.have = threading.Event()
        self.sent = 0
        self.dropped = 0
        self.since = time.time()


def load_settings():
    global capture_device_name, monitor_device_name, monitor_delay_ms
    try:
        with open(SETTINGS_FILE) as f:
            s = json.load(f)
    except (OSError, ValueError):
        return
    capture_device_name = s.get("device") or None
    monitor_device_name = s.get("monitor") or None
    monitor_delay_ms = int(s.get("monitor_delay_ms") or 0)


def save_settings():
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump({"device": capture_device_name,
                       "monitor": monitor_device_name,
                       "monitor_delay_ms": monitor_delay_ms}, f)
    except OSError:
        pass


def run_hidden(args, timeout=10):
    try:
        return subprocess.run(
            args, capture_output=True, text=True, timeout=timeout,
            creationflags=CREATE_NO_WINDOW,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None


# --- audio capture -----------------------------------------------------------


def loopback_devices():
    return [m for m in sc.all_microphones(include_loopback=True) if m.isloopback]


def effective_capture_name():
    return capture_device_name or sc.default_speaker().name


def update_capture_wanted():
    """Capture runs while anything consumes it. Call with `lock` held."""
    if clients or monitor_device_name:
        capture_wanted.set()
    else:
        capture_wanted.clear()


def pick_device():
    devs = loopback_devices()
    if capture_device_name:
        for m in devs:
            if m.name == capture_device_name:
                return m
    default = sc.default_speaker().name
    for m in devs:
        if m.name == default:
            return m
    return devs[0] if devs else None


def capture_loop():
    """Capture the selected loopback device and fan out to all clients.

    Runs only while at least one client is connected; reopens the device when
    the panel changes the selection (generation bump).
    """
    global capture_status
    while True:
        capture_wanted.wait()
        with lock:
            generation = capture_generation
        try:
            mic = pick_device()
            if mic is None:
                capture_status = "error: no loopback capture device found"
                time.sleep(2)
                continue
            with mic.recorder(samplerate=RATE, channels=CHANNELS,
                              blocksize=BLOCK_FRAMES) as rec:
                capture_status = "running"
                blocks = 0
                while capture_wanted.is_set():
                    # Follow the Windows default output: if the user switches
                    # it (e.g. connects BT headphones) while we are capturing,
                    # reopen on the new device. Checked every ~2 s.
                    blocks += 1
                    if blocks % 400 == 0 and capture_device_name is None \
                            and sc.default_speaker().name != mic.name:
                        break
                    with lock:
                        if generation != capture_generation:
                            break  # device changed; reopen
                        targets = list(clients)
                    data = rec.record(numframes=BLOCK_FRAMES)
                    if monitor_device_name:
                        monitor_queue.append(data)
                        monitor_have.set()
                    block = (np.clip(data, -1.0, 1.0) * 32767.0).astype(
                        "<i2").tobytes()
                    for c in targets:
                        if len(c.queue) == QUEUE_BLOCKS:
                            c.dropped += 1
                        c.queue.append(block)
                        c.have.set()
            capture_status = "idle"
        except Exception as e:  # device unplugged, format refused, ...
            capture_status = f"error: {e}"
            time.sleep(2)


def monitor_loop():
    """Play the captured audio on one of this PC's outputs, delayed.

    This is how the laptop's own headphones join the sync group. Audio can
    only ever be delayed, so every listener has to be pushed back to match the
    slowest one -- and Windows has no delay control for its own output. With
    the Windows default output on a silent virtual device and the monitor on
    the real headphones, the laptop becomes just another delayable player.
    """
    global monitor_status, monitor_drops
    while True:
        if not monitor_device_name:
            monitor_status = "off"
            monitor_queue.clear()
            time.sleep(0.3)
            continue
        generation = monitor_generation
        try:
            spk = next((s for s in sc.all_speakers()
                        if s.name == monitor_device_name), None)
            if spk is None:
                monitor_status = f"error: '{monitor_device_name}' not found"
                time.sleep(2)
                continue
            if monitor_device_name == effective_capture_name():
                # Capturing the device we play to would feed back on itself.
                monitor_status = "error: same device as capture (feedback)"
                time.sleep(2)
                continue
            with spk.player(samplerate=RATE, channels=CHANNELS,
                            blocksize=MONITOR_PLAY_FRAMES) as player:
                monitor_status = "running"
                monitor_drops = 0
                line = collections.deque()  # the delay line
                pending, pending_frames = [], 0
                blocks = 0
                while monitor_device_name and generation == monitor_generation:
                    blocks += 1
                    if blocks % 400 == 0 and \
                            monitor_device_name == effective_capture_name():
                        break  # default output moved onto us; reopen and warn
                    if not monitor_queue:
                        monitor_have.clear()
                        monitor_have.wait(timeout=0.5)
                        continue
                    while len(monitor_queue) > MONITOR_MAX_BACKLOG:
                        monitor_queue.popleft()  # clock drift: skip ahead
                        monitor_drops += 1
                    line.append(monitor_queue.popleft())
                    target = (min(max(monitor_delay_ms, 0), MAX_DELAY_MS)
                              * RATE // (1000 * BLOCK_FRAMES))
                    while len(line) > target + 1:
                        line.popleft()  # delay lowered: drop the surplus
                    if len(line) > target:
                        pending.append(line.popleft())
                        pending_frames += BLOCK_FRAMES
                        if pending_frames >= MONITOR_PLAY_FRAMES:
                            player.play(np.concatenate(pending))
                            pending, pending_frames = [], 0
            monitor_status = "off"
        except Exception as e:  # device unplugged, format refused, ...
            monitor_status = f"error: {e}"
            time.sleep(2)


# --- TCP fan-out --------------------------------------------------------------


def client_writer(c):
    """Per-client sender. Owns the socket; capture only touches the deque."""
    try:
        c.sock.sendall(HEADER)
        while True:
            c.have.wait(timeout=1.0)
            while True:
                try:
                    block = c.queue.popleft()
                except IndexError:
                    break
                c.sock.sendall(block)
                c.sent += 1
            c.have.clear()
            if c.queue:
                continue
    except OSError:
        pass
    finally:
        with lock:
            if c in clients:
                clients.remove(c)
            update_capture_wanted()
        try:
            c.sock.close()
        except OSError:
            pass


def audio_server():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", AUDIO_PORT))
    srv.listen(8)
    while True:
        sock, addr = srv.accept()
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        c = Client(sock, addr)
        with lock:
            clients.append(c)
            update_capture_wanted()
        threading.Thread(target=client_writer, args=(c,), daemon=True).start()


# --- adb ----------------------------------------------------------------------


def apply_reverse(serial):
    r = run_hidden([ADB, "-s", serial, "reverse",
                    f"tcp:{AUDIO_PORT}", f"tcp:{AUDIO_PORT}"])
    if r is not None and r.returncode == 0:
        return "ok"
    return (r.stderr.strip() if r and r.stderr else "adb reverse failed")


def adb_watcher():
    """Apply the reverse mapping to every newly seen USB-debugging device."""
    if not os.path.exists(ADB):
        adb_serials["!"] = f"adb not found at {ADB}"
        return
    while True:
        r = run_hidden([ADB, "devices"])
        seen = set()
        if r is not None:
            for line in r.stdout.splitlines()[1:]:
                parts = line.split()
                if len(parts) >= 2 and parts[1] == "device":
                    seen.add(parts[0])
        for serial in seen:
            if serial not in adb_serials:
                adb_serials[serial] = apply_reverse(serial)
        for serial in list(adb_serials):
            if serial not in seen:
                del adb_serials[serial]  # replug will re-apply
        time.sleep(2)


# --- HTTP control API ----------------------------------------------------------


def get_status():
    with lock:
        cl = [{"addr": f"{c.addr[0]}:{c.addr[1]}", "sent": c.sent,
               "dropped": c.dropped, "queued": len(c.queue),
               "since": int(time.time() - c.since)} for c in clients]
    return {
        "capture": capture_status,
        "device": capture_device_name or "(default output)",
        "devices": [m.name for m in loopback_devices()],
        "default_output": sc.default_speaker().name,
        "speakers": [s.name for s in sc.all_speakers()],
        "monitor": monitor_device_name or "",
        "monitor_delay_ms": monitor_delay_ms,
        "monitor_status": monitor_status,
        "monitor_drops": monitor_drops,
        "clients": cl,
        "adb": adb_serials,
        "audio_port": AUDIO_PORT,
    }


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        global last_request, shutdown_at
        last_request = time.time()
        shutdown_at = None
        if self.path in ("/", "/audiobridge.html"):
            with open(os.path.join(DIR, "audiobridge.html"), "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/api/status":
            self.send_json(get_status())
        else:
            self.send_error(404)

    def do_POST(self):
        global last_request, shutdown_at, capture_device_name, \
            capture_generation, monitor_device_name, monitor_delay_ms, \
            monitor_generation
        last_request = time.time()
        if self.path == "/api/shutdown":
            shutdown_at = time.time() + SHUTDOWN_GRACE
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        shutdown_at = None
        if self.path == "/api/device":
            n = int(self.headers.get("Content-Length", 0))
            name = json.loads(self.rfile.read(n)).get("device")
            with lock:
                capture_device_name = name or None
                capture_generation += 1
            save_settings()
            self.send_json({"ok": True})
        elif self.path == "/api/monitor":
            n = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(n))
            with lock:
                if "device" in body:
                    monitor_device_name = body["device"] or None
                    monitor_generation += 1
                    monitor_queue.clear()
                # Prefer relative steps: the server owning the arithmetic is
                # what keeps a panel's stale cached value (or a second panel)
                # from silently undoing an earlier adjustment.
                if "delay_step" in body:
                    monitor_delay_ms = max(0, min(
                        monitor_delay_ms + int(body["delay_step"]),
                        MAX_DELAY_MS))
                elif "delay_ms" in body:
                    monitor_delay_ms = max(
                        0, min(int(body["delay_ms"]), MAX_DELAY_MS))
                update_capture_wanted()
            save_settings()
            self.send_json({"ok": True, "monitor": monitor_device_name or "",
                            "delay_ms": monitor_delay_ms})
        elif self.path == "/api/reverse":
            for serial in list(adb_serials):
                if serial != "!":
                    adb_serials[serial] = apply_reverse(serial)
            self.send_json({"ok": True, "adb": adb_serials})
        else:
            self.send_error(404)


def watchdog():
    while True:
        time.sleep(2)
        if shutdown_at is not None and time.time() > shutdown_at:
            os._exit(0)
        if time.time() - last_request > IDLE_TIMEOUT:
            os._exit(0)


def main():
    load_settings()
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", HTTP_PORT),
                                                 Handler)
    except OSError:
        sys.exit(0)  # already running
    with lock:
        update_capture_wanted()  # a saved monitor device runs without clients
    threading.Thread(target=capture_loop, daemon=True).start()
    threading.Thread(target=monitor_loop, daemon=True).start()
    threading.Thread(target=audio_server, daemon=True).start()
    threading.Thread(target=adb_watcher, daemon=True).start()
    threading.Thread(target=watchdog, daemon=True).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
