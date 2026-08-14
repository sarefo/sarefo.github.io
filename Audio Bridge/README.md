# Audio Bridge

Streams this PC's audio to one or more Android phones over USB — a barebones,
self-owned AudioRelay equivalent. Raw 48 kHz stereo PCM over TCP, tunneled
through `adb reverse`, played by a tiny foreground-service app. No accounts,
no paywall, no Wi-Fi involved.

## One-time setup

1. **Phone:** enable Developer options → USB debugging, plug into the PC, and
   accept the "Allow USB debugging?" prompt.
2. **PC:** `py -m pip install soundcard numpy` (needed once).
3. **App:** run `build.bat` to build and install the client APK on every
   attached phone (needs internet on first build to fetch Gradle plugins).

## Daily use

1. Run `audiobridge.bat` — a small control panel opens.
2. Plug in the phone(s). The server applies the `adb reverse` tunnel to every
   USB-debugging device automatically within ~2 s.
3. On each phone, open **Audio Bridge** and tap **Connect**.
4. Play audio on the PC. Every connected phone plays it.

## Silent-PC mode

To hear audio **only** on the phones:

1. Set the Windows default output to a virtual device — this machine already
   has two: **Virtual Speakers (Virtual Speakers for AudioRelay)** or a
   Voicemeeter input. (Quick path: click the speaker icon in the system tray
   and pick it from the output list.)
2. In the panel, select that same device as the capture device (it defaults to
   whatever the Windows default output is).

Switching the Windows default output back to real speakers instantly restores
local sound. The capture is non-destructive either way — with the default
output on real speakers you get PC + phones simultaneously.

## Watching video in sync (lip sync for everyone)

Every listener sits at a different latency: the laptop's own Bluetooth headset,
each phone's Bluetooth earphones, each phone's USB hop. **Audio can only be
delayed, never advanced**, so syncing is always "push everyone back to the
slowest listener", then "push the video back to match all of them".

### 1. Put the laptop on a delayable path

Windows has no delay control for its own output, so route the laptop's own
listening through the bridge:

1. Set the Windows default output to a **virtual** device (silent-PC mode above).
2. In the panel, set **Laptop monitor** to the real headphones (e.g.
   `Headphones (WH-1000XM4)`).

The laptop now hears the audio through the bridge, with its own delay control.
Monitor and capture must be *different* devices — the panel refuses the same one,
since capturing what you play to feeds back.

### 2. Align the listeners to each other

Hold two headsets to your ears (or use two people) and raise the delay on the
**faster** side until the echo collapses into one sound:

- laptop: the panel's monitor ±50 / ±250 ms buttons
- each phone: the same buttons in the app, saved per device

### 3. Align the video to the audio

Now that everyone shares one audio timeline, one player setting fixes lips for
all of them. The audio is *late*, so the video must be held back — i.e. shift
audio **earlier** relative to video:

| Player | Control |
|---|---|
| PotPlayer | `Shift + >` audio earlier, `Shift + <` later, `Shift + /` reset (0.05 s steps) |
| VLC | `j` audio earlier, `k` later (50 ms steps) |
| mpv | `Ctrl + -` / `Ctrl + +`, or `--audio-delay=-0.25` |

Typical total is 150–350 ms depending on the headsets. Calibrate once against a
clip with sharp visual transients (a clapperboard or an A/V-sync test video) and
the setting sticks per player.

**YouTube in a browser has no A/V-sync control**, so it cannot be corrected —
open the URL in mpv or PotPlayer instead (both accept a YouTube URL via yt-dlp)
and use the table above.

## How it works

```
Windows audio ──WASAPI loopback──> audiobridge_server.py ──TCP 127.0.0.1:44100──┐
                                                                                │
              phone A: localhost:44100 <──adb reverse (USB)────────────────────┤
              phone B: localhost:44100 <──adb reverse (USB)────────────────────┘
```

- Wire format: 12-byte header (`ABR1`, rate, channels, bits), then unframed
  int16 LE stereo PCM. ~1.5 Mbit/s — trivial over USB, so no codec.
- Each client has its own bounded queue; a slow phone drops its own oldest
  audio and never stalls the capture or other phones.
- The app bounds drift: a small TCP receive buffer plus a resync that skips
  any backlog over ~62 ms. The panel and the app both show drop/underrun
  counters, so latency problems are visible instead of guessed at.
- **Laptop monitor**: an optional local player fed from the same capture, so
  this PC's own headphones become a delayable listener like the phones. Off by
  default; refuses to run on the capture device itself.
- **Sync delay** (in the app, saved per device): each phone's output chain —
  especially its Bluetooth headset — adds its own latency, so multiple phones
  drift apart audibly. Raise the delay on the *faster* phone (±50/±250 ms
  buttons, live while playing) until they match. Delay can only be added, not
  removed: everything syncs to the slowest device.
- Port 44100 (not 47000+) because this machine silently reserves
  ~45000–48100 for Hyper-V/WSL NAT — binds there fail even though
  `netsh int ipv4 show excludedportrange` doesn't list them.

## Files

| File | Role |
|---|---|
| `audiobridge_server.py` | capture, TCP fan-out, adb watcher, control API (port 8400) |
| `audiobridge.html` | control panel (Chrome `--app` window) |
| `audiobridge.bat` | launcher |
| `build.bat` | headless APK build + install (pins JAVA_HOME to Android Studio's JBR) |
| `android/` | Kotlin client — plain Activity + AudioTrack, zero dependencies |
