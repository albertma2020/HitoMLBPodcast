// 全域變數定義
let allEpisodes = [];
let currentDisplayList = [];
let isSearchMode = false;
let currentPage = 0;
let currentKeyword = "";
const itemsPerPage = 10;

const audio = document.getElementById('main-audio');

/**
 * 格式化時長：確保顯示為 00:00:00 格式
 */
function formatDuration(duration) {
    if (!duration) return "00:00:00";
    let parts = duration.split(':');
    while (parts.length < 3) parts.unshift('0');
    return parts.map(v => v.padStart(2, '0')).join(':');
}

/**
 * 初始化載入：採分段載入策略以縮短首屏時間
 */
async function init() {
    try {
        // 第一階段：優先抓取並顯示最新一集
        const latestRes = await fetch('/api/episodes/latest');
        const latestEp = await latestRes.json();
        renderMain(latestEp);

        // 側邊欄顯示載入中狀態
        document.getElementById('sidebar-list').innerHTML = `
            <div class="text-center py-5 text-muted">
                <div class="spinner-border spinner-border-sm me-2"></div> 載入歷史集數中...
            </div>`;

        // 同步載入推薦關鍵字與完整歷史資料
        loadRecommendedKeywords();
        loadFullHistory();
    } catch (e) {
        document.getElementById('now-title').innerText = "資料載入失敗";
        console.error(e);
    }
}

/**
 * 背景載入完整歷史集數
 */
async function loadFullHistory() {
    try {
        const res = await fetch('/api/episodes');
        allEpisodes = await res.json();

        // 載入完成後更新側邊欄
        if (!isSearchMode) {
            currentDisplayList = allEpisodes;
            renderSidebar();
        }

        const label = document.getElementById('sidebar-label');
        if (label) label.innerText = "📚 全部集數";
    } catch (e) {
        console.error("完整歷史載入失敗", e);
    }
}

/**
 * 載入推薦關鍵字清單
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
            </div>
        `).join('');
    } catch (e) {
        console.error("無法載入推薦關鍵字", e);
    }
}

/**
 * 處理推薦關鍵字選取
 */
function selectKeyword(kw) {
    const input = document.getElementById('search-input');
    input.value = kw;

    // 關閉 Modal 視窗
    const modalEl = document.getElementById('keywordModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // 執行檢索
    handleSearch();
}

/**
 * 重設狀態：停止播放、時間歸零並回到初始畫面
 */
function resetToInitial() {
    const input = document.getElementById('search-input');
    if (input) input.value = "";

    isSearchMode = false;
    currentKeyword = "";
    currentPage = 0;

    const label = document.getElementById('sidebar-label');
    if (label) label.innerText = "📚 全部集數";

    if (allEpisodes.length > 0) {
        // 停止目前的音訊並歸零
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

    // 僅在有指定跳轉時間時才自動播放
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
 * 渲染側邊欄清單：包含 Tooltip 與搜尋段落顯示
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

    // 同步更新分頁資訊
    const totalPages = Math.ceil(currentDisplayList.length / itemsPerPage) || 1;
    document.querySelectorAll('.page-info').forEach(el => el.innerText = `PAGE ${currentPage + 1} / ${totalPages}`);
    document.querySelectorAll('.btn-prev').forEach(btn => btn.disabled = currentPage === 0);
    document.querySelectorAll('.btn-next').forEach(btn => btn.disabled = end >= currentDisplayList.length);
}

/**
 * 分頁切換邏輯：包含手機版智慧捲動
 */
function changePage(delta) {
    currentPage += delta;
    renderSidebar();

    // 手機版自動捲動至清單頂部
    if (window.innerWidth < 992) {
        const sidebarLabel = document.getElementById('sidebar-label');
        if (sidebarLabel) {
            sidebarLabel.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
    }
}

/**
 * 處理關鍵字檢索
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
    document.getElementById('sidebar-label').innerText = `🔍 搜尋結果 (${results.length})`;
    renderSidebar();
}

/**
 * 關鍵字高亮處理
 */
function applyHighlight(text, kw) {
    if (!kw) return text;
    const regex = new RegExp(`(${kw})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

/**
 * 音訊跳轉至指定秒數
 */
function seekTo(sec, el) {
    audio.currentTime = sec;
    audio.play();
    document.querySelectorAll('.chapter-item').forEach(r => r.classList.remove('active'));
    el.classList.add('active');
}

/**
 * 選取特定集數
 */
function selectEpisode(title) {
    const ep = allEpisodes.find(e => e.title === title);
    renderMain(ep);
    // 選取後捲動至頂部觀看播放器
    window.scrollTo({top: 0, behavior: 'smooth'});
}

/**
 * 跳轉至搜尋結果的特定集數與段落
 */
function jumpToSearch(title, sec) {
    const ep = allEpisodes.find(e => e.title === title);
    renderMain(ep, currentKeyword, sec);
    // 跳轉後捲動至頂部觀看播放器
    window.scrollTo({top: 0, behavior: 'smooth'});
}

/**
 * 事件監聽綁定
 */
document.addEventListener('DOMContentLoaded', () => {
    // 綁定所有重設觸發元件
    document.querySelectorAll('#reset-trigger, .reset-trigger').forEach(trigger => {
        trigger.onclick = resetToInitial;
    });

    // 綁定搜尋表單
    const searchForm = document.getElementById('search-form');
    if (searchForm) searchForm.onsubmit = handleSearch;

    // 綁定分頁按鈕
    document.querySelectorAll('.btn-prev').forEach(btn => btn.onclick = () => changePage(-1));
    document.querySelectorAll('.btn-next').forEach(btn => btn.onclick = () => changePage(1));

    // 啟動初始化程序
    init();
});