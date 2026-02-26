/* script.js */
let allEpisodes = [];
let currentDisplayList = [];
let isSearchMode = false;
let currentPage = 0;
let currentKeyword = "";
const itemsPerPage = 10;

const audio = document.getElementById('main-audio');
const searchInput = document.getElementById('search-input');
const sidebarLabel = document.getElementById('sidebar-label');
const sidebarList = document.getElementById('sidebar-list');
const pageInfo = document.getElementById('page-info');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

/**
 * 格式化日期：Feb 24, 2026 (Tue)
 */
function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    // 使用 UTC 避免時區跳日問題
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} (${days[date.getUTCDay()]})`;
}

/**
 * 格式化時長：確保顯示為 00:00:00
 */
function formatDuration(duration) {
    if (!duration) return "00:00:00";
    let parts = duration.split(':');
    while (parts.length < 3) parts.unshift('0');
    return parts.map(v => v.padStart(2, '0')).join(':');
}

/**
 * 載入資料
 */
async function init() {
    try {
        const res = await fetch('/api/episodes');
        allEpisodes = await res.json();
        resetToInitial();
    } catch (e) {
        document.getElementById('now-title').innerText = "無法連線至後端服務";
        console.error(e);
    }
}

/**
 * 重設狀態 (回到最新一集)
 */
function resetToInitial() {
    searchInput.value = "";
    currentKeyword = "";
    isSearchMode = false;
    currentDisplayList = allEpisodes;
    currentPage = 0;
    sidebarLabel.innerText = "📚 全部集數";

    if (allEpisodes.length > 0) {
        renderMain(allEpisodes[0]);
        renderSidebar();
    }
}

/**
 * 顯示主播放面板
 */
function renderMain(ep, keyword = "", jumpSec = -1) {
    document.getElementById('now-title').innerText = ep.title;
    document.getElementById('now-link').href = ep.link || "#";
    document.getElementById('now-date').innerText = formatDate(ep.pubDate);
    document.getElementById('now-duration').innerHTML = `<i class="bi bi-clock me-1"></i>${formatDuration(ep.duration)}`;
    document.getElementById('now-notes').innerHTML = ep.fullDescription;
    audio.src = ep.audioUrl;

    const container = document.getElementById('chapter-list');
    container.innerHTML = ep.chapters.map(ch => `
        <div class="list-group-item chapter-item d-flex align-items-center py-3" onclick="seekTo(${ch.startSeconds}, this)">
            <span class="badge bg-dark time-badge me-3">${ch.timestamp}</span>
            <span class="flex-grow-1 text-dark">${applyHighlight(ch.title, keyword)}</span>
        </div>
    `).join('');

    if (jumpSec >= 0) {
        audio.onloadedmetadata = () => {
            audio.currentTime = jumpSec;
            audio.play();
        };
    }
}

/**
 * 顯示側邊欄清單
 */
function renderSidebar() {
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = currentDisplayList.slice(start, end);

    if (isSearchMode) {
        sidebarList.innerHTML = pageItems.map(item => `
            <div class="list-group-item sidebar-card p-3 mb-2 shadow-sm" 
                 onclick="jumpToSearch('${item.ep.title.replace(/'/g, "\\'")}', ${item.ch.startSeconds})">
                <div class="small text-primary fw-bold mb-1">${item.ep.title}</div>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-dark">${applyHighlight(item.ch.title, currentKeyword)}</span>
                    <span class="badge bg-light text-dark border-0 small">${item.ch.timestamp}</span>
                </div>
            </div>
        `).join('');
    } else {
        sidebarList.innerHTML = pageItems.map(ep => `
            <div class="list-group-item sidebar-card py-3 mb-2 shadow-sm" 
                 onclick="selectEpisode('${ep.title.replace(/'/g, "\\'")}')">
                <div class="fw-bold text-truncate text-dark">${ep.title}</div>
                <div class="d-flex justify-content-between mt-2">
                    <small class="text-muted" style="font-size: 0.75rem;">${formatDate(ep.pubDate)}</small>
                    <small class="text-secondary fw-bold" style="font-size: 0.75rem;">${formatDuration(ep.duration)}</small>
                </div>
            </div>
        `).join('');
    }

    const totalPages = Math.ceil(currentDisplayList.length / itemsPerPage) || 1;
    pageInfo.innerText = `PAGE ${currentPage + 1} / ${totalPages}`;
    btnPrev.disabled = currentPage === 0;
    btnNext.disabled = end >= currentDisplayList.length;
}

/**
 * 處理分頁切換
 */
function changePage(delta) {
    currentPage += delta;
    renderSidebar();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

/**
 * 關鍵字搜尋
 */
function handleSearch() {
    const kw = searchInput.value.trim();
    if (!kw) {
        resetToInitial();
        return;
    }

    currentKeyword = kw;
    isSearchMode = true;
    const results = [];

    allEpisodes.forEach(ep => {
        ep.chapters.forEach(ch => {
            if (ch.title.toLowerCase().includes(kw.toLowerCase())) {
                results.push({ep, ch});
            }
        });
    });

    currentDisplayList = results;
    currentPage = 0;
    sidebarLabel.innerText = `🔍 搜尋結果 (${results.length})`;
    renderSidebar();
}

function applyHighlight(text, kw) {
    if (!kw) return text;
    const regex = new RegExp(`(${kw})`, 'gi');
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

// 綁定事件
document.getElementById('reset-trigger').onclick = resetToInitial;
document.getElementById('search-btn').onclick = handleSearch;
btnPrev.onclick = () => changePage(-1);
btnNext.onclick = () => changePage(1);

// 初始化
init();