const tooltipManager = {
    tooltip: null,
    longPressTimer: null,
    longPressDuration: 500, // milliseconds

    init() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        document.body.appendChild(this.tooltip);

        this.addEventListeners();
    },

    addEventListeners() {
        const buttons = document.querySelectorAll('.button-column button, #help-button, .bottom-button');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', this.showTooltip.bind(this));
            button.addEventListener('mouseleave', this.hideTooltip.bind(this));
            button.addEventListener('touchstart', this.handleTouchStart.bind(this));
            button.addEventListener('touchend', this.handleTouchEnd.bind(this));
            button.addEventListener('touchmove', this.handleTouchMove.bind(this));
        });
    },

    showTooltip(event) {
        const button = event.target.closest('button');
        if (!button) return;

        const text = button.getAttribute('data-tooltip');
        if (!text) return;

        this.tooltip.textContent = text;
        this.tooltip.classList.add('visible');

        const rect = button.getBoundingClientRect();
        this.tooltip.style.left = `${rect.left + rect.width / 2 - this.tooltip.offsetWidth / 2}px`;
        this.tooltip.style.top = `${rect.bottom + 5}px`;
    },

    hideTooltip() {
        this.tooltip.classList.remove('visible');
    },

    handleTouchStart(event) {
        const button = event.target.closest('button');
        if (!button) return;

        this.longPressTimer = setTimeout(() => {
            this.showTooltip(event);
        }, this.longPressDuration);
    },

    handleTouchEnd() {
        clearTimeout(this.longPressTimer);
        this.hideTooltip();
    },

    handleTouchMove() {
        clearTimeout(this.longPressTimer);
        this.hideTooltip();
    }
};

export default tooltipManager;
