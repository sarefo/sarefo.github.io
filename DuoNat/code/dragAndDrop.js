// Drag and drop functionality

import game from './game.js';
import logger from './logger.js';

const dragAndDrop = {

    // tile dragging stuff
    draggedElement: null,
    touchOffset: { x: 0, y: 0 },

    initialize() {
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

        this.draggedElement.style.zIndex = '1000';
        this.draggedElement.style.position = 'fixed';
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
            this.draggedElement = null;
        }
    },

    updateElementPosition(touch) {
        this.draggedElement.style.left = `${touch.clientX - this.touchOffset.x}px`;
        this.draggedElement.style.top = `${touch.clientY - this.touchOffset.y}px`;
    },

    dragOver(e) {
        e.preventDefault();
        if (e.target.classList.contains('image-container')) {
            e.target.classList.add('drag-over');
        }
    },

    dragLeave(e) {
        if (e.target.classList.contains('image-container')) {
            e.target.classList.remove('drag-over');
        }
    },

    drop(e) {
        e.preventDefault();
        const data = e.dataTransfer.getData('text');
        const draggedElement = document.getElementById(data);

        let dropZone;
        if (e.target.classList.contains('image-container')) {
            e.target.classList.remove('drag-over');
            dropZone = e.target.querySelector('div[id^="drop-"]');
        } else if (e.target.tagName === 'IMG') {
            e.target.parentElement.classList.remove('drag-over');
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
        draggedElement.style.position = 'static'; // Reset position to static
        draggedElement.style.left = '';
        draggedElement.style.top = '';
        draggedElement.style.width = '100%'; // Ensure the dragged element fills the drop zone width

        const otherNameId = draggedElement.id === 'left-name' ? 'right-name' : 'left-name';
        const otherName = document.getElementById(otherNameId);
        const otherDropZone = document.getElementById(dropZone.id === 'drop-1' ? 'drop-2' : 'drop-1');
        otherDropZone.innerHTML = '';
        otherDropZone.appendChild(otherName);

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

    resetDraggedElement() {
        const originalContainer = this.draggedElement.id === 'left-name' ? 'name-pair__container--left' : 'name-pair__container--right';
        document.getElementsByClassName(originalContainer)[0].appendChild(this.draggedElement);
        this.draggedElement.style.position = '';
        this.draggedElement.style.left = '';
        this.draggedElement.style.top = '';
    }
};

export default dragAndDrop;
