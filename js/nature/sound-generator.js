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
        volume: 0.016,          // Peak volume of a single note
        type: 'interval',       // One bird sings a bout, then a pause
        minInterval: 15000,     // Min 15 seconds between bouts
        maxInterval: 45000,     // Max 45 seconds between bouts
        songsPerBout: [2, 4],   // A bird repeats its song a few times per bout
        songGap: [1.8, 4.0],    // Seconds of silence between songs in a bout
        reverbSend: 0.35,       // Base amount of forest reverb (grows with distance)
        // Resident birds, each with its own species, position and voice.
        // distance 0 = close and bright, 1 = far, dull and reverberant
        birds: [
            { species: 'greatTit',  pan: -0.55, distance: 0.25 },
            { species: 'chaffinch', pan:  0.45, distance: 0.45 },
            { species: 'blackbird', pan: -0.15, distance: 0.7 }
        ]
    },
    owl: {
        enabled: true,
        volume: 0.018,          // Volume for owl hoot
        type: 'interval',       // Occasional hooting
        minInterval: 40000,     // Min 40 seconds between hoots
        maxInterval: 120000,    // Max 2 minutes between hoots
        hootsPerCall: 4,        // Number of hoots (hoo-h'HOO-hoo-hoo pattern)
        hootDurations: [400, 600, 400, 500], // Duration pattern in ms
        hootGaps: [300, 150, 350], // Gaps between hoots in ms
        baseFrequency: 300,     // Fundamental frequency (~Great Horned Owl)
        emphasisFrequency: 340, // h'HOO is higher-pitched
        pitchGlide: 0.92,      // Subtle downward pitch bend
        filterCutoff: 700,      // Lowpass cutoff for mellow tone
        vibratoRate: 2.5,       // Subtle organic wobble (Hz)
        vibratoDepth: 3,        // Vibrato depth in cents
        breathiness: 0.35,      // Breath noise layer gain multiplier
        breathFilterFreq: 400,  // Bandpass center for breath noise
        breathFilterQ: 1.2      // Bandwidth of breath filter
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
        this.createDebugPanel();
    }

    createDebugPanel() {
        if (!new URLSearchParams(window.location.search).has('sound-debug')) return;

        const panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;bottom:16px;left:16px;background:rgba(0,0,0,0.85);' +
            'color:#fff;padding:12px;border-radius:8px;z-index:99999;font:12px/1.4 monospace;' +
            'display:flex;flex-wrap:wrap;gap:6px;max-width:260px;align-items:center;';

        const title = document.createElement('div');
        title.textContent = 'Sound Debug';
        title.style.cssText = 'width:100%;font-weight:bold;margin-bottom:4px;';
        panel.appendChild(title);

        const soundTypes = Object.entries(this.soundConfigs)
            .filter(([, cfg]) => cfg.type === 'interval');

        soundTypes.forEach(([soundType, config]) => {
            const btn = document.createElement('button');
            btn.textContent = soundType.charAt(0).toUpperCase() + soundType.slice(1);
            btn.style.cssText = 'padding:10px 16px;border:1px solid #555;border-radius:4px;' +
                'background:#333;color:#fff;cursor:pointer;font:14px monospace;min-height:44px;';
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!this.isInitialized) this.initializeAudio(false);
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                this.isMuted = false;
                this.masterGain.gain.value = 0.3;
                console.log(`[Sound Debug] Playing: ${soundType}`, config);
                this.playSound(soundType, config);
            });
            panel.appendChild(btn);
        });

        // Prevent any panel clicks from reaching the document listener
        panel.addEventListener('click', (e) => e.stopPropagation());
        panel.addEventListener('touchstart', (e) => e.stopPropagation());

        document.body.appendChild(panel);
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

    initializeAudio(startSounds = true) {
        if (this.isInitialized) return;

        try {
            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create master gain node for volume control
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.isMuted ? 0 : 0.3; // Default volume 30%

            this.createReverb();

            this.isInitialized = true;

            // Start sound generation immediately
            // Use setTimeout 0 to ensure AudioContext is fully ready
            if (startSounds) setTimeout(() => {
                this.startSoundGeneration();
            }, 0);
        } catch (error) {
            console.warn('Failed to initialize audio:', error);
        }
    }

    // Shared forest-air reverb: sounds that want space connect a send to this.reverbBus
    createReverb() {
        const ctx = this.audioContext;
        const rate = ctx.sampleRate;
        const seconds = 1.8;
        const length = Math.floor(rate * seconds);
        const preDelay = Math.floor(rate * 0.018);
        const impulse = ctx.createBuffer(2, length, rate);

        // Decaying stereo noise that also darkens over time, since air and foliage
        // absorb high frequencies faster than low ones
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            let lowpassed = 0;
            for (let i = preDelay; i < length; i++) {
                const t = (i - preDelay) / rate;
                const smoothing = 0.85 * Math.exp(-t * 2.5) + 0.08;
                lowpassed += ((Math.random() * 2 - 1) - lowpassed) * smoothing;
                data[i] = lowpassed * Math.exp(-t * 3.8);
            }
        }

        const convolver = ctx.createConvolver();
        convolver.buffer = impulse;
        this.reverbBus = ctx.createGain();
        this.reverbBus.gain.value = 0.6;
        this.reverbBus.connect(convolver);
        convolver.connect(this.masterGain);
    }

    startSoundGeneration() {
        // Start each enabled sound type
        Object.entries(this.soundConfigs).forEach(([soundType, config]) => {
            if (config.enabled) {
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
        if (this.reverbBus) outputGain.connect(this.reverbBus);

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

    // --- Songbirds ---
    // Each resident bird is a fixed individual: its species decides the song
    // structure, and its own random "voice" (pitches, note counts, motifs) is
    // drawn once, so the same bird keeps singing recognizably the same song.
    // Notes are near-pure whistles whose pitch and loudness follow smooth
    // contours (setValueCurveAtTime), which is what makes them sound sung
    // rather than beeped.

    synthesizeSongbird(config) {
        if (!this.birds) {
            this.birds = config.birds.map(bird => ({ ...bird, voice: this.createBirdVoice(bird.species) }));
        }
        const bird = this.birds[Math.floor(Math.random() * this.birds.length)];
        const ctx = this.audioContext;

        // Per-bout signal chain: notes -> panner -> distance lowpass -> master (+ reverb send)
        const busGain = ctx.createGain();
        busGain.gain.value = config.volume * (1 - bird.distance * 0.45);
        const panner = ctx.createStereoPanner();
        panner.pan.value = bird.pan;
        const airFilter = ctx.createBiquadFilter();
        airFilter.type = 'lowpass';
        airFilter.frequency.value = 14000 - bird.distance * 8000;
        busGain.connect(panner);
        panner.connect(airFilter);
        airFilter.connect(this.masterGain);

        let send = null;
        if (this.reverbBus) {
            send = ctx.createGain();
            send.gain.value = config.reverbSend * (0.5 + bird.distance);
            airFilter.connect(send);
            send.connect(this.reverbBus);
        }

        const [minSongs, maxSongs] = config.songsPerBout;
        const songs = minSongs + Math.floor(Math.random() * (maxSongs - minSongs + 1));
        let t = ctx.currentTime + 0.05;
        for (let i = 0; i < songs; i++) {
            const notes = this.composeBirdSong(bird);
            notes.forEach(note => this.playBirdNote(t + note.t, note, busGain));
            const songEnd = Math.max(...notes.map(note => note.t + note.dur));
            t += songEnd + config.songGap[0] + Math.random() * (config.songGap[1] - config.songGap[0]);
        }

        // Tear the bus down once the bout and its reverb tail are over
        const boutMs = (t - ctx.currentTime) * 1000;
        setTimeout(() => {
            busGain.disconnect();
            panner.disconnect();
            airFilter.disconnect();
            if (send) send.disconnect();
        }, boutMs + 3000);
    }

    createBirdVoice(species) {
        const rand = (min, max) => min + Math.random() * (max - min);
        const randInt = (min, max) => Math.floor(rand(min, max + 1));

        switch (species) {
            case 'greatTit':
                // "tea-cher tea-cher": a high note, then a lower down-slurred one
                return {
                    high: rand(5600, 7000),
                    low: rand(3300, 4300),
                    reps: randInt(3, 6),
                    period: rand(0.22, 0.3)
                };
            case 'chaffinch':
                // Descending, accelerating trill ending in a "chew-ee-oo" flourish
                return {
                    trill1: { count: randInt(4, 6), from: rand(5600, 6400), to: rand(4800, 5300), spacing: rand(0.07, 0.085) },
                    trill2: { count: randInt(5, 8), from: rand(4300, 4700), to: rand(3300, 3700), spacing: rand(0.05, 0.06) },
                    flourishPeak: rand(4800, 5600)
                };
            case 'blackbird': {
                // Low, fluted phrases from a small personal repertoire, each followed by
                // a quiet high twitter
                const motifs = [];
                for (let m = 0; m < 4; m++) {
                    const notes = [];
                    const count = randInt(3, 5);
                    for (let n = 0; n < count; n++) {
                        const points = randInt(3, 5);
                        const contour = [];
                        let f = rand(1700, 2900);
                        for (let p = 0; p < points; p++) {
                            contour.push(f);
                            f = Math.min(3400, Math.max(1500, f * rand(0.82, 1.2)));
                        }
                        notes.push({ dur: rand(0.11, 0.32), gap: rand(0.03, 0.1), contour, gain: rand(0.7, 1) });
                    }
                    motifs.push(notes);
                }
                return { motifs };
            }
        }
        return null;
    }

    // Returns one song as a list of notes: { t, dur, f: [Hz contour], gain, vibrato? }
    composeBirdSong(bird) {
        const voice = bird.voice;
        const jitter = () => 1 + (Math.random() - 0.5) * 0.03; // Tiny song-to-song variation
        const notes = [];

        switch (bird.species) {
            case 'greatTit': {
                const reps = voice.reps + (Math.random() < 0.3 ? 1 : 0);
                for (let i = 0; i < reps; i++) {
                    const t = i * voice.period * jitter();
                    const fade = 1 - (i / reps) * 0.25; // Song tails off slightly
                    const hi = voice.high * jitter();
                    const lo = voice.low * jitter();
                    notes.push({ t, dur: 0.075, f: [hi * 1.02, hi, hi * 0.96], gain: 0.8 * fade });
                    notes.push({ t: t + 0.095, dur: 0.1, f: [lo * 1.25, lo * 1.02, lo * 0.9], gain: fade });
                }
                break;
            }
            case 'chaffinch': {
                let t = 0;
                [voice.trill1, voice.trill2].forEach((trill, phrase) => {
                    for (let i = 0; i < trill.count; i++) {
                        const f = (trill.from + (trill.to - trill.from) * i / (trill.count - 1)) * jitter();
                        const sweep = phrase === 0 ? [f * 1.12, f, f * 0.86] : [f * 1.3, f * 1.05, f * 0.72];
                        notes.push({ t, dur: phrase === 0 ? 0.04 : 0.032, f: sweep, gain: 0.75 + phrase * 0.15 });
                        t += trill.spacing;
                    }
                    t += 0.03;
                });
                const peak = voice.flourishPeak * jitter();
                notes.push({ t, dur: 0.26, f: [2600, peak * 0.8, peak, peak * 0.9, 3000], gain: 1 });
                break;
            }
            case 'blackbird': {
                // One or two fluted motifs, slightly retuned each time
                let t = 0;
                const motifCount = Math.random() < 0.4 ? 2 : 1;
                for (let m = 0; m < motifCount; m++) {
                    const motif = voice.motifs[Math.floor(Math.random() * voice.motifs.length)];
                    const tune = jitter();
                    motif.forEach(note => {
                        notes.push({ t, dur: note.dur, f: note.contour.map(f => f * tune), gain: note.gain, vibrato: 0.012 });
                        t += note.dur + note.gap;
                    });
                    t += 0.08;
                }
                // Twitter: fast, quiet, high squeaks
                const squeaks = 3 + Math.floor(Math.random() * 5);
                for (let i = 0; i < squeaks; i++) {
                    const f = 5500 + Math.random() * 2500;
                    notes.push({ t, dur: 0.03, f: [f * 0.85, f * 1.1, f * 0.9], gain: 0.35 });
                    t += 0.045 + Math.random() * 0.02;
                }
                break;
            }
        }
        return notes;
    }

    playBirdNote(startTime, note, destination) {
        const ctx = this.audioContext;
        const { dur } = note;

        // Bird song is close to a pure tone; a faint 2nd/3rd harmonic keeps it from sounding electronic
        if (!this.birdWave) {
            this.birdWave = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.05, 0.015]));
        }

        // Pitch contour, smoothly interpolated, with optional fluting vibrato
        const steps = Math.max(16, Math.ceil(dur * 400));
        const freqCurve = new Float32Array(steps);
        const ampCurve = new Float32Array(steps);
        const points = note.f;
        for (let i = 0; i < steps; i++) {
            const x = i / (steps - 1);
            const pos = x * (points.length - 1);
            const idx = Math.min(points.length - 2, Math.floor(pos));
            const frac = pos - idx;
            const smooth = 0.5 - 0.5 * Math.cos(Math.PI * frac);
            let f = points[idx] + (points[idx + 1] - points[idx]) * smooth;
            if (note.vibrato) f *= 1 + note.vibrato * Math.sin(2 * Math.PI * 30 * x * dur);
            freqCurve[i] = f;
            // Raised-cosine swell: quicker onset, longer fade, zero level and slope at both ends (no clicks)
            const attack = 0.3;
            const env = x < attack
                ? 0.5 - 0.5 * Math.cos(Math.PI * x / attack)
                : 0.5 + 0.5 * Math.cos(Math.PI * (x - attack) / (1 - attack));
            ampCurve[i] = note.gain * env;
        }

        const osc = ctx.createOscillator();
        osc.setPeriodicWave(this.birdWave);
        osc.frequency.setValueCurveAtTime(freqCurve, startTime, dur);

        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setValueCurveAtTime(ampCurve, startTime, dur);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(startTime);
        osc.stop(startTime + dur + 0.01);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
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
        const baseFreq = isEmphasis ? config.emphasisFrequency : config.baseFrequency;
        const endFreq = baseFreq * config.pitchGlide;

        // --- Layer 1: Fundamental sine ---
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, startTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

        // --- Layer 2: 2nd harmonic (body) ---
        const osc2 = this.audioContext.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(baseFreq * 2, startTime);
        osc2.frequency.exponentialRampToValueAtTime(endFreq * 2, startTime + duration);
        const osc2Gain = this.audioContext.createGain();
        osc2Gain.gain.value = 0.08;

        // --- Layer 3: Sub-harmonic (chest resonance) ---
        const oscSub = this.audioContext.createOscillator();
        oscSub.type = 'sine';
        oscSub.frequency.setValueAtTime(baseFreq * 0.5, startTime);
        oscSub.frequency.exponentialRampToValueAtTime(endFreq * 0.5, startTime + duration);
        const oscSubGain = this.audioContext.createGain();
        oscSubGain.gain.value = 0.04;

        // --- Vibrato LFO ---
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        lfo.frequency.value = config.vibratoRate;
        lfoGain.gain.value = config.vibratoDepth;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.detune);
        lfoGain.connect(osc2.detune);
        lfoGain.connect(oscSub.detune);

        // --- Layer 4: Breath noise ---
        const bufferSize = Math.ceil(this.audioContext.sampleRate * (duration + 0.1));
        const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;

        const breathFilter = this.audioContext.createBiquadFilter();
        breathFilter.type = 'bandpass';
        breathFilter.frequency.value = config.breathFilterFreq;
        breathFilter.Q.value = config.breathFilterQ;

        const breathGain = this.audioContext.createGain();

        // --- Lowpass filter for mellow tone ---
        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = config.filterCutoff;
        lowpass.Q.value = 0.7;

        // --- Output gain ---
        const outputGain = this.audioContext.createGain();

        // Connect tonal layers -> lowpass -> output
        osc.connect(lowpass);
        osc2.connect(osc2Gain);
        osc2Gain.connect(lowpass);
        oscSub.connect(oscSubGain);
        oscSubGain.connect(lowpass);
        lowpass.connect(outputGain);

        // Connect breath noise (bypasses lowpass, has its own filter)
        noise.connect(breathFilter);
        breathFilter.connect(breathGain);
        breathGain.connect(outputGain);

        outputGain.connect(this.masterGain);
        if (this.reverbBus) outputGain.connect(this.reverbBus);

        // --- Envelope ---
        const volume = isEmphasis ? config.volume * 1.5 : config.volume;
        const attackTime = 0.08; // Smooth 80ms attack
        const releaseStart = duration * 0.6;

        outputGain.gain.setValueAtTime(0, startTime);
        outputGain.gain.linearRampToValueAtTime(volume, startTime + attackTime);
        outputGain.gain.setValueAtTime(volume * 0.95, startTime + releaseStart);
        outputGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        // Breath envelope follows main but scaled
        breathGain.gain.setValueAtTime(0, startTime);
        breathGain.gain.linearRampToValueAtTime(volume * config.breathiness, startTime + attackTime);
        breathGain.gain.setValueAtTime(volume * config.breathiness * 0.9, startTime + releaseStart);
        breathGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        // --- Start ---
        osc.start(startTime);
        osc2.start(startTime);
        oscSub.start(startTime);
        lfo.start(startTime);
        noise.start(startTime);

        // --- Stop ---
        const stopTime = startTime + duration + 0.01;
        osc.stop(stopTime);
        osc2.stop(stopTime);
        oscSub.stop(stopTime);
        lfo.stop(stopTime);
        noise.stop(stopTime);

        // --- Cleanup ---
        osc.onended = () => {
            osc.disconnect();
            osc2.disconnect();
            oscSub.disconnect();
            osc2Gain.disconnect();
            oscSubGain.disconnect();
            lfo.disconnect();
            lfoGain.disconnect();
            noise.disconnect();
            breathFilter.disconnect();
            breathGain.disconnect();
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
