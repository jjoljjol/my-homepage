// Custom Cursor Tracking
const cursor = document.getElementById('cursor-glow');
const heroImage = document.getElementById('hero-image');

document.addEventListener('mousemove', (e) => {
    if (cursor) {
        cursor.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 10}px)`;
    }

    const moveX = (window.innerWidth / 2 - e.clientX) * 0.02;
    const moveY = (window.innerHeight / 2 - e.clientY) * 0.02;

    if (heroImage) {
        heroImage.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.1)`;
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// --- Hub Content Loading ---
const hubTypeLabels = {
    prediction: 'Predict',
    predict: 'Predict',
    comic: 'Comic',
    novel: 'Novel',
    research: 'Research',
    post: 'Post',
};

const hubTypeClasses = {
    prediction: 'predict',
    predict: 'predict',
    comic: 'comic',
    novel: 'novel',
    research: 'research',
    post: 'post',
};

async function loadSectionContent(section, filter = 'all') {
    const gridId = `hub-grid-${section}`;
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = '<p class="hub-empty">불러오는 중...</p>';

    try {
        const res = await fetch('http://localhost:4200/api/hub/content?limit=30');
        if (res.ok) {
            const data = await res.json();
            let items = data.items || [];

            // Filter by section
            if (section === 'novel') {
                items = items.filter((item) => item.type === 'novel');
            } else if (section === 'insight') {
                items = items.filter((item) => item.type === 'prediction' || item.type === 'research');
                if (filter !== 'all') {
                    const targetType = filter === 'predict' ? 'prediction' : filter;
                    items = items.filter((item) => item.type === targetType);
                }
            } else if (section === 'study') {
                items = items.filter((item) => item.type === 'research');
            }

            if (items.length === 0) {
                grid.innerHTML = '<p class="hub-empty">아직 콘텐츠가 없습니다.</p>';
                return;
            }

            grid.innerHTML = items.map((item) => {
                const type = item.type === 'prediction' ? 'predict' : item.type;
                return `
                <article class="hub-card">
                    <span class="hub-type ${hubTypeClasses[item.type] || type}">${hubTypeLabels[item.type] || type}</span>
                    <h4>${item.title}</h4>
                    <p>${item.description || item.summary || ''}</p>
                    <span class="hub-meta">${item.category || ''} ${item.createdAt ? '· ' + new Date(item.createdAt).toLocaleDateString('ko-KR') : ''}</span>
                </article>
            `;
            }).join('');
            return;
        }
    } catch (e) {
        console.log('API fetch failed');
    }

    grid.innerHTML = '<p class="hub-empty">콘텐츠를 불러올 수 없습니다.</p>';
}

// Setup filters for each section
['novel', 'insight', 'study'].forEach(section => {
    const filters = document.getElementById(`hub-filters-${section}`);
    if (filters) {
        filters.addEventListener('click', (e) => {
            const button = e.target.closest('.hub-filter');
            if (!button) return;
            filters.querySelectorAll('.hub-filter').forEach((btn) => btn.classList.remove('active'));
            button.classList.add('active');
            loadSectionContent(section, button.dataset.filter || 'all');
        });
        loadSectionContent(section, 'all');
    }
});

// --- Freeboard (Insight Board) Logic ---
const insightArchive = document.getElementById('insight-archive');
const postFormContainer = document.getElementById('post-form-container');
const openFormBtn = document.getElementById('open-form-btn');
const closeFormBtn = document.getElementById('close-form-btn');
const insightForm = document.getElementById('insight-form');

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
    if (!insightArchive) return;
    insightArchive.innerHTML = '';
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

if (openFormBtn) {
    openFormBtn.addEventListener('click', () => {
        if (postFormContainer) postFormContainer.classList.remove('hidden');
    });
}
if (closeFormBtn) {
    closeFormBtn.addEventListener('click', () => {
        if (postFormContainer) postFormContainer.classList.add('hidden');
    });
}
window.addEventListener('click', (e) => {
    if (e.target === postFormContainer) {
        postFormContainer.classList.add('hidden');
    }
});

if (insightForm) {
    insightForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('post-title').value;
        const category = document.getElementById('post-category').value;
        const content = document.getElementById('post-content').value;
        const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const newPost = { id: Date.now(), title, category, content, date };
        posts.push(newPost);
        savePosts();
        renderPosts();
        insightForm.reset();
        if (postFormContainer) postFormContainer.classList.add('hidden');
    });
}

renderPosts();
