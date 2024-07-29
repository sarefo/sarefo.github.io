// Drag and drop functionality

import game from './game.js';
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
            element.addEventListener('touchstart', this.touchStart.bind(this), { passive: false });
            element.addEventListener('touchmove', this.touchMove.bind(this), { passive: false });
            element.addEventListener('touchend', this.touchEnd.bind(this), { passive: false });
        });

        document.querySelectorAll('.image-container').forEach(element => {
            element.addEventListener('dragover', this.dragOver.bind(this));
            element.addEventListener('dragleave', this.dragLeave.bind(this));
            element.addEventListener('drop', this.drop.bind(this));
        });
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
            this.draggedElement.style.zIndex = '';
            this.draggedElement.style.position = '';
            this.draggedElement.classList.remove('name-pair__item--dragging'); // Add this line
            this.draggedElement = null;
        }
    },

    updateElementPosition(touch) {
        if (!this.draggedElement || !this.gameContainer) return;

        const gameContainerRect = this.gameContainer.getBoundingClientRect();

        // Set left to 50% of the game container's width
        const leftPosition = gameContainerRect.left + (gameContainerRect.width / 2);

        // Position vertically based on touch position, with 40px upward offset
        const topPosition = touch.clientY - this.touchOffset.y - 40;

        this.draggedElement.style.left = `${leftPosition}px`;
        this.draggedElement.style.top = `${topPosition}px`;
    },

    resetDraggedElement() {
        if (!this.draggedElement) return;
        
        const originalContainer = this.draggedElement.id === 'left-name' ? 'name-pair__container--left' : 'name-pair__container--right';
        document.getElementsByClassName(originalContainer)[0].appendChild(this.draggedElement);
        this.draggedElement.classList.remove('name-pair__item--dragging');
        this.draggedElement.style.position = '';
        this.draggedElement.style.left = '';
        this.draggedElement.style.top = '';
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

    handleDrop(dropZone, draggedElement = this.draggedElement) {
        if (!draggedElement) return;

        dropZone.innerHTML = '';
        dropZone.appendChild(draggedElement);
        draggedElement.style.position = 'static';
        draggedElement.style.left = '';
        draggedElement.style.top = '';
        draggedElement.style.width = '100%';
        
        // Maintain the height set by setNamePairHeight
        draggedElement.style.height = document.querySelector('.name-pair').style.height;

        const otherNameId = draggedElement.id === 'left-name' ? 'right-name' : 'left-name';
        const otherName = document.getElementById(otherNameId);
        const otherDropZone = document.getElementById(dropZone.id === 'drop-1' ? 'drop-2' : 'drop-1');
        otherDropZone.innerHTML = '';
        otherDropZone.appendChild(otherName);
        
        // Maintain the height for the other name tile as well
        otherName.style.height = document.querySelector('.name-pair').style.height;

        game.checkAnswer(dropZone.id);
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
