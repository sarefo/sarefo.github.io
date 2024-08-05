import gameLogic from './gameLogic.js';
import { gameState } from './state.js';
import logger from './logger.js';

const dragAndDrop = {

    // tile dragging stuff
    draggedElement: null,
    touchOffset: { x: 0, y: 0 },
    gameContainer: null,
    initialY: 0,

    initialize() {
        this.gameContainer = document.querySelector('.game-container');
        this.addEventListeners();
    },

    addEventListeners() {
        document.querySelectorAll('.name-pair__item--draggable').forEach(element => {
            element.addEventListener('dragstart', this.dragStart.bind(this));
            element.addEventListener('mousedown', this.mouseStart.bind(this));
            element.addEventListener('touchstart', this.touchStart.bind(this), { passive: false });
            element.addEventListener('touchmove', this.touchMove.bind(this), { passive: false });
            element.addEventListener('touchend', this.touchEnd.bind(this), { passive: false });
        });

        document.addEventListener('mousemove', this.mouseMove.bind(this));
        document.addEventListener('mouseup', this.mouseEnd.bind(this));

        document.querySelectorAll('.image-container').forEach(element => {
            element.addEventListener('dragover', this.dragOver.bind(this));
            element.addEventListener('dragleave', this.dragLeave.bind(this));
            element.addEventListener('drop', this.drop.bind(this));
        });
    },

    mouseStart(e) {
        e.preventDefault();
        this.draggedElement = e.target.closest('.name-pair__item--draggable');
        if (!this.draggedElement) return;

        const rect = this.draggedElement.getBoundingClientRect();
        this.touchOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        this.initialY = e.clientY;
        this.captureOtherElementPosition();

        this.draggedElement.classList.add('name-pair__item--dragging');
        this.draggedElement.style.zIndex = '1000';
        this.updateElementPosition(e);
    },

    touchStart(e) {
        e.preventDefault();
        this.draggedElement = e.target.closest('.name-pair__item--draggable');
        if (!this.draggedElement) return;

        const touch = e.touches[0];
        const rect = this.draggedElement.getBoundingClientRect();
        this.touchOffset = {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
        this.initialY = touch.clientY;
        this.captureOtherElementPosition();

        this.draggedElement.classList.add('name-pair__item--dragging');
        this.draggedElement.style.zIndex = '1000';
        this.updateElementPosition(touch);
    },

    captureOtherElementPosition() {
        const otherElement = this.draggedElement.id === 'left-name' ?
            document.getElementById('right-name') :
            document.getElementById('left-name');
        if (otherElement) {
            const rect = otherElement.getBoundingClientRect();
            this.otherElementInitialY = rect.top;
        }
    },

    mouseMove(e) {
        if (this.draggedElement) {
            e.preventDefault();
            this.updateElementPosition(e);
        }
    },

    dragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.id);
    },

    touchMove(e) {
        e.preventDefault();
        if (this.draggedElement) {
            const touch = e.touches[0];
            this.updateElementPosition(touch);
        }
    },

    mouseEnd(e) {
        if (this.draggedElement) {
            const dropZone = this.getDropZone(e);
            if (dropZone) {
                this.handleDrop(dropZone);
            } else {
                this.resetDraggedElement();
            }
            this.draggedElement = null;
        }
    },

    touchEnd(e) {
        e.preventDefault();
        if (this.draggedElement) {
            const dropZone = this.getDropZone(e);
            if (dropZone) {
                this.handleDrop(dropZone);
            } else {
                this.resetDraggedElement();
            }
            this.draggedElement = null;
        }
    },

    resetDraggedElement() {
        if (!this.draggedElement) return;

        const elements = [
            this.draggedElement,
            this.draggedElement.id === 'left-name' ? document.getElementById('right-name') : document.getElementById('left-name')
        ];

        elements.forEach(element => {
            const originalContainer = element.id === 'left-name' ? 'name-pair__container--left' : 'name-pair__container--right';
            const container = document.getElementsByClassName(originalContainer)[0];

            element.classList.remove('name-pair__item--dragging', 'name-pair__item--landing');
            element.style = '';
            container.appendChild(element);
        });

        this.draggedElement = null;
    },

    resetOtherElement() {
        const otherElement = this.draggedElement.id === 'left-name' ?
            document.getElementById('right-name') :
            document.getElementById('left-name');

        if (otherElement) {
            const originalContainer = otherElement.id === 'left-name' ? 'name-pair__container--left' : 'name-pair__container--right';
            const container = document.getElementsByClassName(originalContainer)[0];

            otherElement.style = '';
            container.appendChild(otherElement);
        }
    },

    updateElementPosition(event) {
        if (!this.draggedElement || !this.gameContainer) return;

        const gameContainerRect = this.gameContainer.getBoundingClientRect();
        const elementWidth = this.draggedElement.offsetWidth;

        // Calculate center position
        const leftPosition = gameContainerRect.left + (gameContainerRect.width / 2) - (elementWidth / 2);

        // Calculate vertical position
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        const deltaY = clientY - this.initialY;
        const topPosition = clientY - this.touchOffset.y;

        // Apply the positioning to the dragged element
        this.draggedElement.style.position = 'fixed';
        this.draggedElement.style.left = `${leftPosition}px`;
        this.draggedElement.style.top = `${topPosition}px`;

        // Mirror the other element
        this.mirrorOtherElement(deltaY);
    },

    mirrorOtherElement(deltaY) {
        const otherElement = this.draggedElement.id === 'left-name' ?
            document.getElementById('right-name') :
            document.getElementById('left-name');

        if (otherElement) {
            const gameContainerRect = this.gameContainer.getBoundingClientRect();
            const elementWidth = otherElement.offsetWidth;
            const leftPosition = gameContainerRect.left + (gameContainerRect.width / 2) - (elementWidth / 2);

            otherElement.style.position = 'fixed';
            otherElement.style.left = `${leftPosition}px`;
            otherElement.style.top = `${this.otherElementInitialY - deltaY}px`;
        }
    },

    dragOver(e) {
        e.preventDefault();
        if (e.target.classList.contains('image-container')) {
            e.target.classList.add('image-container--drag-over');
        }
    },

    dragLeave(e) {
        if (e.target.classList.contains('image-container')) {
            e.target.classList.remove('image-container--drag-over');
        }
    },

    drop(e) {
        e.preventDefault();
        const data = e.dataTransfer.getData('text');
        const draggedElement = document.getElementById(data);

        let dropZone;
        if (e.target.classList.contains('image-container')) {
            e.target.classList.remove('image-container--drag-over');
            dropZone = e.target.querySelector('div[id^="drop-"]');
        } else if (e.target.tagName === 'IMG') {
            e.target.parentElement.classList.remove('image-container--drag-over');
            dropZone = e.target.nextElementSibling;
        } else {
            return; // Drop on an invalid target
        }

        this.handleDrop(dropZone, draggedElement);
    },

    checkAnswer(dropZoneId, draggedElementId) {
        try {
            const isLeftDrop = dropZoneId === 'drop-1';
            const draggedElement = document.getElementById(draggedElementId);

            if (!draggedElement) {
                logger.error('Dragged element not found');
                return false;
            }

            const draggedTaxon = draggedElement.getAttribute('data-taxon');

            if (!gameState) {
                logger.error('gameState is undefined');
                return false;
            }

            const correctTaxon = isLeftDrop ? gameState.taxonImageOne : gameState.taxonImageTwo;

            if (!correctTaxon) {
                logger.error('Correct taxon is undefined in gameState');
                return false;
            }

//            logger.debug(`Checking answer: Dragged ${draggedTaxon}, Correct ${correctTaxon}`);
            return draggedTaxon === correctTaxon;
        } catch (error) {
            logger.error('Error in checkAnswer:', error);
            return false;
        }
    },

    getDropZone(e) {
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        const imageContainers = document.querySelectorAll('.image-container');
        for (let container of imageContainers) {
            const rect = container.getBoundingClientRect();
            if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                return container.querySelector('div[id^="drop-"]');
            }
        }
        return null;
    },

    handleDrop(dropZone, draggedElement = this.draggedElement) {
        if (!draggedElement) return;

        const isCorrect = this.checkAnswer(dropZone.id, draggedElement.id);
        const otherElement = draggedElement.id === 'left-name' ?
            document.getElementById('right-name') :
            document.getElementById('left-name');

        // Handle both elements
        this.animateElement(draggedElement, dropZone, isCorrect);
        this.animateElement(otherElement, this.getOtherDropZone(dropZone), isCorrect);

        // After the transition
        setTimeout(() => {
            this.finalizeDropAnimation(draggedElement, otherElement, dropZone, isCorrect);
        }, 300);
    },

    getOtherDropZone(dropZone) {
        return document.getElementById(dropZone.id === 'drop-1' ? 'drop-2' : 'drop-1');
    },

    animateElement(element, targetZone, isCorrect) {
        const currentRect = element.getBoundingClientRect();
        let targetRect;

        if (isCorrect) {
            targetRect = targetZone.getBoundingClientRect();
        } else {
            const originalContainer = element.id === 'left-name' ?
                document.querySelector('.name-pair__container--left') :
                document.querySelector('.name-pair__container--right');
            targetRect = originalContainer.getBoundingClientRect();
        }

        element.style.position = 'fixed';
        element.style.left = `${currentRect.left}px`;
        element.style.top = `${currentRect.top}px`;
        element.style.width = `${currentRect.width}px`;
        element.style.height = `${currentRect.height}px`;
        element.style.zIndex = '1000';

        document.body.appendChild(element);
        element.offsetHeight; // Force reflow
        element.classList.add('name-pair__item--landing');

        element.style.left = `${targetRect.left}px`;
        element.style.top = `${targetRect.top}px`;
        element.style.width = `${targetRect.width}px`;
        element.style.height = `${targetRect.height}px`;
    },

    finalizeDropAnimation(draggedElement, otherElement, dropZone, isCorrect) {
        [draggedElement, otherElement].forEach(element => {
            element.classList.remove('name-pair__item--landing', 'name-pair__item--dragging');
            element.style.position = '';
            element.style.left = '';
            element.style.top = '';
            element.style.width = '';
            element.style.height = '';
            element.style.zIndex = '';
        });

        if (isCorrect) {
            dropZone.innerHTML = '';
            dropZone.appendChild(draggedElement);

            const otherDropZone = this.getOtherDropZone(dropZone);
            otherDropZone.innerHTML = '';
            otherDropZone.appendChild(otherElement);

            // Call game.checkAnswer to proceed to the next round
            gameLogic.checkAnswer(dropZone.id);
        } else {
            const leftContainer = document.querySelector('.name-pair__container--left');
            const rightContainer = document.querySelector('.name-pair__container--right');

            leftContainer.appendChild(document.getElementById('left-name'));
            rightContainer.appendChild(document.getElementById('right-name'));
        }

        // Add feedback class
        draggedElement.classList.add(isCorrect ? 'name-pair__item--correct' : 'name-pair__item--incorrect');
        setTimeout(() => {
            draggedElement.classList.remove('name-pair__item--correct', 'name-pair__item--incorrect');
        }, 600);
    },

};

export default dragAndDrop;
