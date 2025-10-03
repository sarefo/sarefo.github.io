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
        
        // Ensure URL updates are applied even on initial load
        setTimeout(() => {
            this.updateLanguageUrls(this.currentLanguage);
        }, 100);
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

        // Update email text if email protection is available
        if (window.emailProtection) {
            window.emailProtection.updateEmailText();
        }
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
        
        // Update language-dependent URLs
        this.updateLanguageUrls(language);
        
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

    updateLanguageUrls(language) {
        // Update LocNat guide link with language parameter
        // Use multiple selectors to ensure we find the link
        const locnatLink = document.querySelector('a[href="guide/index.html"]') ||
                          document.querySelector('a[href^="guide/index.html"]') ||
                          document.querySelector('a.hero-card[href^="guide"]');

        if (locnatLink) {
            const oldHref = locnatLink.href;
            if (language === 'en') {
                locnatLink.href = 'guide/index.html';
            } else {
                locnatLink.href = `guide/index.html?lang=${language}`;
            }
            console.log(`Updated LocNat link from "${oldHref}" to "${locnatLink.href}" for language: ${language}`);
        } else {
            console.warn('LocNat link not found for language update');
        }

        // Update calendar link with language parameter for German and Spanish only
        const calendarLink = document.querySelector('a[href^="/calendar/"]');

        if (calendarLink) {
            if (language === 'de' || language === 'es') {
                calendarLink.href = `/calendar/?print=1&lang=${language}`;
            } else {
                calendarLink.href = '/calendar/?print=1';
            }
        }
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