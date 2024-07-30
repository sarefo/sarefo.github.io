const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const logger = {
    level: LogLevel.INFO, // Default log level

    setLevel(level) {
        this.level = level;
        console.log(`Log level set to: ${this.getLevelName(level)}`);
    },

    getLevelName(level) {
        return Object.keys(LogLevel).find(key => LogLevel[key] === level) || 'UNKNOWN';
    },

    error(message, ...args) {
        if (this.level >= LogLevel.ERROR) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    },

    warn(message, ...args) {
        if (this.level >= LogLevel.WARN) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },

    info(message, ...args) {
        if (this.level >= LogLevel.INFO) {
            console.info(`[INFO] ${message}`, ...args);
        }
    },

    debug(message, ...args) {
        if (this.level >= LogLevel.DEBUG) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    },

    // Method to change log level at runtime
    changeLogLevel(newLevel) {
        const oldLevel = this.getLevelName(this.level);
        this.setLevel(newLevel);
        console.log(`Log level changed from ${oldLevel} to ${this.getLevelName(this.level)}`);
    }
};

export default logger;
export { LogLevel };
