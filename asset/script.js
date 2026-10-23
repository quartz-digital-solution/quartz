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

// Optional managed Cloudflare Turnstile; never trust a client-side token without server verification.
let enquiryTurnstileKey = '', enquiryTurnstileToken = '', enquiryWidgetId = null;
async function setupEnquiryVerification() {
    try {
        const r = await fetch('/api/public/config', {cache:'no-store', credentials:'omit'});
        if (!r.ok) return;
        const config = await r.json();
        if (!config.turnstile_site_key) return;
        enquiryTurnstileKey = config.turnstile_site_key;
        const container = document.getElementById('enquiryVerification');
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = () => {
            if (!window.turnstile) return;
            enquiryWidgetId = window.turnstile.render(container, {
                sitekey: enquiryTurnstileKey,
                callback: token => {enquiryTurnstileToken = token;},
                'expired-callback': () => {enquiryTurnstileToken='';},
                'error-callback': () => {enquiryTurnstileToken='';}
            });
        };
        script.onerror = () => { container.textContent='Security verification could not load. Please refresh and retry.'; };
        document.head.appendChild(script);
    } catch { /* Public form continues without Turnstile only if server-side verification is not enabled. */ }
}
const startProjectBtn=document.getElementById('startProjectBtn');
if(startProjectBtn)startProjectBtn.addEventListener('click',()=>{
    const section=document.getElementById('contact');
    if(!section)return;
    section.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    if(window.location.hash!=='#contact')history.replaceState(null,'','#contact');
    closeMobileMenu();
    const field=document.getElementById('name');
    if(field)field.focus({preventScroll:true});
});
const enquiryForm = document.getElementById('enquiryForm');
if (enquiryForm) enquiryForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('enquirySubmit');
    const status = document.getElementById('enquiryStatus');
    const payload = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        project: document.getElementById('project').value.trim(),
        message: document.getElementById('message').value.trim(),
        company_url: document.getElementById('company_url').value,
        turnstile_token: enquiryTurnstileToken
    };
    if (!payload.project && !payload.message) {
        status.textContent = 'Please describe your project before sending.';
        status.className = 'enquiry-status error';
        return;
    }
    if (enquiryTurnstileKey && !enquiryTurnstileToken) {
        status.textContent='Please complete the security verification.';
        status.className='enquiry-status error';
        return;
    }
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy','true');
    button.classList.add('submitting');
    status.textContent = '';
    status.className = 'enquiry-status';
    try {
        const response = await fetch('/api/enquiries', {
            method: 'POST', cache: 'no-store', credentials: 'same-origin',
            headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result || result.ok !== true) {
            let detail = result?.error || 'Could not submit your enquiry.';
            if (response.status === 404 || response.status === 405) detail = 'Enquiry service is unavailable. The site owner must check the Cloudflare Pages Worker deployment.';
            else if (response.status >= 500 && !result?.error) detail = 'Enquiry service error. The site owner must check the Cloudflare D1 binding and Worker logs.';
            else if (!result && response.ok) detail = 'The enquiry server did not confirm receipt. Please try again later.';
            throw new Error(detail);
        }
        status.textContent = 'Enquiry received successfully' + (Number.isSafeInteger(result.enquiry_id) && result.enquiry_id > 0 ? ` (reference #${result.enquiry_id})` : '') + '. We will contact you soon.';
        status.classList.add('success');
        enquiryForm.reset();
        enquiryTurnstileToken='';
        if (enquiryWidgetId !== null && window.turnstile) window.turnstile.reset(enquiryWidgetId);
    } catch (error) {
        status.textContent = error.message || 'Something went wrong. Please try again.';
        status.classList.add('error');
        enquiryTurnstileToken='';
        if (enquiryWidgetId !== null && window.turnstile) window.turnstile.reset(enquiryWidgetId);
    } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.classList.remove('submitting');
    }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

if (enquiryForm) setupEnquiryVerification();
