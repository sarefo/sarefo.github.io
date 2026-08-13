package net.sarefo.audiobridge

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.TextView

class MainActivity : Activity() {

    private lateinit var status: TextView
    private lateinit var stats: TextView
    private lateinit var toggle: Button
    private val handler = Handler(Looper.getMainLooper())

    private val refresh = object : Runnable {
        override fun run() {
            status.text = AudioService.state
            toggle.text = if (AudioService.running) "Disconnect" else "Connect"
            stats.text = if (AudioService.running) {
                val ms = AudioService.bufferedBytes / 192  // 192 bytes per ms
                "backlog %3d ms   underruns %d   resyncs %d"
                    .format(ms, AudioService.underruns, AudioService.resyncs)
            } else ""
            handler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        status = findViewById(R.id.status)
        stats = findViewById(R.id.stats)
        toggle = findViewById(R.id.toggle)

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(
                arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1
            )
        }

        toggle.setOnClickListener {
            val intent = Intent(this, AudioService::class.java)
            if (AudioService.running) stopService(intent)
            else startForegroundService(intent)
        }
    }

    override fun onResume() {
        super.onResume()
        handler.post(refresh)
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(refresh)
    }
}
