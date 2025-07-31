// Main JavaScript for sarefo.github.io

// Email obfuscation and reveal functionality
class EmailProtection {
    constructor() {
        this.emailParts = ['sarefo', 'gmail', 'com'];
        this.init();
    }

    init() {
        const emailElement = document.getElementById('contact-email');
        if (emailElement) {
            this.setupEmailReveal(emailElement);
        }
    }

    setupEmailReveal(element) {
        // Initially show a placeholder
        element.textContent = 'Click to reveal email';
        element.setAttribute('aria-label', 'Click to reveal email address');
        
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
        const email = this.emailParts.join('@').replace('@', '@');
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

// Smooth scrolling for internal links (if any)
class SmoothScroll {
    constructor() {
        this.init();
    }

    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }
}

// Performance and analytics (minimal)
class PageAnalytics {
    constructor() {
        this.startTime = performance.now();
        this.init();
    }

    init() {
        // Track page load time
        window.addEventListener('load', () => {
            const loadTime = performance.now() - this.startTime;
            console.log(`Page loaded in ${Math.round(loadTime)}ms`);
        });

        // Track external link clicks (without personal data)
        document.querySelectorAll('a[href^="http"]').forEach(link => {
            link.addEventListener('click', () => {
                const domain = new URL(link.href).hostname;
                console.log(`External link clicked: ${domain}`);
            });
        });
    }
}

// Theme detection and handling
class ThemeManager {
    constructor() {
        this.init();
    }

    init() {
        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                this.handleThemeChange(e.matches);
            });
            
            // Initial check
            this.handleThemeChange(mediaQuery.matches);
        }
    }

    handleThemeChange(isDark) {
        // Update meta theme-color for mobile browsers
        let themeColor = isDark ? '#1a1a1a' : '#f9f9f9';
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        
        metaThemeColor.content = themeColor;
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new EmailProtection();
    new GitHubToggle();
    new SmoothScroll();
    new PageAnalytics();
    new ThemeManager();
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
    SmoothScroll,
    PageAnalytics,
    ThemeManager
};