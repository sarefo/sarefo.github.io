// Nature sound synthesis using Web Audio API
// Independent from visual animations, lightweight, easily expandable
//
// Every creature is an individual with its own voice, position and schedule.
// Its voice (pitch, rhythm, song) is drawn once, so the same animal stays
// recognizable. Day creatures are heard in the light theme, night creatures in
// the dark theme. Positions use pan (-1 left .. 1 right) and distance
// (0 = close and bright, 1 = far, dull and reverberant).

const SOUND_CONFIGS = {
    rain_background: {
        enabled: true,
        type: 'continuous',     // Stereo pink-noise bed whose intensity drifts slowly
        volume: 0.018
    },
    rain: {
        enabled: true,
        type: 'interval',       // Individual drops on leaves and water, denser when it rains harder
        volume: 0.03,
        minInterval: 60,
        maxInterval: 260
    },
    cricket: {
        enabled: true,
        type: 'interval',       // Each cricket sings a bout of pulsed chirps, then rests
        volume: 0.008,
        minInterval: 4000,      // Rest between bouts
        maxInterval: 20000,
        boutLength: [6, 18],    // Seconds of chirping per bout
        individuals: [
            { name: 'Cricket A', pan: -0.6, distance: 0.35 },
            { name: 'Cricket B', pan: 0.3, distance: 0.6 },
            { name: 'Cricket C', pan: 0.8, distance: 0.85 }
        ]
    },
    mosquito: {
        enabled: true,
        type: 'interval',       // Occasional fly-by past the listener's ear
        volume: 0.008,
        minInterval: 30000,
        maxInterval: 90000,
        delayFirst: true        // Never greet the listener with a mosquito
    },
    toad: {
        enabled: true,
        type: 'interval',
        time: 'night',
        volume: 0.08,
        minInterval: 15000,
        maxInterval: 50000,
        answerChance: 0.5,      // Chance that another frog answers a call
        individuals: [
            { name: 'Common toad A', species: 'commonToad', pan: -0.35, distance: 0.5 },
            { name: 'Common toad B', species: 'commonToad', pan: 0.5, distance: 0.75 },
            { name: 'Tree frog', species: 'treeFrog', pan: 0.15, distance: 0.65 }
        ]
    },
    owl: {
        enabled: true,
        type: 'interval',
        time: 'night',
        volume: 0.04,
        minInterval: 40000,
        maxInterval: 120000,
        answerChance: 0.6,      // Tawny owl pairs call back and forth ("twit-twoo")
        individuals: [
            { name: 'Tawny owl (male)', species: 'tawnyMale', pan: -0.4, distance: 0.75 },
            { name: 'Tawny owl (female)', species: 'tawnyFemale', pan: 0.55, distance: 0.65, level: 0.7 }
        ]
    },
    songbird: {
        enabled: true,
        type: 'interval',
        time: 'day',
        volume: 0.016,          // Peak volume of a single note
        minInterval: 25000,     // Pause after a bout (individuals may override)
        maxInterval: 90000,
        individuals: [
            { name: 'Great tit', species: 'greatTit', pan: -0.55, distance: 0.25 },
            { name: 'Chaffinch', species: 'chaffinch', pan: 0.45, distance: 0.45 },
            { name: 'Blackbird', species: 'blackbird', pan: -0.15, distance: 0.7 },
            { name: 'Robin', species: 'robin', pan: 0.2, distance: 0.3, level: 0.8, time: 'any' },
            { name: 'Chiffchaff', species: 'chiffchaff', pan: 0.75, distance: 0.4, level: 0.85 },
            { name: 'Wood pigeon', species: 'woodPigeon', pan: -0.75, distance: 0.5, level: 1.1,
              minInterval: 40000, maxInterval: 120000 },
            { name: 'Cuckoo', species: 'cuckoo', pan: 0.35, distance: 0.85, level: 1.4,
              minInterval: 60000, maxInterval: 200000 }
        ]
    }
};

const soundRand = (min, max) => min + Math.random() * (max - min);
const soundRandInt = (min, max) => Math.floor(soundRand(min, max + 1));
const soundPick = (list) => list[Math.floor(Math.random() * list.length)];

class SoundGenerator {
    constructor(themeHandler) {
        this.themeHandler = themeHandler;
        this.audioContext = null;
        this.masterGain = null;
        this.isMuted = true; // Start muted (audio not initialized yet)
        this.isInitialized = false;
        this.isPageVisible = !document.hidden; // Track page visibility
        this.scheduledSounds = new Map(); // Next timer per individual
        this.answerTimers = new Set();    // Pending replies between individuals
        this.continuousSounds = new Map(); // Track continuous sounds
        this.soundConfigs = SOUND_CONFIGS;
        this.waves = {};
        this.rainIntensity = 0.6;

        // Every interval sound is a list of individuals; single sounds get one anonymous individual
        Object.values(this.soundConfigs).forEach(config => {
            if (config.type === 'interval' && !config.individuals) config.individuals = [{ pan: 0, distance: 0 }];
        });

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
            'display:flex;flex-wrap:wrap;gap:6px;max-width:420px;align-items:center;';

        const title = document.createElement('div');
        title.textContent = 'Sound Debug';
        title.style.cssText = 'width:100%;font-weight:bold;margin-bottom:4px;';
        panel.appendChild(title);

        Object.entries(this.soundConfigs)
            .filter(([soundType, cfg]) => cfg.type === 'interval' && soundType !== 'rain')
            .forEach(([soundType, config]) => {
                config.individuals.forEach(individual => {
                    const btn = document.createElement('button');
                    btn.textContent = individual.name || soundType.charAt(0).toUpperCase() + soundType.slice(1);
                    btn.style.cssText = 'padding:8px 12px;border:1px solid #555;border-radius:4px;' +
                        'background:#333;color:#fff;cursor:pointer;font:13px monospace;min-height:44px;';
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (!this.isInitialized) this.initializeAudio(false);
                        if (this.audioContext.state === 'suspended') {
                            await this.audioContext.resume();
                        }
                        this.isMuted = false;
                        this.masterGain.gain.value = 0.3;
                        console.log(`[Sound Debug] Playing: ${btn.textContent}`, individual);
                        this.playSound(soundType, config, individual, true);
                    });
                    panel.appendChild(btn);
                });
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
                this.resumeSoundGeneration();
            } else {
                this.pauseSoundGeneration();
            }
        });
    }

    initializeAudio(startSounds = true) {
        if (this.isInitialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Master gain node for volume control
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.isMuted ? 0 : 0.3; // Default volume 30%

            this.createReverb();

            this.isInitialized = true;

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
        const seconds = 1.5;
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
        // Mono in, stereo out: half the convolution work of a true-stereo reverb
        this.reverbBus = ctx.createGain();
        this.reverbBus.channelCount = 1;
        this.reverbBus.channelCountMode = 'explicit';
        this.reverbBus.gain.value = 0.6;
        this.reverbBus.connect(convolver);
        convolver.connect(this.masterGain);
    }

    // --- Scheduling ---

    startSoundGeneration() {
        Object.entries(this.soundConfigs).forEach(([soundType, config]) => {
            if (!config.enabled) return;
            if (config.type === 'continuous') {
                if (!this.continuousSounds.has(soundType)) this.startContinuousSound(soundType, config);
            } else {
                config.individuals.forEach((individual, index) => {
                    // Stagger the first appearance so the scene fills in gradually
                    const firstDelay = config.delayFirst
                        ? this.intervalFor(config, individual)
                        : soundRand(Math.min(1000, config.minInterval), Math.min(config.minInterval, 15000));
                    this.scheduleNextSound(`${soundType}:${index}`, soundType, config, individual, firstDelay);
                });
            }
        });
    }

    stopScheduling() {
        this.scheduledSounds.forEach(timeoutId => clearTimeout(timeoutId));
        this.scheduledSounds.clear();
        this.answerTimers.forEach(timeoutId => clearTimeout(timeoutId));
        this.answerTimers.clear();
    }

    intervalFor(config, individual) {
        const min = individual.minInterval ?? config.minInterval;
        const max = individual.maxInterval ?? config.maxInterval;
        const interval = soundRand(min, max);
        // Rain drops come faster the harder it rains
        return config === this.soundConfigs.rain ? interval / Math.pow(this.rainIntensity, 1.5) : interval;
    }

    scheduleNextSound(key, soundType, config, individual, delay) {
        if (!this.isInitialized || !this.audioContext) return;

        const timeoutId = setTimeout(() => {
            const seconds = this.playSound(soundType, config, individual);
            if (seconds > 0 && config.answerChance && Math.random() < config.answerChance) {
                this.scheduleAnswer(soundType, config, individual, seconds);
            }
            // The rest starts once the bout is over
            this.scheduleNextSound(key, soundType, config, individual,
                seconds * 1000 + this.intervalFor(config, individual));
        }, delay);

        this.scheduledSounds.set(key, timeoutId);
    }

    // Another individual of the same kind replies shortly after a call ends
    scheduleAnswer(soundType, config, caller, callSeconds) {
        const now = this.audioContext.currentTime;
        const others = config.individuals.filter(other =>
            other !== caller && this.isActiveNow(config, other) && !(other.busyUntil > now));
        if (others.length === 0) return;

        const responder = soundPick(others);
        const timeoutId = setTimeout(() => {
            this.answerTimers.delete(timeoutId);
            this.playSound(soundType, config, responder);
        }, (callSeconds + soundRand(0.4, 1.6)) * 1000);
        this.answerTimers.add(timeoutId);
    }

    isActiveNow(config, individual) {
        const time = individual.time || config.time || 'any';
        if (time === 'any') return true;
        const isNight = this.themeHandler?.isDarkTheme?.() ?? false;
        return time === (isNight ? 'night' : 'day');
    }

    // Plays one bout of an individual and returns its length in seconds (0 if nothing played)
    playSound(soundType, config, individual, force = false) {
        if (!this.audioContext || this.isMuted || !this.isPageVisible) return 0;
        if (!force && !this.isActiveNow(config, individual)) return 0;
        // An individual never sings over itself
        if (!force && individual.busyUntil > this.audioContext.currentTime) return 0;

        let seconds = 0;
        switch (soundType) {
            case 'cricket':
                seconds = this.synthesizeCricket(config, individual);
                break;
            case 'rain':
                seconds = this.synthesizeRain(config);
                break;
            case 'mosquito':
                seconds = this.synthesizeMosquito(config);
                break;
            case 'toad':
                seconds = this.synthesizeToad(config, individual);
                break;
            case 'songbird':
                seconds = this.synthesizeSongbird(config, individual);
                break;
            case 'owl':
                seconds = this.synthesizeOwl(config, individual);
                break;
        }
        individual.busyUntil = this.audioContext.currentTime + seconds;
        return seconds;
    }

    startContinuousSound(soundType, config) {
        if (!this.audioContext || !this.isPageVisible) return;

        // Stop any existing instance first
        this.stopContinuousSound(soundType);

        switch (soundType) {
            case 'rain_background':
                this.synthesizeRainBackground(config);
                break;
        }
    }

    stopContinuousSound(soundType) {
        if (soundType === 'rain_background') clearTimeout(this.weatherTimer);

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

    // --- Shared building blocks ---

    // Signal chain for one individual: notes -> level -> pan -> distance lowpass -> master (+ reverb)
    createVoiceBus(individual, volume, reverbAmount) {
        const ctx = this.audioContext;
        const input = ctx.createGain();
        input.gain.value = volume * (individual.level ?? 1) * (1 - individual.distance * 0.45);
        const panner = ctx.createStereoPanner();
        panner.pan.value = individual.pan;
        const air = ctx.createBiquadFilter();
        air.type = 'lowpass';
        air.frequency.value = 14000 - individual.distance * 8000;
        input.connect(panner);
        panner.connect(air);
        air.connect(this.masterGain);
        const nodes = [input, panner, air];

        if (this.reverbBus) {
            const send = ctx.createGain();
            send.gain.value = reverbAmount * (0.5 + individual.distance);
            air.connect(send);
            send.connect(this.reverbBus);
            nodes.push(send);
        }

        return {
            input,
            // Tear the bus down once everything on it (and the reverb tail) is over
            releaseAt: (endTime) => {
                const ms = (endTime - ctx.currentTime) * 1000 + 3000;
                setTimeout(() => nodes.forEach(node => node.disconnect()), ms);
            }
        };
    }

    getWave(name, harmonics) {
        if (!this.waves[name]) {
            const imag = new Float32Array([0, ...harmonics]);
            this.waves[name] = this.audioContext.createPeriodicWave(new Float32Array(imag.length), imag);
        }
        return this.waves[name];
    }

    getNoiseBuffer() {
        if (!this.noiseBuffer) {
            const ctx = this.audioContext;
            this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        return this.noiseBuffer;
    }

    // Raised-cosine swell: zero level and slope at both ends, so notes never click
    envelope(x, attack) {
        return x < attack
            ? 0.5 - 0.5 * Math.cos(Math.PI * x / attack)
            : 0.5 + 0.5 * Math.cos(Math.PI * (x - attack) / (1 - attack));
    }

    // Smoothly interpolates a few contour points into an automation curve
    smoothCurve(points, steps) {
        const curve = new Float32Array(steps);
        if (points.length === 1) return curve.fill(points[0]);
        for (let i = 0; i < steps; i++) {
            const pos = i / (steps - 1) * (points.length - 1);
            const idx = Math.min(points.length - 2, Math.floor(pos));
            const smooth = 0.5 - 0.5 * Math.cos(Math.PI * (pos - idx));
            curve[i] = points[idx] + (points[idx + 1] - points[idx]) * smooth;
        }
        return curve;
    }

    // One sung or called note whose pitch and loudness follow smooth contours.
    // opts: f (pitch points in Hz), gain, attack (share of the note), wave,
    // vibrato (relative depth) + vibratoRate, tremolo (0-1) + tremoloRate,
    // breath (amount of band-limited noise riding along with the tone)
    playTone(start, dur, opts, destination) {
        const ctx = this.audioContext;
        const steps = Math.max(16, Math.ceil(dur * 500));
        const pitch = this.smoothCurve(opts.f, steps);
        const amp = new Float32Array(steps);
        const attack = opts.attack ?? 0.3;
        const gain = opts.gain ?? 1;
        let pitchSum = 0;

        for (let i = 0; i < steps; i++) {
            const x = i / (steps - 1);
            const t = x * dur;
            if (opts.vibrato) pitch[i] *= 1 + opts.vibrato * Math.sin(2 * Math.PI * (opts.vibratoRate ?? 30) * t);
            pitchSum += pitch[i];
            let a = gain * this.envelope(x, attack);
            if (opts.tremolo) a *= 1 - opts.tremolo * (0.5 - 0.5 * Math.cos(2 * Math.PI * opts.tremoloRate * t));
            amp[i] = a;
        }

        const osc = ctx.createOscillator();
        if (typeof opts.wave === 'string') osc.type = opts.wave;
        else osc.setPeriodicWave(opts.wave || this.getWave('pure', [1, 0.05, 0.015]));
        osc.frequency.setValueCurveAtTime(pitch, start, dur);

        const toneGain = ctx.createGain();
        toneGain.gain.value = 0;
        toneGain.gain.setValueCurveAtTime(amp, start, dur);
        osc.connect(toneGain);
        toneGain.connect(destination);
        osc.start(start);
        osc.stop(start + dur + 0.01);
        osc.onended = () => {
            osc.disconnect();
            toneGain.disconnect();
        };

        if (opts.breath) {
            const noiseBuffer = this.getNoiseBuffer();
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            const band = ctx.createBiquadFilter();
            band.type = 'bandpass';
            band.frequency.value = pitchSum / steps;
            band.Q.value = opts.breathQ ?? 4;
            const breathGain = ctx.createGain();
            breathGain.gain.value = 0;
            breathGain.gain.setValueCurveAtTime(amp.map(a => a * opts.breath), start, dur);
            noise.connect(band);
            band.connect(breathGain);
            breathGain.connect(destination);
            noise.start(start, soundRand(0, Math.max(0, noiseBuffer.duration - dur - 0.05)), dur + 0.01);
            noise.onended = () => {
                noise.disconnect();
                band.disconnect();
                breathGain.disconnect();
            };
        }
    }

    // --- Crickets ---
    // A field cricket chirp is a few rapid pulses of a nearly pure ~4.5 kHz tone,
    // each pulse sliding slightly down in pitch. Crickets repeat chirps at a
    // steady rate for a while, then rest.

    synthesizeCricket(config, cricket) {
        if (!cricket.voice) {
            cricket.voice = {
                carrier: soundRand(4300, 5000),
                pulses: soundRandInt(3, 5),
                pulsePeriod: soundRand(0.028, 0.038),
                chirpPeriod: soundRand(0.38, 0.6)
            };
        }
        const voice = cricket.voice;
        const ctx = this.audioContext;
        const bus = this.createVoiceBus(cricket, config.volume, 0.12);

        let t = ctx.currentTime + 0.05;
        const end = t + soundRand(...config.boutLength);
        for (let n = 0; t < end; n++) {
            const warmUp = Math.min(1, 0.4 + n * 0.15); // First chirps are hesitant
            this.playCricketChirp(t, voice, warmUp * soundRand(0.85, 1), bus.input);
            t += voice.chirpPeriod * soundRand(0.97, 1.03);
        }
        bus.releaseAt(t);
        return t - ctx.currentTime;
    }

    playCricketChirp(start, voice, level, destination) {
        const ctx = this.audioContext;
        const dur = voice.pulses * voice.pulsePeriod;
        const steps = Math.ceil(dur * 3000);
        const amp = new Float32Array(steps);
        const pitch = new Float32Array(steps);
        const pulseLength = voice.pulsePeriod * 0.65;

        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1) * dur;
            const pulse = Math.floor(t / voice.pulsePeriod);
            const local = t - pulse * voice.pulsePeriod;
            const pulseLevel = pulse === 0 ? 0.7 : (pulse === voice.pulses - 1 ? 0.85 : 1);
            const inPulse = local < pulseLength && pulse < voice.pulses;
            amp[i] = inPulse ? level * pulseLevel * Math.pow(Math.sin(Math.PI * local / pulseLength), 2) : 0;
            pitch[i] = voice.carrier * (1.015 - 0.03 * Math.min(1, local / pulseLength));
        }

        const osc = ctx.createOscillator();
        osc.setPeriodicWave(this.getWave('cricket', [1, 0.08, 0.02]));
        osc.frequency.setValueCurveAtTime(pitch, start, dur);
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setValueCurveAtTime(amp, start, dur);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(start);
        osc.stop(start + dur + 0.01);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    }

    // --- Rain ---

    synthesizeRainBackground(config) {
        const ctx = this.audioContext;

        // Stereo pink noise (Paul Kellet's filter): softer and fuller than white noise.
        // Long enough that the loop is not noticeable.
        if (!this.pinkNoiseBuffer) {
            this.pinkNoiseBuffer = ctx.createBuffer(2, ctx.sampleRate * 8, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = this.pinkNoiseBuffer.getChannelData(ch);
                let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                for (let i = 0; i < data.length; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.96900 * b2 + white * 0.1538520;
                    b3 = 0.86650 * b3 + white * 0.3104856;
                    b4 = 0.55000 * b4 + white * 0.5329522;
                    b5 = -0.7616 * b5 - white * 0.0168980;
                    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                    b6 = white * 0.115926;
                }
            }
        }

        const noise = ctx.createBufferSource();
        noise.buffer = this.pinkNoiseBuffer;
        noise.loop = true;

        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 250;
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 6000;

        // Faint bright layer: the hiss of many tiny drops on leaves
        const hissBand = ctx.createBiquadFilter();
        hissBand.type = 'bandpass';
        hissBand.frequency.value = 7000;
        hissBand.Q.value = 0.7;
        const hissGain = ctx.createGain();
        hissGain.gain.value = 0.5;

        const bed = ctx.createGain();
        bed.gain.value = config.volume * this.rainIntensity;

        noise.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(bed);
        noise.connect(hissBand);
        hissBand.connect(hissGain);
        hissGain.connect(bed);
        bed.connect(this.masterGain);
        noise.start();

        this.continuousSounds.set('rain_background', [noise, highpass, lowpass, hissBand, hissGain, bed]);
        this.driftRainIntensity(config, bed);
    }

    // The weather wanders between drizzle and a proper shower every half minute or so
    driftRainIntensity(config, bed) {
        this.weatherTimer = setTimeout(() => {
            this.rainIntensity = soundRand(0.25, 1);
            const now = this.audioContext.currentTime;
            bed.gain.cancelScheduledValues(now);
            bed.gain.setValueAtTime(bed.gain.value, now);
            bed.gain.linearRampToValueAtTime(config.volume * this.rainIntensity, now + 10);
            this.driftRainIntensity(config, bed);
        }, soundRand(20000, 45000));
    }

    synthesizeRain(config) {
        const ctx = this.audioContext;
        const start = ctx.currentTime + 0.01;
        const nearness = Math.random();
        const level = config.volume * (0.25 + 0.75 * nearness * nearness);

        const panner = ctx.createStereoPanner();
        panner.pan.value = soundRand(-0.9, 0.9);
        panner.connect(this.masterGain);

        // Impact: a short tick of noise, its color set by what the drop hits
        const noiseBuffer = this.getNoiseBuffer();
        const decay = soundRand(0.012, 0.04);
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = soundRand(1800, 6500);
        band.Q.value = soundRand(0.8, 2.5);
        const tickGain = ctx.createGain();
        tickGain.gain.setValueAtTime(0, start);
        tickGain.gain.linearRampToValueAtTime(level, start + 0.001);
        tickGain.gain.exponentialRampToValueAtTime(level * 0.001, start + decay);
        noise.connect(band);
        band.connect(tickGain);
        tickGain.connect(panner);
        // The tick runs a little past the plip, so its end can clean up the whole drop
        noise.start(start, soundRand(0, noiseBuffer.duration - 0.1), 0.08);
        noise.onended = () => {
            noise.disconnect();
            band.disconnect();
            tickGain.disconnect();
            panner.disconnect();
        };

        // Some drops fall into water: the trapped air bubble rings with a rising "plip"
        if (Math.random() < 0.22) {
            const f0 = soundRand(900, 2400);
            const plip = ctx.createOscillator();
            plip.frequency.setValueAtTime(f0, start);
            plip.frequency.exponentialRampToValueAtTime(f0 * soundRand(1.4, 1.9), start + 0.03);
            const plipGain = ctx.createGain();
            plipGain.gain.setValueAtTime(0, start);
            plipGain.gain.linearRampToValueAtTime(level * 0.5, start + 0.002);
            plipGain.gain.exponentialRampToValueAtTime(level * 0.0005, start + 0.06);
            plip.connect(plipGain);
            plipGain.connect(panner);
            plip.start(start);
            plip.stop(start + 0.07);
            plip.onended = () => {
                plip.disconnect();
                plipGain.disconnect();
            };
        }

        return 0;
    }

    // --- Mosquito ---
    // A fly-by: the insect drifts past the ear on a wobbly path. Loudness, brightness
    // and stereo position follow its distance; the whine wavers with its wingbeat.
    // Now and then it lands mid-flight and the whine stops abruptly.

    synthesizeMosquito(config) {
        const ctx = this.audioContext;
        const start = ctx.currentTime + 0.05;
        const flight = soundRand(3, 6);
        const lands = Math.random() < 0.3;
        const dur = lands ? flight * soundRand(0.55, 0.75) : flight;

        const side = Math.random() < 0.5 ? -1 : 1;
        const closestAt = flight * soundRand(0.4, 0.6);
        const closest = soundRand(0.15, 0.5); // meters
        const speed = soundRand(0.6, 1.2);    // meters per second
        const wingbeat = soundRand(480, 640);
        const phase1 = soundRand(0, 6), phase2 = soundRand(0, 6);

        const steps = Math.ceil(dur * 100);
        const gainCurve = new Float32Array(steps);
        const panCurve = new Float32Array(steps);
        const pitchCurve = new Float32Array(steps);
        const cutoffCurve = new Float32Array(steps);
        const fadeOut = lands ? 0.06 : 0.4;
        let drift = 0;

        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1) * dur;
            const x = side * speed * (t - closestAt) + 0.15 * Math.sin(2 * Math.PI * 0.7 * t + phase1);
            const y = closest + 0.1 * Math.sin(2 * Math.PI * 0.45 * t + phase2);
            const distance = Math.hypot(x, y);
            const nearness = Math.min(1, 0.25 / distance);
            const edge = Math.min(1, t / 0.3, (dur - t) / fadeOut);

            gainCurve[i] = config.volume * nearness * Math.max(0, edge);
            panCurve[i] = Math.max(-0.95, Math.min(0.95, x / (distance + 0.2)));
            drift = drift * 0.98 + (Math.random() - 0.5) * 0.004;
            pitchCurve[i] = wingbeat * (1 + drift + 0.01 * Math.sin(2 * Math.PI * 1.3 * t));
            cutoffCurve[i] = 2500 + 5000 * Math.min(1, 0.3 / distance);
        }

        // Two slightly detuned buzzes give the whine its shimmer
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueCurveAtTime(pitchCurve, start, dur);
        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.detune.value = 9;
        osc2.frequency.setValueCurveAtTime(pitchCurve, start, dur);
        const osc2Gain = ctx.createGain();
        osc2Gain.gain.value = 0.5;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueCurveAtTime(cutoffCurve, start, dur);
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setValueCurveAtTime(gainCurve, start, dur);
        const panner = ctx.createStereoPanner();
        panner.pan.setValueCurveAtTime(panCurve, start, dur);

        osc.connect(lowpass);
        osc2.connect(osc2Gain);
        osc2Gain.connect(lowpass);
        lowpass.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);

        [osc, osc2].forEach(o => {
            o.start(start);
            o.stop(start + dur + 0.01);
        });
        osc.onended = () => {
            [osc, osc2, osc2Gain, lowpass, gain, panner].forEach(node => node.disconnect());
        };
        return dur + 0.05;
    }

    // --- Toads and frogs ---
    // A frog call is a train of pulses exciting the resonance of the vocal sac:
    // modeled as a low sawtooth (one click per pulse) through narrow bandpass
    // "formants". Common toads give soft, slow "quarr" calls; tree frogs a fast,
    // bright "krek-krek-krek" series.

    synthesizeToad(config, toad) {
        if (!toad.voice) {
            toad.voice = toad.species === 'treeFrog'
                ? { pulseRate: soundRand(100, 130), formant: soundRand(2000, 2500), callDur: soundRand(0.07, 0.1),
                    period: soundRand(0.22, 0.28), calls: [8, 20] }
                : { pulseRate: soundRand(38, 52), formant: soundRand(650, 900), callDur: soundRand(0.14, 0.22),
                    period: soundRand(0.7, 1.1), calls: [3, 8] };
        }
        const voice = toad.voice;
        const ctx = this.audioContext;
        const bus = this.createVoiceBus(toad, config.volume, 0.3);

        let t = ctx.currentTime + 0.05;
        const calls = soundRandInt(...voice.calls);
        for (let i = 0; i < calls; i++) {
            this.playFrogCall(t, voice, soundRand(0.8, 1), bus.input);
            t += voice.period * soundRand(0.9, 1.1);
        }
        bus.releaseAt(t);
        return t - ctx.currentTime;
    }

    playFrogCall(start, voice, level, destination) {
        const ctx = this.audioContext;
        const dur = voice.callDur * soundRand(0.9, 1.1);
        const rate = voice.pulseRate * soundRand(0.97, 1.03);

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(rate, start);
        osc.frequency.linearRampToValueAtTime(rate * 0.92, start + dur);

        // Each formant is two bandpasses in series: steep skirts keep the low
        // pulse-rate fundamental and the upper buzz out of the call
        const bandpass = (frequency, q) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = frequency;
            filter.Q.value = q;
            return filter;
        };
        const formant1 = bandpass(voice.formant, 5);
        const formant1b = bandpass(voice.formant, 3);
        const formant2 = bandpass(voice.formant * 1.9, 6);
        const formant2b = bandpass(voice.formant * 1.9, 4);
        const formant2Gain = ctx.createGain();
        formant2Gain.gain.value = 0.35;

        const steps = 64;
        const amp = new Float32Array(steps);
        for (let i = 0; i < steps; i++) amp[i] = level * this.envelope(i / (steps - 1), 0.25);
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setValueCurveAtTime(amp, start, dur);

        osc.connect(formant1);
        formant1.connect(formant1b);
        formant1b.connect(gain);
        osc.connect(formant2);
        formant2.connect(formant2b);
        formant2b.connect(formant2Gain);
        formant2Gain.connect(gain);
        gain.connect(destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
        osc.onended = () => {
            [osc, formant1, formant1b, formant2, formant2b, formant2Gain, gain].forEach(node => node.disconnect());
        };
    }

    // --- Owls ---
    // Tawny owls: the male hoots "hooo ... hu, hu-hu-huuuuu" (a long note, a pause,
    // then a quavering phrase); the female answers with a sharp "ke-wick".

    synthesizeOwl(config, owl) {
        if (!owl.voice) {
            owl.voice = owl.species === 'tawnyFemale'
                ? { pitch: soundRand(1500, 1800) }
                : { pitch: soundRand(650, 780), pause: soundRand(2.5, 4) };
        }
        const voice = owl.voice;
        const ctx = this.audioContext;
        const bus = this.createVoiceBus(owl, config.volume, 0.5);
        let t = ctx.currentTime + 0.05;

        if (owl.species === 'tawnyFemale') {
            const harsh = this.getWave('kewick', [1, 0.6, 0.35, 0.18, 0.08, 0.04]);
            const calls = soundRandInt(1, 3);
            for (let i = 0; i < calls; i++) {
                const f = voice.pitch * soundRand(0.97, 1.03);
                this.playTone(t, 0.06, { f: [f, f * 1.12, f * 0.9], wave: harsh, gain: 0.6, breath: 2 }, bus.input);
                this.playTone(t + 0.14, 0.32, {
                    f: [f * 0.85, f * 1.3, f * 1.4, f * 1.15, f * 0.85],
                    wave: harsh, attack: 0.2, breath: 2
                }, bus.input);
                t += 0.46 + (i < calls - 1 ? soundRand(1, 2) : 0);
            }
        } else {
            const f = voice.pitch * soundRand(0.98, 1.02);
            const hoot = this.getWave('hoot', [1, 0.08, 0.02]);
            // "hooo"
            this.playTone(t, 0.8, { f: [f * 0.93, f, f, f * 0.96], wave: hoot, attack: 0.18, breath: 0.8 }, bus.input);
            t += 0.8 + voice.pause * soundRand(0.9, 1.1);
            // "hu"
            this.playTone(t, 0.14, { f: [f * 0.95, f, f * 0.96], wave: hoot, gain: 0.7, breath: 0.8 }, bus.input);
            t += 0.38;
            // "hu-hu-hu", stuttering into the long quavering "huuuuu"
            const stutters = soundRandInt(2, 4);
            for (let i = 0; i < stutters; i++) {
                this.playTone(t, 0.08, { f: [f * 0.97, f * 1.01], wave: hoot, gain: 0.55, breath: 0.8 }, bus.input);
                t += 0.13;
            }
            this.playTone(t, 1.0, {
                f: [f, f * 1.03, f * 1.01, f * 0.95], wave: hoot, attack: 0.1,
                tremolo: 0.55, tremoloRate: 11, vibrato: 0.015, vibratoRate: 11, breath: 0.8
            }, bus.input);
            t += 1.0;
        }

        bus.releaseAt(t);
        return t - ctx.currentTime;
    }

    // --- Songbirds ---
    // The species decides the song structure; the individual's voice (pitches,
    // note counts, motifs) is drawn once. Notes are near-pure whistles.

    synthesizeSongbird(config, bird) {
        if (!bird.voice) bird.voice = this.createBirdVoice(bird.species);
        const voice = bird.voice;
        const ctx = this.audioContext;
        const bus = this.createVoiceBus(bird, config.volume, 0.35);
        const wave = voice.wave || this.getWave('pure', [1, 0.05, 0.015]);

        const songs = soundRandInt(...voice.songs);
        let t = ctx.currentTime + 0.05;
        let end = t;
        for (let i = 0; i < songs; i++) {
            const notes = this.composeBirdSong(bird, i === songs - 1);
            notes.forEach(note => this.playTone(t + note.t, note.dur, { wave, ...note }, bus.input));
            end = t + Math.max(...notes.map(note => note.t + note.dur));
            t = end + soundRand(...voice.gap);
        }

        bus.releaseAt(end);
        return end - ctx.currentTime;
    }

    createBirdVoice(species) {
        switch (species) {
            case 'greatTit':
                // "tea-cher tea-cher": a high note, then a lower down-slurred one
                return {
                    songs: [3, 6], gap: [1.5, 3.5],
                    high: soundRand(5600, 7000),
                    low: soundRand(3300, 4300),
                    reps: soundRandInt(3, 6),
                    period: soundRand(0.22, 0.3)
                };
            case 'chaffinch':
                // Descending, accelerating trill ending in a "chew-ee-oo" flourish
                return {
                    songs: [2, 4], gap: [4, 8],
                    trill1: { count: soundRandInt(4, 6), from: soundRand(5600, 6400), to: soundRand(4800, 5300), spacing: soundRand(0.07, 0.085) },
                    trill2: { count: soundRandInt(5, 8), from: soundRand(4300, 4700), to: soundRand(3300, 3700), spacing: soundRand(0.05, 0.06) },
                    flourishPeak: soundRand(4800, 5600)
                };
            case 'blackbird': {
                // Low, fluted phrases from a small personal repertoire, each followed by
                // a quiet high twitter
                const motifs = [];
                for (let m = 0; m < 4; m++) {
                    const notes = [];
                    const count = soundRandInt(3, 5);
                    for (let n = 0; n < count; n++) {
                        const contour = [];
                        let f = soundRand(1700, 2900);
                        for (let p = soundRandInt(3, 4); p > 0; p--) {
                            contour.push(f);
                            f = Math.min(3400, Math.max(1500, f * soundRand(0.85, 1.18)));
                        }
                        notes.push({ dur: soundRand(0.11, 0.32), gap: soundRand(0.03, 0.1), contour, gain: soundRand(0.7, 1) });
                    }
                    motifs.push(notes);
                }
                return { songs: [3, 5], gap: [2, 4], motifs };
            }
            case 'robin':
                // Thin, high, ever-changing phrases of whistles, trills and glides
                return { songs: [3, 6], gap: [2.5, 5], base: soundRand(3500, 4800) };
            case 'chiffchaff':
                // "chiff-chaff-chiff-chiff-chaff": two steeply falling notes in loose alternation
                return {
                    songs: [2, 4], gap: [3, 6],
                    high: soundRand(5600, 6400), low: soundRand(4300, 4900),
                    spacing: soundRand(0.3, 0.38)
                };
            case 'woodPigeon':
                // Soft, breathy "coo-COOO-coo, coo-coo", repeated a few times
                return {
                    songs: [2, 4], gap: [0.9, 1.4],
                    pitch: soundRand(420, 520),
                    wave: this.getWave('coo', [1, 0.25, 0.08])
                };
            case 'cuckoo':
                // "cu-coo" falling by about a third, repeated in one long series
                return {
                    songs: [1, 1], gap: [0, 0],
                    high: soundRand(640, 720), ratio: soundRand(0.8, 0.85),
                    period: soundRand(0.75, 0.95), count: [6, 14],
                    wave: this.getWave('cuckoo', [1, 0.12, 0.03])
                };
        }
        return null;
    }

    // Returns one song as a list of notes: { t, dur, f: [Hz contour], gain, ...playTone options }
    composeBirdSong(bird, isLastSong) {
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
                    const motif = soundPick(voice.motifs);
                    const tune = jitter();
                    motif.forEach(note => {
                        notes.push({ t, dur: note.dur, f: note.contour.map(f => f * tune), gain: note.gain, vibrato: 0.012 });
                        t += note.dur + note.gap;
                    });
                    t += 0.08;
                }
                // Twitter: fast, quiet, high squeaks
                const squeaks = soundRandInt(3, 7);
                for (let i = 0; i < squeaks; i++) {
                    const f = soundRand(5500, 8000);
                    notes.push({ t, dur: 0.03, f: [f * 0.85, f * 1.1, f * 0.9], gain: 0.35 });
                    t += soundRand(0.045, 0.065);
                }
                break;
            }
            case 'robin': {
                // Robins rarely repeat a phrase, so every song is improvised from three gestures
                let t = 0;
                const base = voice.base;
                const elements = soundRandInt(6, 11);
                for (let k = 0; k < elements; k++) {
                    const gesture = Math.random();
                    if (gesture < 0.4) {
                        const dur = soundRand(0.06, 0.18);
                        const f = Math.min(7500, base * soundRand(0.7, 1.6));
                        notes.push({ t, dur, f: [f * soundRand(0.9, 1.1), f, f * soundRand(0.85, 1.15)], gain: soundRand(0.5, 1) });
                        t += dur + soundRand(0.02, 0.06);
                    } else if (gesture < 0.7) {
                        const f = Math.min(7500, base * soundRand(0.8, 1.7));
                        const count = soundRandInt(3, 7);
                        for (let i = 0; i < count; i++) {
                            notes.push({ t, dur: 0.025, f: [f * 1.15, f * 0.9], gain: 0.6 });
                            t += 0.04;
                        }
                        t += soundRand(0.02, 0.05);
                    } else {
                        const dur = soundRand(0.1, 0.2);
                        const low = base * soundRand(0.6, 0.9);
                        const high = Math.min(8000, base * soundRand(1.4, 1.9));
                        notes.push({ t, dur, f: Math.random() < 0.5 ? [low, high] : [high, low], gain: soundRand(0.6, 0.9) });
                        t += dur + soundRand(0.03, 0.07);
                    }
                }
                break;
            }
            case 'chiffchaff': {
                const count = soundRandInt(6, 11);
                let high = Math.random() < 0.5;
                for (let i = 0; i < count; i++) {
                    const f = (high ? voice.high : voice.low) * jitter();
                    notes.push({ t: i * voice.spacing * soundRand(0.92, 1.08), dur: 0.07, f: [f * 1.12, f * 0.88], gain: soundRand(0.75, 1) });
                    // Mostly alternate, sometimes repeat the same note
                    if (Math.random() < 0.7) high = !high;
                }
                break;
            }
            case 'woodPigeon': {
                // coo-COOO-coo, coo-coo (the bout ends on a single cut-off "coo")
                const f = voice.pitch * jitter();
                const rhythm = isLastSong
                    ? [{ dur: 0.3, gap: 0, accent: false }]
                    : [
                        { dur: 0.3, gap: 0.08, accent: false },
                        { dur: 0.6, gap: 0.1, accent: true },
                        { dur: 0.3, gap: 0.35, accent: false },
                        { dur: 0.25, gap: 0.08, accent: false },
                        { dur: 0.3, gap: 0, accent: false }
                    ];
                let t = 0;
                rhythm.forEach(({ dur, gap, accent }) => {
                    const p = accent ? f * 1.05 : f;
                    notes.push({ t, dur, f: [p * 0.92, p * 1.02, p * 0.97], gain: accent ? 1 : 0.75, attack: 0.35, breath: 0.8 });
                    t += dur + gap;
                });
                break;
            }
            case 'cuckoo': {
                const count = soundRandInt(...voice.count);
                for (let i = 0; i < count; i++) {
                    const t = i * voice.period * soundRand(0.97, 1.03);
                    const high = voice.high * jitter();
                    const low = high * voice.ratio;
                    notes.push({ t, dur: 0.14, f: [high * 0.98, high, high * 0.99], gain: 1, breath: 0.6 });
                    notes.push({ t: t + 0.22, dur: 0.24, f: [low, low, low * 0.97], gain: 0.85, attack: 0.2, breath: 0.6 });
                }
                break;
            }
        }
        return notes;
    }

    // --- Public API ---

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

    // Page hidden: stop scheduling and freeze the audio clock, which also halts
    // the rain bed and any bout in progress
    pauseSoundGeneration() {
        this.stopScheduling();
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    }

    // Page visible again: unfreeze and let every individual pick up its own schedule
    resumeSoundGeneration() {
        if (!this.isInitialized || !this.audioContext) return;
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
        this.stopScheduling();
        this.startSoundGeneration();
    }

    destroy() {
        this.stopScheduling();

        Object.entries(this.soundConfigs).forEach(([soundType, config]) => {
            if (config.type === 'continuous') {
                this.stopContinuousSound(soundType);
            }
        });

        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    // Day and night have different casts: reshuffle the schedule so the new
    // cast starts within seconds instead of after a full rest
    updateTheme() {
        if (!this.isInitialized || !this.isPageVisible) return;
        this.stopScheduling();
        this.startSoundGeneration();
    }
}
