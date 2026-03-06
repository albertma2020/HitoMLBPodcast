// script.js
let allEpisodes = [];
let currentDisplayList = [];
let isSearchMode = false;
let currentPage = 0;
let currentKeyword = "";
const itemsPerPage = 10;

const audio = document.getElementById('main-audio');

function formatDuration(duration) {
    if (!duration) return "00:00:00";
    let parts = duration.split(':');
    while (parts.length < 3) parts.unshift('0');
    return parts.map(v => v.padStart(2, '0')).join(':');
}

/**
 * 初始化載入：統計造訪數、分段載入集數
 */
async function init() {
    try {
        updateVisitCount();
        toggleSearchState(false);

        // 第一階段：先抓取最新一集顯示
        const latestRes = await fetch('/api/episodes/latest');
        const latestEp = await latestRes.json();
        renderMain(latestEp);

        document.getElementById('sidebar-list').innerHTML = `
            <div class="text-center py-5 text-muted">
                <div class="spinner-border spinner-border-sm me-2"></div> 載入歷史集數中...
            </div>`;

        loadRecommendedKeywords();
        loadFullHistory();
    } catch (e) {
        document.getElementById('now-title').innerText = "資料載入失敗";
        console.error(e);
    }
}

/**
 * 造訪次數累計：使用 CounterAPI v2 介面
 */
function updateVisitCount() {
    const workspace = "albertma2020s-team-3154";
    const name = "hitomlb";

    fetch(`https://api.counterapi.dev/v2/${workspace}/${name}/up`)
        .then(res => res.json())
        .then(data => {
            const countEl = document.getElementById('visit-count');
            if (countEl && data.data.up_count) {
                countEl.innerText = data.data.up_count.toLocaleString();
            }
        })
        .catch(() => {
            // 靜默處理
        });
}

/**
 * 控制搜尋組件狀態
 */
function toggleSearchState(isEnabled) {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.querySelector('#search-form button[type="submit"]');
    const recommendBtn = document.querySelector('button[data-bs-target="#keywordModal"]');

    if (searchInput) searchInput.disabled = !isEnabled;
    if (searchBtn) searchBtn.disabled = !isEnabled;
    if (recommendBtn) {
        recommendBtn.disabled = !isEnabled;
        recommendBtn.innerHTML = isEnabled ?
            '<i class="bi bi-lightbulb me-1"></i>推薦關鍵字' :
            '<i class="bi bi-hourglass-split me-1"></i>資料準備中...';
    }
}

/**
 * 載入完整歷史
 */
async function loadFullHistory() {
    try {
        const res = await fetch('/api/episodes');
        allEpisodes = await res.json();

        if (!isSearchMode) {
            currentDisplayList = allEpisodes;
            renderSidebar();
        }

        const label = document.getElementById('sidebar-label');
        if (label) label.innerText = "📚 全部集數";
        toggleSearchState(true);
    } catch (e) {
        console.error("完整歷史載入失敗", e);
    }
}

/**
 * 載入推薦關鍵字 Modal
 */
async function loadRecommendedKeywords() {
    try {
        const res = await fetch('/api/recommended-keywords');
        const keywords = await res.json();
        const grid = document.getElementById('keyword-grid');
        grid.innerHTML = keywords.map(kw => `
            <div class="col-6">
                <button class="btn btn-outline-secondary w-100 text-truncate py-2 small fw-medium" 
                        onclick="selectKeyword('${kw}')">${kw}</button>
            </div>`).join('');
    } catch (e) {
        console.error("無法載入推薦關鍵字", e);
    }
}

function selectKeyword(kw) {
    const input = document.getElementById('search-input');
    input.value = kw;
    const modalEl = document.getElementById('keywordModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    handleSearch();
}

/**
 * 重設播放器狀態：修正回首頁時標題文字不正確的問題
 */
function resetToInitial() {
    const input = document.getElementById('search-input');
    if (input) input.value = "";

    isSearchMode = false;
    currentKeyword = "";
    currentPage = 0;

    // 修正：重設時將側邊欄標題改回全部集數
    const label = document.getElementById('sidebar-label');
    if (label) label.innerText = "📚 全部集數";

    if (allEpisodes.length > 0) {
        audio.pause();
        audio.currentTime = 0;
        currentDisplayList = allEpisodes;
        renderMain(allEpisodes[0]);
        renderSidebar();
    }
}

/**
 * 渲染主播放面板
 */
function renderMain(ep, keyword = "", jumpSec = -1) {
    document.getElementById('now-title').innerText = ep.title;
    document.getElementById('now-link').href = ep.link || "#";
    document.getElementById('now-date').innerText = ep.pubDate;
    document.getElementById('now-duration').innerHTML = `<i class="bi bi-clock me-1"></i>${formatDuration(ep.duration)}`;
    document.getElementById('now-notes').innerHTML = ep.fullDescription;
    audio.src = ep.audioUrl;
    const container = document.getElementById('chapter-list');
    container.innerHTML = ep.chapters.map(ch => `
        <div class="list-group-item chapter-item d-flex align-items-center py-3" onclick="seekTo(${ch.startSeconds}, this)">
            <span class="badge bg-dark time-badge me-3">${ch.timestamp}</span>
            <span class="flex-grow-1 text-dark">${applyHighlight(ch.title, keyword)}</span>
        </div>`).join('');
    if (jumpSec >= 0) {
        audio.onloadedmetadata = () => {
            audio.currentTime = jumpSec;
            audio.play();
        };
    } else {
        audio.onloadedmetadata = null;
    }
}

/**
 * 渲染側邊欄
 */
function renderSidebar() {
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = currentDisplayList.slice(start, end);
    const listDiv = document.getElementById('sidebar-list');

    listDiv.innerHTML = pageItems.map(item => {
        const ep = isSearchMode ? item.ep : item;
        const ch = isSearchMode ? item.ch : null;
        return `
            <div class="list-group-item sidebar-card py-3 mb-2 shadow-sm" 
                 onclick="${isSearchMode ? `jumpToSearch('${ep.title.replace(/'/g, "\\'")}', ${ch.startSeconds})` : `selectEpisode('${ep.title.replace(/'/g, "\\'")}')`}">
                <div class="fw-bold text-truncate text-dark small" title="${ep.title}">${ep.title}</div>
                ${isSearchMode ? `
                <div class="text-primary text-truncate my-1" style="font-size: 0.75rem; max-width: 85%;" title="${ch.title}">
                    <i class="bi bi-hash"></i>${applyHighlight(ch.title, currentKeyword)}
                </div>` : ''}
                <div class="d-flex justify-content-between mt-2">
                    <small class="text-muted" style="font-size: 0.7rem;">${ep.pubDate}</small>
                    <small class="text-secondary fw-bold" style="font-size: 0.7rem;">
                        ${isSearchMode ? `<i class="bi bi-play-circle me-1"></i>${ch.timestamp}` : formatDuration(ep.duration)}
                    </small>
                </div>
            </div>`;
    }).join('');

    const totalPages = Math.ceil(currentDisplayList.length / itemsPerPage) || 1;
    document.querySelectorAll('.page-info').forEach(el => el.innerText = `PAGE ${currentPage + 1} / ${totalPages}`);
    document.querySelectorAll('.btn-prev').forEach(btn => btn.disabled = currentPage === 0);
    document.querySelectorAll('.btn-next').forEach(btn => btn.disabled = end >= currentDisplayList.length);
}

/**
 * 分頁邏輯與手機版智慧捲動
 */
function changePage(delta) {
    currentPage += delta;
    renderSidebar();
    if (window.innerWidth < 992) {
        const sidebarLabel = document.getElementById('sidebar-label');
        if (sidebarLabel) sidebarLabel.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
}

/**
 * 處理檢索
 */
function handleSearch(event) {
    if (event) event.preventDefault();
    const kw = document.getElementById('search-input').value.trim();
    if (!kw) {
        resetToInitial();
        return;
    }

    currentKeyword = kw;
    isSearchMode = true;
    const kwList = kw.split(/[|｜]/).map(s => s.trim()).filter(s => s !== "");

    const results = [];
    allEpisodes.forEach(ep => {
        ep.chapters.forEach(ch => {
            const isMatch = kwList.some(k => ch.title.toLowerCase().includes(k.toLowerCase()));
            if (isMatch) results.push({ep, ch});
        });
    });

    currentDisplayList = results;
    currentPage = 0;
    document.getElementById('sidebar-label').innerText = `🔍 搜尋結果 (${results.length})`;
    renderSidebar();
}

/**
 * 高亮標記
 */
function applyHighlight(text, kw) {
    if (!kw) return text;
    const kwList = kw.split(/[|｜]/).map(s => s.trim()).filter(s => s !== "")
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (kwList.length === 0) return text;
    const regex = new RegExp(`(${kwList.join('|')})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function seekTo(sec, el) {
    audio.currentTime = sec;
    audio.play();
    document.querySelectorAll('.chapter-item').forEach(r => r.classList.remove('active'));
    el.classList.add('active');
}

function selectEpisode(title) {
    const ep = allEpisodes.find(e => e.title === title);
    renderMain(ep);
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function jumpToSearch(title, sec) {
    const ep = allEpisodes.find(e => e.title === title);
    renderMain(ep, currentKeyword, sec);
    window.scrollTo({top: 0, behavior: 'smooth'});
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#reset-trigger, .reset-trigger').forEach(trigger => trigger.onclick = resetToInitial);
    const searchForm = document.getElementById('search-form');
    if (searchForm) searchForm.onsubmit = handleSearch;
    document.querySelectorAll('.btn-prev').forEach(btn => btn.onclick = () => changePage(-1));
    document.querySelectorAll('.btn-next').forEach(btn => btn.onclick = () => changePage(1));
    init();
});