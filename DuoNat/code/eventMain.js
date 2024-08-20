import eventInitializer from './eventInitializer.js';
import keyboardShortcuts from './keyboardShortcuts.js';
import eventUIButtons from './eventUIButtons.js';
import searchHandler from './searchHandler.js';
import swipeHandler from './swipeHandler.js';

const eventMain = {
    initialize() {
        eventInitializer.initialize();
        keyboardShortcuts.initialize();
        eventUIButtons.initialize();
        searchHandler.initialize();
        swipeHandler.initialize();

    },

    enableKeyboardShortcuts: keyboardShortcuts.enable,
    disableKeyboardShortcuts: keyboardShortcuts.disable,

    enableSwipe: swipeHandler.enable,
    disableSwipe: swipeHandler.disable,

    setFocusLost: searchHandler.setFocusLost,
    resetScrollPosition: searchHandler.resetScrollPosition,
    resetSearch: searchHandler.resetSearch,
};

export default eventMain;
