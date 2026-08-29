const loader = document.getElementById('loader');
window.addEventListener('load', () => {
    if (loader) loader.classList.add('hidden');
});
setTimeout(() => {
    if (loader) loader.classList.add('hidden');
}, 1800);

const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');

function closeMobileMenu() {
    if (!mobileMenu || !menuToggle) return;
    mobileMenu.classList.remove('active');
    menuToggle.textContent = '☰';
    menuToggle.setAttribute('aria-expanded', 'false');
}

if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
        const open = mobileMenu.classList.toggle('active');
        menuToggle.textContent = open ? '✕' : '☰';
        menuToggle.setAttribute('aria-expanded', String(open));
    });

    mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobileMenu));
}

const header = document.querySelector('.header');
const navLinks = document.querySelectorAll('.nav-links a');
const sections = [...document.querySelectorAll('main section[id]')];

function updateHeaderAndNav() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 24);

    let current = '';
    sections.forEach(section => {
        if (window.scrollY >= section.offsetTop - 160) current = section.id;
    });

    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
}

window.addEventListener('scroll', updateHeaderAndNav, { passive: true });
updateHeaderAndNav();

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
        const selector = anchor.getAttribute('href');
        if (!selector || selector === '#') return;
        const target = document.querySelector(selector);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        closeMobileMenu();
    });
});

const revealTargets = document.querySelectorAll('.service-card, .project-card, .about-copy, .principles-panel, .contact-form');
revealTargets.forEach(el => el.classList.add('reveal'));

if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    revealTargets.forEach(el => observer.observe(el));
} else {
    revealTargets.forEach(el => el.classList.add('visible'));
}

const currentYear = document.getElementById('currentYear');
if (currentYear) currentYear.textContent = new Date().getFullYear();

function sendToWhatsApp(event) {
    event.preventDefault();

    const name = document.getElementById('name')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const project = document.getElementById('project')?.value.trim() || '';
    const message = document.getElementById('message')?.value.trim() || '';

    const text = [
        'Hello Quartz Web Solutions,',
        `Name: ${name}`,
        `Email: ${email}`,
        `Project: ${project || 'Not specified'}`,
        `Message: ${message || 'I would like to discuss a project.'}`
    ].join('\n');

    const phoneNumber = '918086035507';
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

window.sendToWhatsApp = sendToWhatsApp;
