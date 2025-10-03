// Theme color management for nature scene elements
class ThemeHandler {
    isDarkTheme() {
        const theme = document.documentElement.getAttribute('data-theme');
        return theme?.includes('dark') || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    getWaterColor(opacity) {
        const isDark = this.isDarkTheme();
        const grey = isDark ? 230 : 70;
        return `rgba(${grey}, ${grey}, ${grey}, ${opacity || 0.15})`;
    }

    getInsectColor() {
        const isDark = this.isDarkTheme();
        const grey = isDark ? 220 : 60;
        return `rgba(${grey}, ${grey}, ${grey}, 0.5)`;
    }

    getSeaStarColor() {
        const isDark = this.isDarkTheme();
        const grey = isDark ? 140 : 160;
        return `rgba(${grey}, ${grey}, ${grey}, 0.8)`;
    }

    getFloralColor() {
        const isDark = this.isDarkTheme();
        const grey = isDark ? 100 : 40;
        return `rgba(${grey}, ${grey}, ${grey}, 0.8)`;
    }
}
