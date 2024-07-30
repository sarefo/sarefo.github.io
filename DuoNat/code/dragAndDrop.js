// Drag and drop functionality

import game from './game.js';
import { gameState } from './state.js';
import logger from './logger.js';

const dragAndDrop = {

    // tile dragging stuff
    draggedElement: null,
    touchOffset: { x: 0, y: 0 },
    gameContainer: null,

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

        this.draggedElement.classList.add('name-pair__item--dragging');
        this.draggedElement.style.zIndex = '1000';
        this.updateElementPosition(e);
    },

    mouseMove(e) {
        if (this.draggedElement) {
            e.preventDefault();
            this.updateElementPosition(e);
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
            this.draggedElement.classList.remove('name-pair__item--dragging');
            this.draggedElement.style.zIndex = '';
            this.draggedElement = null;
        }
    },

    dragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.id);
    },

    touchStart(e) {
        e.preventDefault();
        this.draggedElement = e.target.closest('.name-pair__item--draggable');
        if (!this.draggedElement) return;

        const touch = e.touches[0];
        const rect = this.draggedElement.getBoundingClientRect();
        this.touchOffset.x = touch.clientX - rect.left;
        this.touchOffset.y = touch.clientY - rect.top;

        this.draggedElement.classList.add('name-pair__item--dragging');
        this.draggedElement.style.zIndex = '1000'; // Set a high z-index
        this.updateElementPosition(touch);
    },

    touchMove(e) {
        e.preventDefault();
        if (this.draggedElement) {
            const touch = e.touches[0];
            this.updateElementPosition(touch);
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
            this.draggedElement.classList.remove('name-pair__item--dragging');
            this.draggedElement.style.zIndex = ''; // Reset z-index
            this.draggedElement = null;
        }
    },

    updateElementPosition(event) {
        if (!this.draggedElement || !this.gameContainer) return;

        const gameContainerRect = this.gameContainer.getBoundingClientRect();
        const elementWidth = 300; // Fixed width

        // Calculate center position
        const leftPosition = gameContainerRect.left + (gameContainerRect.width / 2) - (elementWidth / 2);
        
        // Position vertically based on event position, with 40px upward offset
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        const topPosition = clientY - this.touchOffset.y - 40;

        // Apply the positioning
        this.draggedElement.style.position = 'fixed';
        this.draggedElement.style.left = `${leftPosition}px`;
        this.draggedElement.style.top = `${topPosition}px`;
    },

    resetDraggedElement() {
        if (!this.draggedElement) return;
        
        const originalContainer = this.draggedElement.id === 'left-name' ? 'name-pair__container--left' : 'name-pair__container--right';
        const container = document.getElementsByClassName(originalContainer)[0];
        
        // Store the original styles
        const originalStyles = {
            position: this.draggedElement.style.position,
            left: this.draggedElement.style.left,
            top: this.draggedElement.style.top,
            width: this.draggedElement.style.width,
            height: this.draggedElement.style.height,
            zIndex: this.draggedElement.style.zIndex
        };

        // Reset classes and remove inline styles
        this.draggedElement.classList.remove('name-pair__item--dragging', 'name-pair__item--landing');
        this.draggedElement.style.position = '';
        this.draggedElement.style.left = '';
        this.draggedElement.style.top = '';
        this.draggedElement.style.width = '';
        this.draggedElement.style.height = '';
        this.draggedElement.style.zIndex = '';

        // Move the element back to its original container
        container.appendChild(this.draggedElement);

        // Force a reflow
        this.draggedElement.offsetHeight;

        // Re-apply the original styles if they were set
        if (originalStyles.position) this.draggedElement.style.position = originalStyles.position;
        if (originalStyles.left) this.draggedElement.style.left = originalStyles.left;
        if (originalStyles.top) this.draggedElement.style.top = originalStyles.top;
        if (originalStyles.width) this.draggedElement.style.width = originalStyles.width;
        if (originalStyles.height) this.draggedElement.style.height = originalStyles.height;
        if (originalStyles.zIndex) this.draggedElement.style.zIndex = originalStyles.zIndex;
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

            logger.debug(`Checking answer: Dragged ${draggedTaxon}, Correct ${correctTaxon}`);
            return draggedTaxon === correctTaxon;
        } catch (error) {
            logger.error('Error in checkAnswer:', error);
            return false;
        }
    },

    handleDrop(dropZone, draggedElement = this.draggedElement) {
        if (!draggedElement) return;

        const isCorrect = this.checkAnswer(dropZone.id, draggedElement.id);

        // Get the current position
        const currentRect = draggedElement.getBoundingClientRect();

        // Set the initial position
        draggedElement.style.position = 'fixed';
        draggedElement.style.left = `${currentRect.left}px`;
        draggedElement.style.top = `${currentRect.top}px`;
        draggedElement.style.width = `${currentRect.width}px`;
        draggedElement.style.height = `${currentRect.height}px`;

        // Add the element to the DOM
        document.body.appendChild(draggedElement);

        // Force a reflow
        draggedElement.offsetHeight;

        // Add the landing class to trigger the transition
        draggedElement.classList.add('name-pair__item--landing');

        let targetRect;
        if (isCorrect) {
            // Move to drop zone
            targetRect = dropZone.getBoundingClientRect();
        } else {
            // Return to original position
            const originalContainer = draggedElement.id === 'left-name' ? 
                document.querySelector('.name-pair__container--left') : 
                document.querySelector('.name-pair__container--right');
            targetRect = originalContainer.getBoundingClientRect();
        }

        draggedElement.style.left = `${targetRect.left}px`;
        draggedElement.style.top = `${targetRect.top}px`;
        draggedElement.style.width = `${targetRect.width}px`;
        draggedElement.style.height = `${targetRect.height}px`;

        // After the transition
        setTimeout(() => {
            draggedElement.classList.remove('name-pair__item--landing', 'name-pair__item--dragging');
            draggedElement.style.position = '';
            draggedElement.style.left = '';
            draggedElement.style.top = '';
            draggedElement.style.width = '';
            draggedElement.style.height = '';
            draggedElement.style.zIndex = '';

            if (isCorrect) {
                dropZone.innerHTML = '';
                dropZone.appendChild(draggedElement);

                // Handle the other name tile
                const otherNameId = draggedElement.id === 'left-name' ? 'right-name' : 'left-name';
                const otherName = document.getElementById(otherNameId);
                const otherDropZone = document.getElementById(dropZone.id === 'drop-1' ? 'drop-2' : 'drop-1');
                otherDropZone.innerHTML = '';
                otherDropZone.appendChild(otherName);

                // Call game.checkAnswer to proceed to the next round
                game.checkAnswer(dropZone.id);
            } else {
                const originalContainer = draggedElement.id === 'left-name' ? 
                    document.querySelector('.name-pair__container--left') : 
                    document.querySelector('.name-pair__container--right');
                originalContainer.appendChild(draggedElement);
            }

            // Add feedback class
            draggedElement.classList.add(isCorrect ? 'name-pair__item--correct' : 'name-pair__item--incorrect');
            setTimeout(() => {
                draggedElement.classList.remove('name-pair__item--correct', 'name-pair__item--incorrect');
            }, 600);
        }, 300);
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

};

export default dragAndDrop;
