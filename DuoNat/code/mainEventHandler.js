import eventInitializer from './eventInitializer.js';
import hintSystem from './hintSystem.js';
import keyboardShortcuts from './keyboardShortcuts.js';
import searchHandler from './searchHandler.js';
import swipeHandler from './swipeHandler.js';
import uiInteractions from './uiInteractions.js';

const mainEventHandler = {
    initialize() {
        swipeHandler.initialize();
        keyboardShortcuts.initialize();
        uiInteractions.initialize();
        searchHandler.initialize();
        hintSystem.initialize();
        eventInitializer.initialize();
    },

    // TODO seems redundant, try to fix later
    enableKeyboardShortcuts: keyboardShortcuts.enable,
    disableKeyboardShortcuts: keyboardShortcuts.disable,

    enableSwipe: swipeHandler.enable,
    disableSwipe: swipeHandler.disable,

    setFocusLost: searchHandler.setFocusLost,
    resetScrollPosition: searchHandler.resetScrollPosition,
    resetSearch: searchHandler.resetSearch,
};

export default mainEventHandler;
