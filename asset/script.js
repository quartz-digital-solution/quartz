// LOADER

window.addEventListener("load", () => {
    const loader = document.getElementById("loader");

    setTimeout(() => {
        loader.style.opacity = "0";

        setTimeout(() => {
            loader.style.display = "none";
        }, 500);

    }, 1200);
});

// MOBILE MENU

const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector(".mobile-menu");

menuToggle.addEventListener("click", () => {
    mobileMenu.classList.toggle("active");

    if (mobileMenu.classList.contains("active")) {
        menuToggle.innerHTML = "✕";
    } else {
        menuToggle.innerHTML = "☰";
    }
});

// CLOSE MENU AFTER CLICK

document.querySelectorAll(".mobile-menu a").forEach(link => {
    link.addEventListener("click", () => {
        mobileMenu.classList.remove("active");
        menuToggle.innerHTML = "☰";
    });
});

// HEADER SCROLL EFFECT

const header = document.querySelector(".header");

window.addEventListener("scroll", () => {

    if (window.scrollY > 50) {

        header.style.background =
            "rgba(0,0,0,0.92)";

        header.style.boxShadow =
            "0 10px 40px rgba(255,0,30,.15)";

    } else {

        header.style.background =
            "rgba(0,0,0,.75)";

        header.style.boxShadow =
            "none";
    }

});

// COUNTER ANIMATION

const counters =
document.querySelectorAll(".stat-box h2");

let counterStarted = false;

function runCounters() {

    if (counterStarted) return;

    const statsSection =
        document.querySelector(".stats");

    const sectionTop =
        statsSection.getBoundingClientRect().top;

    if (sectionTop < window.innerHeight - 100) {

        counterStarted = true;

        counters.forEach(counter => {

            const originalText =
                counter.innerText;

            const target =
                parseInt(originalText);

            if (isNaN(target)) return;

            let count = 0;

            const speed = target / 100;

            const updateCounter = () => {

                count += speed;

                if (count < target) {

                    counter.innerText =
                        Math.floor(count);

                    requestAnimationFrame(updateCounter);

                } else {

                    counter.innerText =
                        originalText;
                }

            };

            updateCounter();

        });

    }

}

window.addEventListener("scroll", runCounters);

// REVEAL ANIMATION

const revealElements = document.querySelectorAll(
    ".service-card, .project-card, .about-box, .stat-box"
);

const revealObserver = new IntersectionObserver(

(entries) => {

entries.forEach(entry => {

if (entry.isIntersecting) {

entry.target.style.opacity = "1";

entry.target.style.transform =
"translateY(0)";

}

});

},

{
threshold:0.15
}

);

revealElements.forEach(el => {

el.style.opacity = "0";

el.style.transform =
"translateY(50px)";

el.style.transition =
"all .8s ease";

revealObserver.observe(el);

});

// PARALLAX HERO

const heroBg = document.querySelector(".hero-bg");

window.addEventListener("scroll", () => {

let scroll = window.scrollY;

heroBg.style.transform =
`translateY(${scroll * 0.25}px)`;

});

// ACTIVE NAVIGATION

const sections =
document.querySelectorAll("section");

const navLinks =
document.querySelectorAll(
".nav-links a, .mobile-menu a"
);

window.addEventListener("scroll", () => {

let current = "";

sections.forEach(section => {

const sectionTop =
section.offsetTop - 150;

const sectionHeight =
section.clientHeight;

if (
window.scrollY >= sectionTop
) {
current = section.getAttribute("id");
}

});

navLinks.forEach(link => {

link.classList.remove("active");

if (
link.getAttribute("href") ===
"#" + current
) {

link.classList.add("active");

}

});

});

// SMOOTH SCROLL

document
.querySelectorAll('a[href^="#"]')
.forEach(anchor => {

anchor.addEventListener("click", function(e) {

e.preventDefault();

const target =
document.querySelector(
this.getAttribute("href")
);

if (target) {

window.scrollTo({
top:
target.offsetTop - 80,
behavior:"smooth"
});

}

});

});

// CONTACT FORM

const form =
document.querySelector(".contact-form");

form.addEventListener("submit", e => {

e.preventDefault();

const button =
form.querySelector("button");

button.innerText = "Sending...";

setTimeout(() => {

button.innerText =
"Message Sent ✓";

button.style.background =
"#00c853";

setTimeout(() => {

button.innerText =
"Send Message";

button.style.background =
"#ff001e";

form.reset();

}, 2500);

}, 1500);

});

// MOUSE GLOW EFFECT

const glow =
document.createElement("div");

glow.style.position = "fixed";
glow.style.width = "250px";
glow.style.height = "250px";
glow.style.borderRadius = "50%";
glow.style.background =
"rgba(255,0,30,.08)";
glow.style.pointerEvents = "none";
glow.style.filter = "blur(80px)";
glow.style.zIndex = "1";

document.body.appendChild(glow);

document.addEventListener(
"mousemove",
e => {

glow.style.left =
e.clientX - 125 + "px";

glow.style.top =
e.clientY - 125 + "px";

}
);

// TYPING EFFECT

const heroTitle =
document.querySelector(".hero h1");

const originalTitle =
heroTitle.innerHTML;

heroTitle.innerHTML = "";

let i = 0;

function typeWriter() {

if (i < originalTitle.length) {

heroTitle.innerHTML +=
originalTitle.charAt(i);

i++;

setTimeout(typeWriter, 20);

}

}

setTimeout(typeWriter, 1500);

// SCROLL TO TOP BUTTON

const topBtn =
document.createElement("button");

topBtn.innerHTML = "↑";

topBtn.style.position = "fixed";
topBtn.style.right = "20px";
topBtn.style.bottom = "20px";
topBtn.style.width = "50px";
topBtn.style.height = "50px";
topBtn.style.border = "none";
topBtn.style.borderRadius = "50%";
topBtn.style.background = "#ff001e";
topBtn.style.color = "#fff";
topBtn.style.fontSize = "20px";
topBtn.style.cursor = "pointer";
topBtn.style.display = "none";
topBtn.style.zIndex = "999";

document.body.appendChild(topBtn);

window.addEventListener("scroll", () => {

if (window.scrollY > 500) {
topBtn.style.display = "block";
} else {
topBtn.style.display = "none";
}

});

topBtn.addEventListener("click", () => {

window.scrollTo({
top:0,
behavior:"smooth"
});

});

// CURRENT YEAR FOOTER

const footerText =
document.querySelector(".footer-content p");

if(footerText){

footerText.innerHTML =
`© ${new Date().getFullYear()} QUARTZ. All Rights Reserved.`;

}

console.log(
"QUARTZ Premium Website Loaded Successfully"
);
function sendToWhatsApp(event) {
    event.preventDefault();

    let name = document.getElementById("name").value;
    let email = document.getElementById("email").value;
    let project = document.getElementById("project").value;
    let message = document.getElementById("message").value;

    let whatsappMessage = 
        `Hello Quartz Team,%0A` +
        `Name: ${name}%0A` +
        `Email: ${email}%0A` +
        `Project: ${project}%0A` +
        `Message: ${message}`;

    let phoneNumber = "918086035507";

    let url = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;

    window.open(url, "_blank");
}