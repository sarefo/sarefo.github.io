// UI control for nature sound mute/unmute toggle
class SoundToggle {
    constructor(soundGenerator) {
        this.soundGenerator = soundGenerator;
        this.toggleButton = null;
        this.createToggleUI();
    }

    createToggleUI() {
        // Create toggle button
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'sound-toggle';
        this.toggleButton.setAttribute('aria-label', 'Toggle nature sounds');
        this.toggleButton.setAttribute('title', 'Toggle nature sounds');

        // Set initial state
        this.updateButtonState();

        // Add event listener
        this.toggleButton.addEventListener('click', () => this.handleToggle());

        // Add keyboard support
        this.toggleButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleToggle();
            }
        });

        // Append to body (positioned via CSS)
        document.body.appendChild(this.toggleButton);
    }

    handleToggle() {
        const isMuted = this.soundGenerator.toggleMute();
        this.updateButtonState();
        this.announceStateChange(isMuted);
    }

    updateButtonState() {
        const isMuted = this.soundGenerator.getMuted();

        // Update icon
        this.toggleButton.innerHTML = isMuted
            ? this.getMutedIcon()
            : this.getUnmutedIcon();

        // Update ARIA attributes
        this.toggleButton.setAttribute('aria-pressed', !isMuted);
        this.toggleButton.setAttribute('title',
            isMuted ? 'Unmute nature sounds' : 'Mute nature sounds');
    }

    getUnmutedIcon() {
        // Speaker icon with sound waves
        return `
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
        `;
    }

    getMutedIcon() {
        // Speaker icon with X
        return `
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
        `;
    }

    announceStateChange(isMuted) {
        // Create screen reader announcement
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';

        announcement.textContent = isMuted
            ? 'Nature sounds muted'
            : 'Nature sounds unmuted';

        document.body.appendChild(announcement);

        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    destroy() {
        if (this.toggleButton && this.toggleButton.parentNode) {
            this.toggleButton.parentNode.removeChild(this.toggleButton);
        }
    }
}
