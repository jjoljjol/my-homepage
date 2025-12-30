// Custom Cursor Tracking
const cursor = document.getElementById('cursor-glow');
const heroImage = document.getElementById('hero-image');

document.addEventListener('mousemove', (e) => {
    // Update cursor position
    cursor.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 10}px)`;

    // Hero image parallax effect
    const moveX = (window.innerWidth / 2 - e.clientX) * 0.02;
    const moveY = (window.innerHeight / 2 - e.clientY) * 0.02;

    if (heroImage) {
        heroImage.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.1)`;
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80, // Offset for fixed header
                behavior: 'smooth'
            });
        }
    });
});

// --- Insight Board Logic ---

const insightArchive = document.getElementById('insight-archive');
const postFormContainer = document.getElementById('post-form-container');
const openFormBtn = document.getElementById('open-form-btn');
const closeFormBtn = document.getElementById('close-form-btn');
const insightForm = document.getElementById('insight-form');

// Initialize with some default posts if storage is empty
const defaultPosts = [
    {
        id: Date.now() - 100000,
        title: "The Grace of Soft-Touch Robotics",
        category: "Robotics",
        content: "How automation is becoming as gentle as a human hand through advanced polymer sensors and feedback loops.",
        date: "Dec 30, 2024"
    },
    {
        id: Date.now() - 500000,
        title: "Crystalline Food Synthesis",
        category: "Food Tech",
        content: "The dawn of personalized nutrition through molecular material science, allowing for zero-waste production.",
        date: "Dec 25, 2024"
    }
];

let posts = JSON.parse(localStorage.getItem('heavenly_posts')) || defaultPosts;

function savePosts() {
    localStorage.setItem('heavenly_posts', JSON.stringify(posts));
}

function renderPosts() {
    insightArchive.innerHTML = '';

    // Sort posts by ID (descending) to show newest first
    const sortedPosts = [...posts].sort((a, b) => b.id - a.id);

    sortedPosts.forEach(post => {
        const article = document.createElement('article');
        article.className = 'archive-item';
        article.innerHTML = `
            <div class="date-tag">
                <span class="category">${post.category}</span>
                <span class="date">${post.date}</span>
            </div>
            <h3>${post.title}</h3>
            <p>${post.content}</p>
            <a href="#" class="read-more">Read Insight →</a>
        `;
        insightArchive.appendChild(article);
    });
}

// Form Handlers
openFormBtn.addEventListener('click', () => {
    postFormContainer.classList.remove('hidden');
});

closeFormBtn.addEventListener('click', () => {
    postFormContainer.classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === postFormContainer) {
        postFormContainer.classList.add('hidden');
    }
});

insightForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('post-title').value;
    const category = document.getElementById('post-category').value;
    const content = document.getElementById('post-content').value;
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newPost = {
        id: Date.now(),
        title,
        category,
        content,
        date
    };

    posts.push(newPost);
    savePosts();
    renderPosts();

    // Reset and hide
    insightForm.reset();
    postFormContainer.classList.add('hidden');
});

// Initial Render
renderPosts();
