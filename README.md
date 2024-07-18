# DuoNat README

Best of both worlds: easy and fun learning experience with polished UI like Duolingo - all the awesomeness of biodiversity from iNaturalist!

## Debugging and Logging

This application uses a custom logger to manage debug output. The logger supports four levels of logging: ERROR, WARN, INFO, and DEBUG.

To see all log messages, including DEBUG level:

1. Open Chrome's Developer Tools (F12 or Ctrl+Shift+I)
2. Go to the Console tab
3. Ensure the log level dropdown is set to "All levels" or explicitly includes "Verbose" and "Debug"
4. In the Developer Tools settings (gear icon), under the "Console" section, make sure "Verbose" is checked in the "Log Levels"

You can adjust the log level in the `config.js` file:

```javascript
const config = {
    // ... other config options
    debug: true, // Set to false to exclude DEBUG level logs
    // ... other config options
};