package net.sarefo.audiobridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.IBinder
import java.io.DataInputStream
import java.net.InetSocketAddress
import java.net.Socket

/**
 * Foreground service: pulls raw PCM from the PC (127.0.0.1:44100 via
 * `adb reverse`) and plays it through a low-latency AudioTrack.
 *
 * Wire format: 12-byte header ("ABR1", rate u32 LE, channels u8, bits u8,
 * reserved u16), then unframed int16 LE interleaved frames forever.
 */
class AudioService : Service() {

    companion object {
        const val PORT = 44100
        const val CHANNEL_ID = "audiobridge"

        // Skip backlog beyond ~62 ms so PC/phone clock drift cannot pile up.
        const val RESYNC_BYTES = 12_000

        // Extra playback delay to line this device up with slower ones
        // (typically: match a phone whose Bluetooth headset lags more).
        // Set from MainActivity, persisted per device, live-adjustable.
        @Volatile var delayMs: Int = 0

        // Polled by MainActivity; written only from the stream thread.
        @Volatile var state: String = "disconnected"
        @Volatile var bufferedBytes: Int = 0
        @Volatile var underruns: Int = 0
        @Volatile var resyncs: Int = 0
        @Volatile var running: Boolean = false
    }

    private var thread: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (thread != null) return START_STICKY
        delayMs = getSharedPreferences("audiobridge", MODE_PRIVATE)
            .getInt("delay_ms", 0)
        startForegroundWithNotification()
        running = true
        thread = Thread(::streamLoop, "audio-stream").also { it.start() }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        thread?.interrupt()
        thread = null
        state = "disconnected"
        super.onDestroy()
    }

    private fun streamLoop() {
        while (running) {
            try {
                state = "connecting…"
                connectAndPlay()
            } catch (e: InterruptedException) {
                break
            } catch (e: Exception) {
                state = "waiting for PC (${e.javaClass.simpleName})"
            }
            // Server gone or connect refused: retry until the user stops us.
            try {
                Thread.sleep(2000)
            } catch (e: InterruptedException) {
                break
            }
        }
        state = "disconnected"
    }

    private fun connectAndPlay() {
        Socket().use { sock ->
            // Small receive buffer so TCP itself cannot hoard latency.
            sock.receiveBufferSize = 8192
            sock.tcpNoDelay = true
            sock.connect(InetSocketAddress("127.0.0.1", PORT), 3000)
            // The server streams continuously (silence included) to every
            // connected client, so 5 s without data can only mean the adb
            // tunnel died. Without this, a dead link keeps showing "playing".
            sock.soTimeout = 5000

            val input = DataInputStream(sock.getInputStream())
            val header = ByteArray(12)
            input.readFully(header)
            require(
                header[0] == 'A'.code.toByte() && header[1] == 'B'.code.toByte() &&
                header[2] == 'R'.code.toByte() && header[3] == '1'.code.toByte()
            ) { "bad magic" }
            val rate = (header[4].toInt() and 0xFF) or
                ((header[5].toInt() and 0xFF) shl 8) or
                ((header[6].toInt() and 0xFF) shl 16) or
                ((header[7].toInt() and 0xFF) shl 24)
            val channels = header[8].toInt() and 0xFF
            require(channels == 2 && header[9].toInt() == 16) { "unexpected format" }

            val track = buildTrack(rate)
            try {
                track.play()
                state = "playing @ ${rate / 1000} kHz"

                // Write in the device's native mixer-burst size to stay on the
                // fast path.
                val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                val burstFrames = am
                    .getProperty(AudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER)
                    ?.toIntOrNull() ?: 240
                val buf = ByteArray(burstFrames * channels * 2)
                val bytesPerMs = rate * channels * 2 / 1000

                // Sync-delay line: hold delayMs worth of audio between the
                // socket and the AudioTrack. The socket stays fully drained
                // (so the drift resync below keeps working); the FIFO adds a
                // constant, user-tunable offset. Raising the delay pauses
                // output while the line refills (a silence gap = the added
                // delay); lowering it discards the oldest surplus.
                val fifo = ArrayDeque<ByteArray>()
                var fifoBytes = 0

                while (running) {
                    // Drift bound: if more than RESYNC_BYTES piled up while we
                    // were blocked in write(), drop the backlog and jump to live.
                    val backlog = input.available()
                    if (backlog > RESYNC_BYTES) {
                        input.skipBytes(backlog - backlog % buf.size)
                        resyncs++
                    }
                    input.readFully(buf)
                    fifo.addLast(buf.copyOf())
                    fifoBytes += buf.size

                    val targetBytes = delayMs * bytesPerMs
                    while (fifoBytes > targetBytes + 2 * buf.size) {
                        fifoBytes -= fifo.removeFirst().size  // delay lowered
                    }
                    if (fifoBytes > targetBytes) {
                        val b = fifo.removeFirst()
                        fifoBytes -= b.size
                        track.write(b, 0, b.size)
                    }
                    bufferedBytes = input.available()
                    underruns = track.underrunCount
                }
            } finally {
                track.release()
            }
        }
    }

    private fun buildTrack(rate: Int): AudioTrack {
        val format = AudioFormat.Builder()
            .setSampleRate(rate)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
            .build()
        val minBuf = AudioTrack.getMinBufferSize(
            rate, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT
        )
        return AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(format)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
            .setBufferSizeInBytes(minBuf * 2)
            .build()
    }

    private fun startForegroundWithNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID, "Audio Bridge",
                NotificationManager.IMPORTANCE_LOW
            )
        )
        val tap = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("Audio Bridge")
            .setContentText("Streaming PC audio over USB")
            .setContentIntent(tap)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(
                1, notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(1, notification)
        }
    }
}
