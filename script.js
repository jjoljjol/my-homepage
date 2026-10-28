// Custom Cursor Tracking
const cursor = document.getElementById('cursor-glow');
const heroImage = document.getElementById('hero-image');

document.addEventListener('mousemove', (e) => {
    // Update cursor position
    if (cursor) {
        cursor.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 10}px)`;
    }

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

// --- 혜안OS 통합 피드 ---
const hubGrid = document.getElementById('hub-grid');
const hubFilters = document.getElementById('hub-filters');

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

async function loadHubContent(filter = 'all') {
    if (!hubGrid) return;
    
    hubGrid.innerHTML = '<p class="hub-empty">불러오는 중...</p>';
    
    try {
        // Try to fetch from main app API
        const res = await fetch('http://localhost:4200/api/hub/content?limit=20');
        if (res.ok) {
            const data = await res.json();
            let items = data.items || [];
            
            if (filter !== 'all') {
                // Map filter names
                const filterMap = { predict: 'prediction', comic: 'comic', novel: 'novel', research: 'research' };
                const targetType = filterMap[filter] || filter;
                items = items.filter((item) => item.type === targetType);
            }
            
            if (items.length === 0) {
                hubGrid.innerHTML = '<p class="hub-empty">아직 이 타입의 콘텐츠가 없습니다.</p>';
                return;
            }
            
            hubGrid.innerHTML = items.map((item) => {
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
        console.log('API fetch failed, using mock data');
    }
    
    // Fallback to mock data
    const hubItems = [
        { type: 'predict', title: '2027년 반도체 지정학 시나리오', summary: 'HyeanOS 예측 엔진이 생성한 공급망 재편 전망.', meta: '예측 · 10월 27일' },
        { type: 'comic', title: '100 Times AI — 드로잉 연연 #12', summary: '만화 자동생성 파이프라인의 최신 회차.', meta: '만화 · 10월 26일' },
        { type: 'novel', title: '밤의 서고, 네 번째 장', summary: 'AI 작가 스튜디오에서 집필 중인 연재 소설 발췌.', meta: '소설 · 10월 25일' },
        { type: 'research', title: '배양육 산업 10년 전망 리포트', summary: '시장 데이터와 기술 로드맵을 종합한 분석 리포트.', meta: '리포트 · 10월 24일' },
    ];
    
    const items = filter === 'all' ? hubItems : hubItems.filter((item) => item.type === filter);
    if (items.length === 0) {
        hubGrid.innerHTML = '<p class="hub-empty">아직 이 타입의 콘텐츠가 없습니다.</p>';
        return;
    }
    hubGrid.innerHTML = items.map((item) => `
        <article class="hub-card">
            <span class="hub-type ${item.type}">${hubTypeLabels[item.type]}</span>
            <h4>${item.title}</h4>
            <p>${item.summary}</p>
            <span class="hub-meta">${item.meta}</span>
        </article>
    `).join('');
}

if (hubGrid && hubFilters) {
    hubFilters.addEventListener('click', (e) => {
        const button = e.target.closest('.hub-filter');
        if (!button) return;
        hubFilters.querySelectorAll('.hub-filter').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        loadHubContent(button.dataset.filter);
    });
    loadHubContent('all');
}

// --- Insight Board Logic ---
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
