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

// 載入資料
async function init() {
    try {
        const res = await fetch('/api/episodes');
        allEpisodes = await res.json();
        resetToInitial();
    } catch (e) {
        document.getElementById('now-title').innerText = "API 連線失敗";
        console.error(e);
    }
}

/**
 * 重設狀態：清空搜尋、回到最新一集，且停止播放
 */
function resetToInitial() {
    const input = document.getElementById('search-input');
    if (input) input.value = "";

    isSearchMode = false;
    currentKeyword = "";
    currentDisplayList = allEpisodes;
    currentPage = 0;

    const label = document.getElementById('sidebar-label');
    if (label) label.innerText = "📚 全部集數";

    if (allEpisodes.length > 0) {
        // 核心修正：強制停止播放並歸零，且不帶入自動播放
        audio.pause();
        audio.currentTime = 0;

        renderMain(allEpisodes[0]); // jumpSec 預設為 -1，不會自動播放
        renderSidebar();
    }
}

/**
 * 渲染主面板
 */
function renderMain(ep, keyword = "", jumpSec = -1) {
    document.getElementById('now-title').innerText = ep.title;
    document.getElementById('now-link').href = ep.link || "#";
    document.getElementById('now-date').innerText = ep.pubDate;
    document.getElementById('now-duration').innerHTML = `<i class="bi bi-clock me-1"></i>${formatDuration(ep.duration)}`;
    document.getElementById('now-notes').innerHTML = ep.fullDescription;

    // 設定音訊來源
    audio.src = ep.audioUrl;

    // 渲染章節清單
    const container = document.getElementById('chapter-list');
    container.innerHTML = ep.chapters.map(ch => `
        <div class="list-group-item chapter-item d-flex align-items-center py-3" onclick="seekTo(${ch.startSeconds}, this)">
            <span class="badge bg-dark time-badge me-3">${ch.timestamp}</span>
            <span class="flex-grow-1 text-dark">${applyHighlight(ch.title, keyword)}</span>
        </div>`).join('');

    // 只有在點擊「搜尋結果」或「特定章節」時（即 jumpSec >= 0），才觸發自動播放
    if (jumpSec >= 0) {
        audio.onloadedmetadata = () => {
            audio.currentTime = jumpSec;
            audio.play();
        };
    } else {
        // 如果是重設或切換集數，確保不自動執行 play()
        audio.onloadedmetadata = null;
    }
}

/**
 * 渲染側邊欄：上下同步分頁、搜尋顯示「段落標題」
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
                
                <div class="fw-bold text-truncate text-dark small">${ep.title}</div>
                
                ${isSearchMode ? `
                <div class="text-primary text-truncate small my-1" style="font-size: 0.75rem;">
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

function changePage(delta) {
    currentPage += delta;
    renderSidebar();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function handleSearch(event) {
    if (event) event.preventDefault();
    const kw = document.getElementById('search-input').value.trim();
    if (!kw) {
        resetToInitial();
        return;
    }

    currentKeyword = kw;
    isSearchMode = true;
    const results = [];
    allEpisodes.forEach(ep => {
        ep.chapters.forEach(ch => {
            if (ch.title.toLowerCase().includes(kw.toLowerCase())) results.push({ep, ch});
        });
    });

    currentDisplayList = results;
    currentPage = 0;
    document.getElementById('sidebar-label').innerText = `🔍 搜尋結果 (${results.length})`;
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

// 事件綁定
document.addEventListener('DOMContentLoaded', () => {
    const resetTrigger = document.getElementById('reset-trigger');
    if (resetTrigger) resetTrigger.onclick = resetToInitial;

    const searchForm = document.getElementById('search-form');
    if (searchForm) searchForm.onsubmit = handleSearch;

    document.querySelectorAll('.btn-prev').forEach(btn => {
        btn.onclick = () => changePage(-1);
    });

    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.onclick = () => changePage(1);
    });

    init(); // 啟動資料獲取
});