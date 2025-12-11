// Main JavaScript for sarefo.github.io

// Email obfuscation and reveal functionality
class EmailProtection {
    constructor() {
        this.emailParts = ['sarefo', 'gmail', 'com'];
        this.emailElement = null;
        this.isRevealed = false;
        this.init();
    }

    init() {
        this.emailElement = document.getElementById('contact-email');
        if (this.emailElement) {
            this.setupEmailReveal(this.emailElement);
        }
    }

    setupEmailReveal(element) {
        // Initially show localized placeholder
        this.updateEmailText();
        
        // Add click handler to reveal actual email
        element.addEventListener('click', (e) => {
            e.preventDefault();
            this.revealEmail(element);
        });

        // Add keyboard support
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.revealEmail(element);
            }
        });
    }

    revealEmail(element) {
        const email = `${this.emailParts[0]}@${this.emailParts[1]}.${this.emailParts[2]}`;
        element.innerHTML = `
            <svg class="email-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"/>
            </svg>
            ${email}
        `;
        element.href = `mailto:${email}`;
        element.setAttribute('aria-label', `Email ${email}`);
        
        // Remove click handler after reveal
        element.onclick = null;
        element.onkeydown = null;
        this.isRevealed = true;
    }

    updateEmailText() {
        if (!this.emailElement || this.isRevealed) return;
        
        const currentLanguage = localStorage.getItem('selectedLanguage') || 'en';
        const translation = translations[currentLanguage] || translations['en'];
        const revealText = translation.emailRevealText || 'Click to reveal email';
        
        this.emailElement.textContent = revealText;
        this.emailElement.setAttribute('aria-label', revealText);
    }
}

// GitHub projects toggle functionality
class GitHubToggle {
    constructor() {
        this.isExpanded = false;
        this.init();
    }

    init() {
        const githubSection = document.querySelector('.github-section');
        const githubHeader = document.querySelector('.github-header');
        
        if (githubHeader && githubSection) {
            this.setupToggle(githubHeader, githubSection);
        }
    }

    setupToggle(header, section) {
        header.addEventListener('click', () => {
            this.toggle(section);
        });

        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle(section);
            }
        });

        // Set initial ARIA attributes
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', 'false');
        header.setAttribute('aria-controls', 'github-projects');
        header.setAttribute('tabindex', '0');
        
        const projectsList = document.querySelector('.github-projects');
        if (projectsList) {
            projectsList.setAttribute('id', 'github-projects');
        }
    }

    toggle(section) {
        this.isExpanded = !this.isExpanded;
        
        if (this.isExpanded) {
            section.classList.add('expanded');
        } else {
            section.classList.remove('expanded');
        }
        
        // Update ARIA attributes
        const header = section.querySelector('.github-header');
        if (header) {
            header.setAttribute('aria-expanded', this.isExpanded.toString());
        }
        
        // Announce to screen readers
        const announcement = this.isExpanded ? 'Expanded GitHub projects' : 'Collapsed GitHub projects';
        this.announceToScreenReader(announcement);
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';
        
        document.body.appendChild(announcement);
        announcement.textContent = message;
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
}

// Android detection and URL redirection
class AndroidRedirect {
    constructor() {
        this.init();
    }

    init() {
        if (this.isAndroid()) {
            this.updateDuoNatLink();
        }
    }

    isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    updateDuoNatLink() {
        const duoNatLink = document.querySelector('a[href="https://duo-nat.web.app"]');
        if (duoNatLink) {
            duoNatLink.href = 'https://play.google.com/store/apps/details?id=app.duo_nat';
        }
    }
}

// Content toggle functionality
class ContentToggle {
    constructor() {
        this.isHidden = false;
        this.init();
    }

    init() {
        const headerElement = document.querySelector('.header h1');
        if (headerElement) {
            this.setupToggle(headerElement);
        }
    }

    setupToggle(element) {
        element.style.cursor = 'pointer';
        element.style.userSelect = 'none';

        element.addEventListener('click', () => {
            this.toggle();
        });

        // Keyboard support
        element.setAttribute('tabindex', '0');
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    toggle() {
        this.isHidden = !this.isHidden;

        // Select all non-nature elements
        const elementsToToggle = [
            '.language-switcher',
            '.contact-email',
            '.hero-section',
            '.content-sections',
            '.github-section'
        ];

        elementsToToggle.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.visibility = this.isHidden ? 'hidden' : 'visible';
            }
        });
    }
}

// Theme detection and handling
class ThemeManager {
    constructor() {
        this.themes = {
            'ink-light': {
                name: 'Ink on Paper',
                metaColor: '#ffffff'
            },
            'ink-dark': {
                name: 'Inverted',
                metaColor: '#0a0a0a'
            },
            'original-light': {
                name: 'Original Light',
                metaColor: '#f0f8f0'
            },
            'original-dark': {
                name: 'Original Dark',
                metaColor: '#2a2a2a'
            }
        };
        this.currentTheme = null;
        this.init();
    }

    init() {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('preferredTheme');
        
        if (savedTheme && this.themes[savedTheme]) {
            this.setTheme(savedTheme);
        } else {
            // Use system preference to determine initial theme
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                const defaultTheme = mediaQuery.matches ? 'ink-dark' : 'ink-light';
                this.setTheme(defaultTheme);
                
                // Listen for system theme changes only if no manual preference
                mediaQuery.addEventListener('change', (e) => {
                    if (!localStorage.getItem('preferredTheme')) {
                        this.setTheme(e.matches ? 'ink-dark' : 'ink-light');
                    }
                });
            } else {
                this.setTheme('ink-light');
            }
        }
    }

    setTheme(themeName) {
        if (!this.themes[themeName]) return;
        
        this.currentTheme = themeName;
        document.documentElement.setAttribute('data-theme', themeName);
        
        // Update meta theme-color for mobile browsers
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = this.themes[themeName].metaColor;
    }

    toggleTheme() {
        // Cycle through themes: ink-light -> ink-dark -> ink-light
        const newTheme = this.currentTheme === 'ink-light' ? 'ink-dark' : 'ink-light';
        this.setTheme(newTheme);
        localStorage.setItem('preferredTheme', newTheme);
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const themeManager = new ThemeManager();
    const emailProtection = new EmailProtection();
    const contentToggle = new ContentToggle();
    new GitHubToggle();
    new AndroidRedirect();

    // Expose for external access
    window.themeManager = themeManager;
    window.emailProtection = emailProtection;
    window.contentToggle = contentToggle;
});

// Handle any uncaught errors gracefully
window.addEventListener('error', (e) => {
    console.warn('JavaScript error occurred:', e.error);
    // Don't let JS errors break the basic functionality
});

// Export for potential future use
window.SarefoSite = {
    EmailProtection,
    GitHubToggle,
    ThemeManager,
    AndroidRedirect,
    ContentToggle
};