// Internationalization functionality
class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.init();
    }

    init() {
        // Get saved language from localStorage or default to English
        this.currentLanguage = localStorage.getItem('selectedLanguage') || 'en';
        
        // Set up language switcher event listeners
        this.setupLanguageSwitcher();
        
        // Load the current language
        this.loadLanguage(this.currentLanguage);
    }

    setupLanguageSwitcher() {
        const languageButtons = document.querySelectorAll('.language-btn');
        
        languageButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const selectedLanguage = e.target.dataset.lang;
                this.switchLanguage(selectedLanguage);
            });
        });
    }

    switchLanguage(language) {
        if (this.currentLanguage === language) return;
        
        // Update active button
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.lang === language) {
                btn.classList.add('active');
            }
        });
        
        // Load new language
        this.loadLanguage(language);
        
        // Save to localStorage
        localStorage.setItem('selectedLanguage', language);
        
        this.currentLanguage = language;
    }

    loadLanguage(language) {
        if (!translations[language]) {
            console.warn(`Language ${language} not found, falling back to English`);
            language = 'en';
        }

        const translation = translations[language];
        
        // Update document language
        document.documentElement.lang = language;
        
        // Update meta tags
        this.updateMetaTags(translation);
        
        // Update all elements with data-i18n attributes
        this.updateTextContent(translation);
        
        // Update aria-labels and other attributes
        this.updateAttributes(translation);
        
        // Set active language button
        this.setActiveLanguageButton(language);
    }

    updateMetaTags(translation) {
        // Update title
        document.title = translation.title;
        
        // Update meta description
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.content = translation.description;
        }
        
        // Update Open Graph tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            ogTitle.content = translation.ogTitle;
        }
        
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) {
            ogDescription.content = translation.ogDescription;
        }
    }

    updateTextContent(translation) {
        // Update all elements with data-i18n attributes
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.dataset.i18n;
            if (translation[key]) {
                element.textContent = translation[key];
            }
        });
    }

    updateAttributes(translation) {
        // Update aria-label attributes
        document.querySelectorAll('[data-i18n-aria]').forEach(element => {
            const key = element.dataset.i18nAria;
            if (translation[key]) {
                element.setAttribute('aria-label', translation[key]);
            }
        });
    }

    setActiveLanguageButton(language) {
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.lang === language) {
                btn.classList.add('active');
            }
        });
    }
}

// Initialize i18n when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new I18n();
});