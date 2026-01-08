// Nature sound synthesis using Web Audio API
// Independent from visual animations, lightweight, easily expandable

// Sound type configurations
const SOUND_CONFIGS = {
    cricket: {
        enabled: true,
        volume: 0.01,           // Volume (0-1)
        type: 'interval',       // Plays at random intervals
        minInterval: 2000,      // Min ms between chirps
        maxInterval: 8000,      // Max ms between chirps
        chirpsPerBurst: 3,      // Chirps in each burst
        chirpDuration: 50,      // Duration of each chirp in ms
        chirpGap: 100,          // Gap between chirps in burst
        baseFrequency: 4500,    // Base frequency in Hz
        frequencyVariation: 200 // Random variation
    },
    rain_background: {
        enabled: true,
        volume: 0.005,          // Subtle background rain noise (reduced)
        type: 'continuous',     // Continuous white noise base layer
    },
    rain: {
        enabled: true,
        volume: 0.05,           // Volume for individual drops
        type: 'interval',       // Individual raindrops layered on top
        minInterval: 80,        // Min ms between drops (more frequent)
        maxInterval: 250,       // Max ms between drops
        dropDuration: 50,       // Duration of each drop sound in ms
        baseFrequency: 800,     // Base frequency for drop impact
        frequencyVariation: 400 // Random variation
    }
    // Future sounds easily added:
    // mosquito: {
    //     enabled: true,
    //     type: 'interval',
    //     volume: 0.03,
    //     minInterval: 10000,
    //     maxInterval: 30000,
    //     duration: 2000,
    //     baseFrequency: 600,
    //     frequencyVariation: 50
    // }
};

class SoundGenerator {
    constructor(themeHandler) {
        this.themeHandler = themeHandler;
        this.audioContext = null;
        this.masterGain = null;
        this.isMuted = false;
        this.isInitialized = false;
        this.isPageVisible = !document.hidden; // Track page visibility
        this.scheduledSounds = new Map(); // Track scheduled interval sounds
        this.continuousSounds = new Map(); // Track continuous sounds
        this.soundConfigs = SOUND_CONFIGS;

        // Don't initialize AudioContext yet (autoplay policy)
        this.setupUserInteractionListener();
        this.setupVisibilityListener();
    }

    setupUserInteractionListener() {
        // Initialize on first user interaction (click/touch/key)
        const initOnInteraction = () => {
            if (!this.isInitialized) {
                this.initializeAudio();
            }
        };

        // Listen to multiple interaction types
        ['click', 'touchstart', 'keydown'].forEach(eventType => {
            document.addEventListener(eventType, initOnInteraction, { once: true });
        });
    }

    setupVisibilityListener() {
        // Pause sounds when page is hidden, resume when visible
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;

            if (this.isPageVisible) {
                // Page became visible - resume sound scheduling
                this.resumeSoundGeneration();
            } else {
                // Page became hidden - stop scheduling new sounds
                this.pauseSoundGeneration();
            }
        });
    }

    initializeAudio() {
        if (this.isInitialized) return;

        try {
            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create master gain node for volume control
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.isMuted ? 0 : 0.3; // Default volume 30%

            this.isInitialized = true;
            console.log('Nature sounds initialized');

            // Start sound generation immediately
            // Use setTimeout 0 to ensure AudioContext is fully ready
            setTimeout(() => {
                this.startSoundGeneration();
            }, 0);
        } catch (error) {
            console.warn('Failed to initialize audio:', error);
        }
    }

    startSoundGeneration() {
        console.log('Starting sound generation...');
        // Start each enabled sound type
        Object.entries(this.soundConfigs).forEach(([soundType, config]) => {
            if (config.enabled) {
                console.log(`Scheduling ${soundType} (type: ${config.type})`);
                if (config.type === 'interval') {
                    // Play immediately on initialization for interval sounds
                    this.scheduleNextSound(soundType, config, true);
                } else if (config.type === 'continuous') {
                    // Start continuous sounds
                    this.startContinuousSound(soundType, config);
                }
            }
        });
    }

    scheduleNextSound(soundType, config, playImmediately = false) {
        if (!this.isInitialized || !this.audioContext) return;

        // Play immediately if this is the first call
        if (playImmediately) {
            this.playSound(soundType, config);
        }

        // Random interval between min and max
        const interval = config.minInterval +
            Math.random() * (config.maxInterval - config.minInterval);

        const timeoutId = setTimeout(() => {
            this.playSound(soundType, config);
            // Schedule next occurrence
            this.scheduleNextSound(soundType, config);
        }, interval);

        // Track timeout for cleanup
        this.scheduledSounds.set(soundType, timeoutId);
    }

    playSound(soundType, config) {
        if (!this.audioContext || this.isMuted || !this.isPageVisible) return;

        // Route to appropriate synthesis method
        switch (soundType) {
            case 'cricket':
                this.synthesizeCricket(config);
                break;
            case 'rain':
                this.synthesizeRain(config);
                break;
            // Future sounds:
            // case 'mosquito':
            //     this.synthesizeMosquito(config);
            //     break;
        }
    }

    startContinuousSound(soundType, config) {
        if (!this.audioContext || !this.isPageVisible) return;

        // Stop any existing instance first
        this.stopContinuousSound(soundType);

        // Route to appropriate continuous sound method
        switch (soundType) {
            case 'rain_background':
                this.synthesizeRainBackground(config);
                break;
        }
    }

    stopContinuousSound(soundType) {
        const soundNodes = this.continuousSounds.get(soundType);
        if (soundNodes) {
            // Stop and disconnect all nodes
            soundNodes.forEach(node => {
                try {
                    if (node.stop) node.stop();
                    if (node.disconnect) node.disconnect();
                } catch (e) {
                    // Ignore errors from already stopped nodes
                }
            });
            this.continuousSounds.delete(soundType);
        }
    }

    synthesizeCricket(config) {
        const now = this.audioContext.currentTime;

        // Create a burst of chirps
        for (let i = 0; i < config.chirpsPerBurst; i++) {
            // Add small buffer (10ms) to ensure sound starts immediately
            const chirpStartTime = now + 0.01 + (i * (config.chirpDuration + config.chirpGap) / 1000);
            this.createChirp(chirpStartTime, config);
        }
    }

    createChirp(startTime, config) {
        // Oscillator for the chirp tone
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Random frequency variation for natural sound
        const frequency = config.baseFrequency +
            (Math.random() - 0.5) * config.frequencyVariation;

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine'; // Pure tone for cricket

        // Connect nodes: Oscillator -> Gain -> Master
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Envelope: Quick attack, quick release
        const duration = config.chirpDuration / 1000;
        const attackTime = 0.002; // 2ms attack
        const releaseTime = 0.01;  // 10ms release

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(config.volume, startTime + attackTime);
        gainNode.gain.linearRampToValueAtTime(config.volume, startTime + duration - releaseTime);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        // Start and stop
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);

        // Cleanup
        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    }

    synthesizeRain(config) {
        const now = this.audioContext.currentTime;
        // Add small buffer (10ms) to ensure sound starts immediately
        this.createRaindrop(now + 0.01, config);
    }

    createRaindrop(startTime, config) {
        // Create a short burst of filtered noise for raindrop impact
        const bufferSize = this.audioContext.sampleRate * 0.1; // 100ms buffer
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        // Fill with white noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        // Create buffer source
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        // Random frequency for variation in drop sound
        const frequency = config.baseFrequency +
            (Math.random() - 0.5) * config.frequencyVariation;

        // Bandpass filter to shape the drop sound
        const bandpass = this.audioContext.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = frequency;
        bandpass.Q.value = 5; // Narrow band for distinct drop sound

        // Gain for envelope and volume
        const gainNode = this.audioContext.createGain();

        // Connect: Noise -> Bandpass -> Gain -> Master
        noise.connect(bandpass);
        bandpass.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Envelope: Sharp attack, quick decay (like a water drop impact)
        const duration = config.dropDuration / 1000;
        const attackTime = 0.001; // Very fast attack
        const decayTime = duration * 0.3; // 30% of duration for decay

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(config.volume, startTime + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + decayTime);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        // Start and stop
        noise.start(startTime);
        noise.stop(startTime + duration);

        // Cleanup
        noise.onended = () => {
            noise.disconnect();
            bandpass.disconnect();
            gainNode.disconnect();
        };
    }

    synthesizeRainBackground(config) {
        // Create continuous white noise for rain background
        const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds of noise
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        // Fill with white noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        // Create buffer source
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true; // Loop the noise

        // Create filters to shape into rain-like sound
        const highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 400; // Cut very low frequencies
        highpass.Q.value = 0.5;

        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 3000; // Cut high frequencies
        lowpass.Q.value = 0.5;

        // Create gain for volume control
        const rainGain = this.audioContext.createGain();
        rainGain.gain.value = config.volume;

        // Connect: Noise -> Highpass -> Lowpass -> Gain -> Master
        noise.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(rainGain);
        rainGain.connect(this.masterGain);

        // Start the background rain
        noise.start();

        // Store nodes for cleanup
        this.continuousSounds.set('rain_background', [noise, highpass, lowpass, rainGain]);
    }

    // Public API for mute control
    toggleMute() {
        this.isMuted = !this.isMuted;

        if (this.masterGain) {
            // Smooth fade to avoid clicks
            const now = this.audioContext.currentTime;
            this.masterGain.gain.linearRampToValueAtTime(
                this.isMuted ? 0 : 0.3,
                now + 0.05
            );
        }

        return this.isMuted;
    }

    setMuted(muted) {
        if (this.isMuted !== muted) {
            this.toggleMute();
        }
    }

    getMuted() {
        return this.isMuted;
    }

    // Pause sound generation (when page becomes hidden)
    pauseSoundGeneration() {
        // Clear all scheduled interval sounds
        this.scheduledSounds.forEach(timeoutId => clearTimeout(timeoutId));
        this.scheduledSounds.clear();

        // Stop all continuous sounds
        Object.entries(this.soundConfigs).forEach(([soundType, config]) => {
            if (config.type === 'continuous') {
                this.stopContinuousSound(soundType);
            }
        });
    }

    // Resume sound generation (when page becomes visible)
    resumeSoundGeneration() {
        if (!this.isInitialized || !this.audioContext) return;

        // Restart scheduling for all enabled sound types
        Object.entries(this.soundConfigs).forEach(([soundType, config]) => {
            if (config.enabled) {
                if (config.type === 'interval') {
                    // Play immediately when resuming
                    this.scheduleNextSound(soundType, config, true);
                } else if (config.type === 'continuous') {
                    // Restart continuous sounds
                    this.startContinuousSound(soundType, config);
                }
            }
        });
    }

    // Cleanup method
    destroy() {
        // Clear all scheduled interval sounds
        this.scheduledSounds.forEach(timeoutId => clearTimeout(timeoutId));
        this.scheduledSounds.clear();

        // Stop all continuous sounds
        Object.entries(this.soundConfigs).forEach(([soundType, config]) => {
            if (config.type === 'continuous') {
                this.stopContinuousSound(soundType);
            }
        });

        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    // Theme update (for future use - could adjust sound based on theme)
    updateTheme() {
        // Could adjust volume or sound characteristics based on theme
        // Currently no-op, but follows the pattern
    }
}
