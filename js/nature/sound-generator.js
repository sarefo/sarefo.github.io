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
    },
    mosquito: {
        enabled: true,
        volume: 0.005,          // Subtle buzzing
        type: 'interval',       // Occasional buzzing
        minInterval: 30000,     // Min 30 seconds between buzzes
        maxInterval: 90000,     // Max 1.5 minutes between buzzes
        duration: 2000,         // 2 second buzz duration
        baseFrequency: 800,     // Base frequency for wing beat buzz
        frequencyVariation: 100 // Random variation for natural sound
    },
    toad: {
        enabled: true,
        volume: 0.015,          // Volume for toad call
        type: 'interval',       // Occasional calls
        minInterval: 20000,     // Min 20 seconds between calls
        maxInterval: 60000,     // Max 60 seconds between calls
        croaksPerCall: 3,       // Number of croaks in a sequence
        croakDuration: 200,     // Duration of each croak in ms
        croakGap: 150,          // Gap between croaks in ms
        baseFrequency: 400,     // Starting frequency for croak
        frequencyDrop: 150      // How much pitch drops during croak
    },
    songbird: {
        enabled: true,
        volume: 0.012,          // Volume for bird chirp
        type: 'interval',       // Occasional chirping
        minInterval: 15000,     // Min 15 seconds between chirps
        maxInterval: 45000,     // Max 45 seconds between chirps
        notesPerSong: 5,        // Number of notes in a song
        noteDuration: 120,      // Duration of each note in ms
        noteGap: 80,            // Gap between notes in ms
        minFrequency: 2000,     // Min frequency for sweep (2kHz)
        maxFrequency: 7000,     // Max frequency for sweep (7kHz)
        frequencyVariation: 500 // Random variation in sweep range
    },
    owl: {
        enabled: true,
        volume: 0.018,          // Volume for owl hoot
        type: 'interval',       // Occasional hooting
        minInterval: 40000,     // Min 40 seconds between hoots
        maxInterval: 120000,    // Max 2 minutes between hoots
        hootsPerCall: 4,        // Number of hoots (hoo-h'HOO-hoo-hoo pattern)
        hootDurations: [300, 150, 300, 300], // Duration pattern in ms
        hootGaps: [400, 200, 400], // Gaps between hoots in ms
        baseFrequency: 950,     // Fundamental frequency
        harmonics: [2, 3, 4]    // Harmonic multipliers
    }
};

class SoundGenerator {
    constructor(themeHandler) {
        this.themeHandler = themeHandler;
        this.audioContext = null;
        this.masterGain = null;
        this.isMuted = true; // Start muted (audio not initialized yet)
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
                    // Don't play immediately - let each sound start at a random time
                    this.scheduleNextSound(soundType, config, false);
                } else if (config.type === 'continuous') {
                    // Start continuous sounds immediately
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
            case 'mosquito':
                this.synthesizeMosquito(config);
                break;
            case 'toad':
                this.synthesizeToad(config);
                break;
            case 'songbird':
                this.synthesizeSongbird(config);
                break;
            case 'owl':
                this.synthesizeOwl(config);
                break;
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

    synthesizeMosquito(config) {
        const now = this.audioContext.currentTime;
        const startTime = now + 0.01;
        const duration = config.duration / 1000;

        // Random base frequency for variation
        const frequency = config.baseFrequency +
            (Math.random() - 0.5) * config.frequencyVariation;

        // Main oscillator - sawtooth for mosquito buzz
        const oscillator = this.audioContext.createOscillator();
        oscillator.frequency.value = frequency;
        oscillator.type = 'sawtooth'; // Best represents mosquito sound

        // Frequency modulation - smooth sine wave for closer/further effect
        const fmOscillator = this.audioContext.createOscillator();
        const fmGain = this.audioContext.createGain();
        fmOscillator.frequency.value = 6; // 6 Hz modulation for natural variation
        fmGain.gain.value = 40; // Subtle frequency wobble
        fmOscillator.type = 'sine';
        fmOscillator.connect(fmGain);
        fmGain.connect(oscillator.detune);

        // Stereo panner for spatial movement
        const panner = this.audioContext.createStereoPanner();

        // Random wandering pan with bias toward one side
        const startPan = Math.random() > 0.5 ? -0.8 : 0.8; // Start near left or right
        const endPan = -startPan; // End on opposite side
        const wanderPoints = 8; // Number of random direction changes

        panner.pan.setValueAtTime(startPan, startTime);

        // Create random wandering path while trending toward end position
        for (let i = 1; i <= wanderPoints; i++) {
            const t = startTime + (duration * i / wanderPoints);
            const progress = i / wanderPoints;

            // Interpolate between start and end with random variation
            const targetPan = startPan + (endPan - startPan) * progress;
            const randomOffset = (Math.random() - 0.5) * 0.4; // Random wander ±0.2
            const panValue = Math.max(-1, Math.min(1, targetPan + randomOffset));

            panner.pan.linearRampToValueAtTime(panValue, t);
        }

        // Ensure we end at the target
        panner.pan.linearRampToValueAtTime(endPan, startTime + duration);

        // Gain for envelope and volume with random variation
        const gainNode = this.audioContext.createGain();

        // Connect: Oscillator -> Panner -> Gain -> Master
        oscillator.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Envelope with random volume variation
        const fadeInTime = 0.3;
        const fadeOutTime = 0.5;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(config.volume, startTime + fadeInTime);

        // Add random volume fluctuations during the middle section
        const volumePoints = 6;
        for (let i = 0; i < volumePoints; i++) {
            const t = startTime + fadeInTime + ((duration - fadeInTime - fadeOutTime) * i / volumePoints);
            const volumeVariation = config.volume * (0.85 + Math.random() * 0.3); // ±15% variation
            gainNode.gain.linearRampToValueAtTime(volumeVariation, t);
        }

        gainNode.gain.linearRampToValueAtTime(config.volume, startTime + duration - fadeOutTime);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        // Start oscillators
        fmOscillator.start(startTime);
        oscillator.start(startTime);

        // Stop oscillators
        fmOscillator.stop(startTime + duration);
        oscillator.stop(startTime + duration);

        // Cleanup
        oscillator.onended = () => {
            fmOscillator.disconnect();
            fmGain.disconnect();
            oscillator.disconnect();
            panner.disconnect();
            gainNode.disconnect();
        };
    }

    synthesizeToad(config) {
        const now = this.audioContext.currentTime;

        // Create a sequence of individual croaks
        for (let i = 0; i < config.croaksPerCall; i++) {
            const croakStart = now + 0.01 + (i * (config.croakDuration + config.croakGap) / 1000);
            this.createSingleCroak(croakStart, config);
        }
    }

    createSingleCroak(startTime, config) {
        const duration = config.croakDuration / 1000;

        // Random variation for this croak
        const freqVariation = (Math.random() - 0.5) * 80;
        const startFreq = config.baseFrequency + freqVariation;
        const endFreq = startFreq - config.frequencyDrop;

        // Main oscillator - sine wave, cleaner base
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, startTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration * 0.8);

        // Second oscillator slightly detuned for thickness
        const osc2 = this.audioContext.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(startFreq * 1.01, startTime);
        osc2.frequency.exponentialRampToValueAtTime(endFreq * 1.01, startTime + duration * 0.8);

        // Third oscillator one octave up for brightness
        const osc3 = this.audioContext.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(startFreq * 2, startTime);
        osc3.frequency.exponentialRampToValueAtTime(endFreq * 2, startTime + duration * 0.8);

        // Resonant filter to shape the tone
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(startFreq * 2, startTime);
        filter.frequency.exponentialRampToValueAtTime(endFreq * 1.5, startTime + duration * 0.8);
        filter.Q.value = 2;

        // Gain nodes
        const oscGain = this.audioContext.createGain();
        const osc2Gain = this.audioContext.createGain();
        const osc3Gain = this.audioContext.createGain();
        const outputGain = this.audioContext.createGain();

        // Mix levels
        oscGain.gain.value = 1.0;
        osc2Gain.gain.value = 0.5;
        osc3Gain.gain.value = 0.2;

        // Connect oscillators
        osc.connect(oscGain);
        osc2.connect(osc2Gain);
        osc3.connect(osc3Gain);

        oscGain.connect(filter);
        osc2Gain.connect(filter);
        osc3Gain.connect(filter);

        filter.connect(outputGain);
        outputGain.connect(this.masterGain);

        // Envelope - quick attack, sustain, quick release
        const attackTime = 0.015;
        const releaseTime = 0.04;

        outputGain.gain.setValueAtTime(0, startTime);
        outputGain.gain.linearRampToValueAtTime(config.volume, startTime + attackTime);
        outputGain.gain.setValueAtTime(config.volume, startTime + duration - releaseTime);
        outputGain.gain.linearRampToValueAtTime(0, startTime + duration);

        // Start and stop
        osc.start(startTime);
        osc2.start(startTime);
        osc3.start(startTime);

        osc.stop(startTime + duration + 0.05);
        osc2.stop(startTime + duration + 0.05);
        osc3.stop(startTime + duration + 0.05);

        // Cleanup
        osc.onended = () => {
            osc.disconnect();
            osc2.disconnect();
            osc3.disconnect();
            oscGain.disconnect();
            osc2Gain.disconnect();
            osc3Gain.disconnect();
            filter.disconnect();
            outputGain.disconnect();
        };
    }

    synthesizeSongbird(config) {
        const now = this.audioContext.currentTime;

        // Create a melodic sequence of notes with varying pitch
        for (let i = 0; i < config.notesPerSong; i++) {
            const noteStart = now + 0.01 + (i * (config.noteDuration + config.noteGap) / 1000);
            this.createBirdNote(noteStart, config, i);
        }
    }

    createBirdNote(startTime, config, noteIndex) {
        const duration = config.noteDuration / 1000;

        // Create melodic patterns - rising, falling, or warbling
        const patterns = [
            { type: 'rising', startMult: 0.7, endMult: 1.2 },
            { type: 'falling', startMult: 1.2, endMult: 0.7 },
            { type: 'warble', startMult: 1.0, endMult: 1.1 }
        ];
        const pattern = patterns[noteIndex % patterns.length];

        // Random frequency within songbird range
        const baseFreq = config.minFrequency +
            Math.random() * (config.maxFrequency - config.minFrequency);
        const variation = (Math.random() - 0.5) * config.frequencyVariation;

        const startFreq = (baseFreq + variation) * pattern.startMult;
        const endFreq = (baseFreq + variation) * pattern.endMult;

        // Main oscillator - sine wave for pure bird tone
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, startTime);

        // Smooth FM sweep for natural bird sound
        if (pattern.type === 'warble') {
            // Add vibrato for warbling effect
            const lfo = this.audioContext.createOscillator();
            const lfoGain = this.audioContext.createGain();
            lfo.frequency.value = 12; // 12 Hz vibrato
            lfoGain.gain.value = 30; // ±30 Hz modulation
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start(startTime);
            lfo.stop(startTime + duration);
        }

        osc.frequency.exponentialRampToValueAtTime(
            Math.max(100, endFreq), // Prevent frequency from going too low
            startTime + duration * 0.9
        );

        // Slight harmonic richness with triangle wave
        const osc2 = this.audioContext.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(startFreq * 2, startTime);
        osc2.frequency.exponentialRampToValueAtTime(
            Math.max(100, endFreq * 2),
            startTime + duration * 0.9
        );

        // Gain nodes for mixing
        const oscGain = this.audioContext.createGain();
        const osc2Gain = this.audioContext.createGain();
        const outputGain = this.audioContext.createGain();

        oscGain.gain.value = 1.0;
        osc2Gain.gain.value = 0.15; // Subtle harmonic

        // Connect
        osc.connect(oscGain);
        osc2.connect(osc2Gain);
        oscGain.connect(outputGain);
        osc2Gain.connect(outputGain);
        outputGain.connect(this.masterGain);

        // Envelope - quick attack, sustain, quick release for chirpy sound
        const attackTime = 0.005;
        const releaseTime = 0.02;

        outputGain.gain.setValueAtTime(0, startTime);
        outputGain.gain.linearRampToValueAtTime(config.volume, startTime + attackTime);
        outputGain.gain.setValueAtTime(config.volume, startTime + duration - releaseTime);
        outputGain.gain.linearRampToValueAtTime(0, startTime + duration);

        // Start and stop
        osc.start(startTime);
        osc2.start(startTime);
        osc.stop(startTime + duration);
        osc2.stop(startTime + duration);

        // Cleanup
        osc.onended = () => {
            osc.disconnect();
            osc2.disconnect();
            oscGain.disconnect();
            osc2Gain.disconnect();
            outputGain.disconnect();
        };
    }

    synthesizeOwl(config) {
        const now = this.audioContext.currentTime;

        // Create the hoo-h'HOO-hoo-hoo pattern
        let currentTime = now + 0.01;
        for (let i = 0; i < config.hootsPerCall; i++) {
            const hootDuration = config.hootDurations[i] / 1000;
            const isEmphasis = i === 1; // Second hoot is emphasized (h'HOO)
            this.createOwlHoot(currentTime, hootDuration, isEmphasis, config);

            currentTime += hootDuration;
            if (i < config.hootGaps.length) {
                currentTime += config.hootGaps[i] / 1000;
            }
        }
    }

    createOwlHoot(startTime, duration, isEmphasis, config) {
        const baseFreq = config.baseFrequency;

        // Create fundamental frequency
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = baseFreq;

        // Add harmonics for richer owl sound
        const harmonicOscs = [];
        const harmonicGains = [];

        config.harmonics.forEach((harmonic, index) => {
            const harmOsc = this.audioContext.createOscillator();
            harmOsc.type = 'sine';
            harmOsc.frequency.value = baseFreq * harmonic;

            const harmGain = this.audioContext.createGain();
            // Each harmonic gets progressively quieter
            harmGain.gain.value = 0.3 / (harmonic * 1.5);

            harmonicOscs.push(harmOsc);
            harmonicGains.push(harmGain);
        });

        // Lowpass filter for mellow owl tone
        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 2000;
        lowpass.Q.value = 1;

        // Main gain
        const outputGain = this.audioContext.createGain();

        // Connect fundamental
        osc.connect(lowpass);

        // Connect harmonics
        harmonicOscs.forEach((harmOsc, index) => {
            harmOsc.connect(harmonicGains[index]);
            harmonicGains[index].connect(lowpass);
        });

        lowpass.connect(outputGain);
        outputGain.connect(this.masterGain);

        // Envelope - emphasized hoot is louder
        const volume = isEmphasis ? config.volume * 1.5 : config.volume;
        const attackTime = isEmphasis ? 0.03 : 0.05;
        const releaseTime = duration * 0.4;

        outputGain.gain.setValueAtTime(0, startTime);
        outputGain.gain.linearRampToValueAtTime(volume, startTime + attackTime);
        outputGain.gain.setValueAtTime(volume * 0.9, startTime + duration * 0.3);
        outputGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        // Start all oscillators
        osc.start(startTime);
        harmonicOscs.forEach(harmOsc => harmOsc.start(startTime));

        // Stop all oscillators
        osc.stop(startTime + duration);
        harmonicOscs.forEach(harmOsc => harmOsc.stop(startTime + duration));

        // Cleanup
        osc.onended = () => {
            osc.disconnect();
            harmonicOscs.forEach(harmOsc => harmOsc.disconnect());
            harmonicGains.forEach(harmGain => harmGain.disconnect());
            lowpass.disconnect();
            outputGain.disconnect();
        };
    }

    // Public API for mute control
    toggleMute() {
        // Initialize audio on first unmute if not already initialized
        if (!this.isInitialized && this.isMuted) {
            this.initializeAudio();
        }

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

    getInitialized() {
        return this.isInitialized;
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
