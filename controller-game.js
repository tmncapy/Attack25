/**
 * ATTACK 25 - CONTROLLER GAME ENGINE & BOARD LOGIC
 * Handles: Buzzer system, keyboard shortcuts, 25-panel Othello board logic, special round video/slides controller, scoring, and app startup.
 */

/* =====================================================
   BUZZER SYSTEM
===================================================== */
let buzzerArmTime = null;

function armBuzzer() {
    gameState.buzzer.status = 'armed';
    gameState.buzzer.winner = null;
    gameState.buzzer.buzzTime = null;
    gameState.buzzer.pressOrder = [];
    buzzerArmTime = Date.now();

    renderBuzzerUI();
    broadcastState("buzzerArmed");
    showToast("🟢 ĐÃ MỞ CHUÔNG GIÀNH QUYỀN TRẢ LỜI!");
}

function lockBuzzer() {
    gameState.buzzer.status = 'locked';
    renderBuzzerUI();
    broadcastState("buzzerLocked");
    showToast("🔒 ĐÃ KHÓA CHUÔNG!");
}

function resetBuzzer() {
    gameState.buzzer = {
        status: 'locked',
        winner: null,
        buzzTime: null,
        pressOrder: [],
        lockedPlayers: []
    };
    buzzerArmTime = null;
    renderBuzzerUI();
    broadcastState("buzzerReset");
    showToast("Đã reset chuông.");
}

function playerPressBuzzer(color) {
    if (gameState.buzzer.status !== 'armed') {
        return;
    }
    if (gameState.buzzer.lockedPlayers && gameState.buzzer.lockedPlayers.includes(color)) {
        showToast(`⚠️ ${gameState.players[color]?.name || color} đang bị khóa chuông!`);
        return;
    }

    const elapsed = buzzerArmTime ? ((Date.now() - buzzerArmTime) / 1000).toFixed(2) : '0.00';
    gameState.buzzer.status = 'buzzed';
    gameState.buzzer.winner = color;
    gameState.buzzer.buzzTime = elapsed;
    if (!gameState.buzzer.pressOrder) gameState.buzzer.pressOrder = [];
    if (!gameState.buzzer.pressOrder.includes(color)) {
        gameState.buzzer.pressOrder.push(color);
    }

    renderBuzzerUI();
    broadcastState("buzzerPressed", colorWavMap[color] || 'buzz');
    showToast(`🔔 ${gameState.players[color]?.name || color} BẤM CHUÔNG! (+${elapsed}s)`);
}

function judgeCorrect() {
    if (!gameState.buzzer.winner) {
        showToast("⚠️ Chưa có người bấm chuông để chấm điểm!");
        return;
    }
    const winnerColor = gameState.buzzer.winner;
    const winnerName = gameState.players[winnerColor]?.name || winnerColor;

    gameState.buzzer.status = 'locked';
    renderBuzzerUI();
    broadcastState("judgeCorrect", 'correct');
    showToast(`✅ ${winnerName} TRẢ LỜI ĐÚNG!`);
}

function judgeWrong() {
    if (!gameState.buzzer.winner) {
        showToast("⚠️ Chưa có người bấm chuông để xử lý!");
        return;
    }
    const wrongColor = gameState.buzzer.winner;
    const wrongName = gameState.players[wrongColor]?.name || wrongColor;

    if (!gameState.buzzer.lockedPlayers) gameState.buzzer.lockedPlayers = [];
    if (!gameState.buzzer.lockedPlayers.includes(wrongColor)) {
        gameState.buzzer.lockedPlayers.push(wrongColor);
    }

    gameState.buzzer.winner = null;
    gameState.buzzer.status = 'armed';

    renderBuzzerUI();
    broadcastState("judgeWrong", 'wrong');
    showToast(`❌ ${wrongName} TRẢ LỜI SAI! Khóa quyền bấm.`);
}

function renderBuzzerUI() {
    const banner = document.getElementById("buzzerStatusBanner");
    const valText = document.getElementById("buzzerStateVal");
    const winnerInfo = document.getElementById("buzzerWinnerInfo");
    const bzState = gameState.buzzer || {};

    if (banner) {
        banner.className = 'buzzer-status-banner';
        if (bzState.status === 'armed') banner.classList.add('armed');
        else if (bzState.status === 'locked') banner.classList.add('locked');
        else if (bzState.status === 'buzzed') banner.classList.add('buzzed');
    }

    if (valText) {
        if (bzState.status === 'armed') valText.textContent = '🟢 ĐANG MỞ CHUÔNG';
        else if (bzState.status === 'locked') valText.textContent = '🔒 ĐANG KHÓA';
        else if (bzState.status === 'buzzed') valText.textContent = '🔔 ĐÃ BẤM CHUÔNG!';
        else valText.textContent = '---';
    }

    if (winnerInfo) {
        if (bzState.winner) {
            const pName = gameState.players[bzState.winner]?.name || bzState.winner;
            winnerInfo.innerHTML = `<span style="color:#ffd43b;">${pName}</span> <span style="font-size:9px; color:#94a3b8;">(+${bzState.buzzTime || '0.00'}s)</span>`;
        } else {
            winnerInfo.textContent = '';
        }
    }

    ['red', 'green', 'white', 'blue'].forEach(color => {
        const btn = document.getElementById(`buzzerBtn_${color}`);
        const rankTag = document.getElementById(`buzzerRank_${color}`);
        if (!btn) return;

        btn.classList.remove('buzzer-winner', 'buzzer-locked-player');

        if (bzState.winner === color) {
            btn.classList.add('buzzer-winner');
        }

        if (bzState.lockedPlayers && bzState.lockedPlayers.includes(color)) {
            btn.classList.add('buzzer-locked-player');
        }

        if (rankTag) {
            if (bzState.winner === color) {
                rankTag.style.display = 'block';
                rankTag.textContent = '👑 #1';
            } else {
                rankTag.style.display = 'none';
            }
        }
    });
}

/* =====================================================
   KEYBOARD SHORTCUTS
===================================================== */
document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
    }

    const modal = document.getElementById('questionModal');
    if (modal && modal.style.display === 'flex') {
        return;
    }

    const key = e.key.toLowerCase();

    if (key === '1') { e.preventDefault(); playerPressBuzzer('red'); }
    else if (key === '2') { e.preventDefault(); playerPressBuzzer('green'); }
    else if (key === '3') { e.preventDefault(); playerPressBuzzer('white'); }
    else if (key === '4') { e.preventDefault(); playerPressBuzzer('blue'); }
    else if (key === ' ' || e.code === 'Space') { e.preventDefault(); armBuzzer(); }
    else if (key === 'l') { e.preventDefault(); lockBuzzer(); }
    else if (key === 'r') { e.preventDefault(); resetBuzzer(); }
    else if (key === 'c') { e.preventDefault(); judgeCorrect(); }
    else if (key === 'w') { e.preventDefault(); judgeWrong(); }
    else if (key === 'arrowleft') { e.preventDefault(); prevQuestion(); }
    else if (key === 'arrowright') { e.preventDefault(); nextQuestion(); }
    else if (key === 'v') {
        e.preventDefault();
        const hasSpecialMedia = validateHasSpecialMedia();
        if (hasSpecialMedia) {
            if (gameState.video.visible && gameState.video.playing) {
                pauseSpecialRoundMedia();
            } else {
                playSpecialRoundMedia();
            }
        } else {
            showToast("⚠️ Vui lòng nạp Video hoặc Slides cho Vòng Đặc Biệt trước!");
        }
    }
});

/* =====================================================
   BOARD & PANEL OPERATIONS (5x5 GRID & OTHELLO)
===================================================== */
function createPanelButtons() {
    const grid = document.getElementById("panelGrid");
    if (!grid) return;
    grid.innerHTML = "";

    gameState.panels.forEach(panel => {
        const btn = document.createElement("button");
        btn.id = "btn" + panel.number;
        btn.className = "panel-button";
        btn.textContent = panel.number;
        btn.onclick = () => selectPanel(panel.number);
        grid.appendChild(btn);
    });
}

function selectPanel(num) {
    if (gameState.selectedPanel === num) {
        gameState.selectedPanel = null;
    } else {
        gameState.selectedPanel = num;
    }
    renderPanels();
    broadcastState("selectPanel");
}

function recalculateScoresFromBoard() {
    const counts = { red: 0, green: 0, white: 0, blue: 0 };
    gameState.panels.forEach(p => {
        if (p.color && counts[p.color] !== undefined) {
            counts[p.color]++;
        }
    });

    ['red', 'green', 'white', 'blue'].forEach(c => {
        gameState.players[c].score = counts[c];
        const input = document.getElementById("score" + capitalize(c));
        if (input) input.value = counts[c];
    });

    updatePreviewScores();
}

function applyOthelloFlips(targetIndex, newColor) {
    if (targetIndex < 0 || targetIndex >= 25 || !newColor) return;

    const row = Math.floor(targetIndex / 5);
    const col = targetIndex % 5;
    const directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    const toFlip = [];

    directions.forEach(([dx, dy]) => {
        let r = row + dx;
        let c = col + dy;
        const line = [];

        while (r >= 0 && r < 5 && c >= 0 && c < 5) {
            const idx = r * 5 + c;
            const p = gameState.panels[idx];
            if (!p || !p.color) {
                line.length = 0;
                break;
            }
            if (p.color === newColor) {
                break;
            } else {
                line.push(idx);
            }
            r += dx;
            c += dy;
        }

        if (r >= 0 && r < 5 && c >= 0 && c < 5 && line.length > 0) {
            const endIdx = r * 5 + c;
            if (gameState.panels[endIdx] && gameState.panels[endIdx].color === newColor) {
                toFlip.push(...line);
            }
        }
    });

    toFlip.forEach(idx => {
        gameState.panels[idx].color = newColor;
        gameState.panels[idx].used = false;
    });

    return toFlip.length;
}

function setPanelColor(color) {
    if (!gameState.selectedPanel) {
        showToast("⚠️ Vui lòng chọn một ô số trước!");
        return;
    }

    const index = gameState.selectedPanel - 1;
    const target = gameState.panels[index];

    target.color = color;
    target.used = false;

    const flipped = applyOthelloFlips(index, color);
    recalculateScoresFromBoard();
    renderPanels();

    broadcastState("colorChange", colorWavMap[color] || 'set_color');

    if (flipped > 0) {
        showToast(`🎨 Đã lật ${flipped} ô sang màu ${color.toUpperCase()}!`);
    } else {
        showToast(`🎨 Ô ${target.number} đã đổi thành màu ${color.toUpperCase()}`);
    }
}

function sendSelectedPanel() {
    if (!gameState.selectedPanel) {
        showToast("⚠️ Vui lòng chọn một ô trước!");
        return;
    }
    broadcastState("selectPanel");
    showToast(`📡 Đã gửi ô số ${gameState.selectedPanel} sang Projector`);
}

function markSelectedUsed() {
    if (!gameState.selectedPanel) {
        showToast("⚠️ Vui lòng chọn một ô trước!");
        return;
    }
    const p = gameState.panels[gameState.selectedPanel - 1];
    p.used = !p.used;
    renderPanels();
    broadcastState("toggleUsed");
    showToast(`Ô số ${gameState.selectedPanel}: ${p.used ? "Đã khóa (Used)" : "Mở khóa"}`);
}

function resetSelectedPanel() {
    if (!gameState.selectedPanel) {
        showToast("⚠️ Vui lòng chọn một ô trước!");
        return;
    }
    const p = gameState.panels[gameState.selectedPanel - 1];
    p.color = null;
    p.used = false;
    recalculateScoresFromBoard();
    renderPanels();
    broadcastState("resetPanel");
    showToast(`Đã reset ô số ${gameState.selectedPanel}`);
}

function clearSelection() {
    gameState.selectedPanel = null;
    renderPanels();
    broadcastState("clearSelection");
}

/* =====================================================
   SPECIAL ROUND (VÒNG THI ĐẶC BIỆT 20S VIDEO/SLIDES)
===================================================== */
let specialCountdownInterval = null;

function setSpecialRoundMode(mode) {
    if (!gameState.video) gameState.video = {};
    if (mode === 'slideshow') mode = 'slides';
    gameState.video.mode = mode;
    renderSpecialRoundUI();
    broadcastState("setSpecialMode");
}

async function handleSpecialVideoUpload(fileOrEvent) {
    let file = null;
    if (fileOrEvent && fileOrEvent.target && fileOrEvent.target.files) {
        file = fileOrEvent.target.files[0];
    } else if (fileOrEvent instanceof File || (fileOrEvent && fileOrEvent.name)) {
        file = fileOrEvent;
    }
    if (file) {
        showToast("⏳ Đang tải video lên...");
        const result = await uploadMediaFileToServer(file);
        if (!gameState.video) gameState.video = {};
        gameState.video.url = result.url;
        gameState.video.videoName = result.name;
        gameState.video.mode = 'local_video';
        renderSpecialRoundUI();
        broadcastState("setSpecialMedia");
        showToast(`✅ Đã nạp Video: ${result.name}`);
    }
    const input = document.getElementById('specialVideoFileInput');
    if (input) input.value = '';
}

function removeSpecialVideo() {
    if (!gameState.video) gameState.video = {};
    gameState.video.url = '';
    gameState.video.videoName = '';
    renderSpecialRoundUI();
    broadcastState("setSpecialMedia");
    showToast("Đã xóa video Vòng Đặc Biệt.");
}

async function handleSpecialSlidesUpload(filesOrEvent) {
    let files = [];
    if (filesOrEvent && filesOrEvent.target && filesOrEvent.target.files) {
        files = Array.from(filesOrEvent.target.files);
    } else if (filesOrEvent && (filesOrEvent instanceof FileList || Array.isArray(filesOrEvent))) {
        files = Array.from(filesOrEvent);
    }
    if (files.length === 0) return;

    showToast(`⏳ Đang xử lý ${files.length} ảnh slide...`);
    if (!gameState.video) gameState.video = {};
    if (!Array.isArray(gameState.video.images)) {
        gameState.video.images = [];
    }

    for (let f of files) {
        const result = await uploadMediaFileToServer(f);
        gameState.video.images.push({
            url: result.url,
            name: result.name
        });
    }

    gameState.video.mode = 'slides';
    renderSpecialRoundUI();
    broadcastState("setSpecialMedia");
    showToast(`✅ Đã thêm ${files.length} slide! Tổng: ${gameState.video.images.length}`);

    const input = document.getElementById('specialSlidesFileInput');
    if (input) input.value = '';
}

function removeSpecialSlide(idx) {
    if (!gameState.video) gameState.video = {};
    if (Array.isArray(gameState.video.images)) {
        gameState.video.images.splice(idx, 1);
        renderSpecialRoundUI();
        broadcastState("setSpecialMedia");
    }
}

function clearSpecialSlides() {
    if (!gameState.video) gameState.video = {};
    gameState.video.images = [];
    renderSpecialRoundUI();
    broadcastState("setSpecialMedia");
    showToast("Đã xóa toàn bộ slide Vòng Đặc Biệt.");
}

function updateVideoUrl() {
    const input = document.getElementById("streamableUrlInput") || document.getElementById("videoUrlInput");
    if (!input) return;
    const url = input.value.trim();
    if (!url) {
        showToast("⚠️ Vui lòng nhập đường dẫn URL hợp lệ!");
        return;
    }
    const embedUrl = parseStreamableUrl(url);
    const finalEmbedUrl = parseYouTubeEmbedUrl(embedUrl);
    if (!gameState.video) gameState.video = {};
    gameState.video.url = url;
    gameState.video.embedUrl = finalEmbedUrl;
    gameState.video.mode = 'streamable';
    renderSpecialRoundUI();
    broadcastState("setSpecialMedia");
    showToast("✅ Đã cập nhật URL Video Web!");
}

function showSpecialRoundMedia() {
    if (!validateHasSpecialMedia()) {
        showToast("⚠️ Chưa có file Video hoặc Slide hình ảnh nào!");
        return;
    }
    gameState.video.visible = true;
    renderSpecialRoundUI();
    broadcastState("showSpecialMedia");
    showToast("📺 Đã mở khung Media Vòng Đặc Biệt trên Projector");
}

function playSpecialRoundMedia() {
    if (!validateHasSpecialMedia()) {
        showToast("⚠️ Chưa có file Video hoặc Slide hình ảnh nào!");
        return;
    }
    gameState.video.visible = true;
    gameState.video.playing = true;
    gameState.video.startTime = Date.now();
    gameState.video.playToken = Date.now();

    renderSpecialRoundUI();
    broadcastState("playSpecialMedia", 'special_start');
    startSpecialRoundProgressLoop();
    showToast("▶️ BẮT ĐẦU PHÁT VÒNG ĐẶC BIỆT (20 GIÂY)!");
}

function pauseSpecialRoundMedia() {
    gameState.video.playing = false;
    if (specialCountdownInterval) {
        clearInterval(specialCountdownInterval);
        specialCountdownInterval = null;
    }
    renderSpecialRoundUI();
    broadcastState("pauseSpecialMedia");
    showToast("⏸️ Đã tạm dừng Media Vòng Đặc Biệt");
}

function resetSpecialRoundMedia() {
    gameState.video.playing = false;
    gameState.video.startTime = null;
    gameState.video.playToken = null;
    gameState.video.currentImageIndex = 0;
    if (specialCountdownInterval) {
        clearInterval(specialCountdownInterval);
        specialCountdownInterval = null;
    }
    updateSpecialProgressBarUI(0, gameState.video.totalDuration || 20);
    renderSpecialRoundUI();
    broadcastState("resetSpecialMedia");
    showToast("🔄 Đã reset về đầu 00:00");
}

function hideSpecialRoundMedia() {
    gameState.video.visible = false;
    gameState.video.playing = false;
    if (specialCountdownInterval) {
        clearInterval(specialCountdownInterval);
        specialCountdownInterval = null;
    }
    renderSpecialRoundUI();
    broadcastState("hideSpecialMedia");
    showToast("⏹️ Đã tắt Media Vòng Đặc Biệt trên Projector");
}

function toggleSpecialRoundLoop(checked) {
    if (!gameState.video) gameState.video = {};
    if (typeof checked === 'boolean') {
        gameState.video.loop = checked;
    } else {
        gameState.video.loop = !gameState.video.loop;
    }
    renderSpecialRoundUI();
    broadcastState("setSpecialMedia");
    showToast(`Lặp lại: ${gameState.video.loop ? 'BẬT' : 'TẮT'}`);
}

function validateHasSpecialMedia() {
    const mode = (gameState.video && gameState.video.mode) ? gameState.video.mode : 'local_video';
    if (mode === 'slides' || mode === 'slideshow') {
        return Array.isArray(gameState.video.images) && gameState.video.images.length > 0;
    }
    if (mode === 'streamable') {
        return !!(gameState.video.embedUrl || gameState.video.url);
    }
    return !!(gameState.video && gameState.video.url);
}

function projectSpecialMediaFull() {
    showSpecialRoundMedia();
    playSpecialRoundMedia();
}

function startSpecialRoundProgressLoop() {
    if (specialCountdownInterval) clearInterval(specialCountdownInterval);
    const totalDuration = (gameState.video && gameState.video.totalDuration) || 20;

    specialCountdownInterval = setInterval(() => {
        if (!gameState.video.playing || !gameState.video.startTime) {
            clearInterval(specialCountdownInterval);
            specialCountdownInterval = null;
            return;
        }

        const elapsed = (Date.now() - gameState.video.startTime) / 1000;
        let currentPos = elapsed;

        if (currentPos >= totalDuration) {
            if (gameState.video.loop) {
                gameState.video.startTime = Date.now();
                currentPos = 0;
            } else {
                currentPos = totalDuration;
                gameState.video.playing = false;
                clearInterval(specialCountdownInterval);
                specialCountdownInterval = null;
                renderSpecialRoundUI();
                showToast("🏁 Kết thúc 20 giây Vòng Đặc Biệt!");
            }
        }

        updateSpecialProgressBarUI(currentPos, totalDuration);
    }, 100);
}

function updateSpecialProgressBarUI(current, total) {
    const bar = document.getElementById("specialProgressBar") || document.getElementById("specialProgressFill");
    const text = document.getElementById("specialCountdownLabel") || document.getElementById("specialTimeText");
    if (bar) {
        const percent = Math.min(100, Math.max(0, (current / total) * 100));
        bar.style.width = percent + "%";
    }
    if (text) {
        text.textContent = `${current.toFixed(1)}s / ${total.toFixed(1)}s`;
    }
}

function renderSpecialRoundUI() {
    if (!gameState.video) {
        gameState.video = {
            mode: 'local_video',
            url: '',
            videoName: '',
            images: [],
            visible: false,
            playing: false,
            loop: true,
            totalDuration: 20
        };
    }
    const vState = gameState.video;
    let curMode = vState.mode || 'local_video';
    if (curMode === 'slideshow') curMode = 'slides';

    // 3 Mode tabs & panels
    const modesConfig = [
        {
            key: 'local_video',
            tabIds: ['btnModeLocalVideo', 'specialTab_local_video'],
            secIds: ['secLocalVideo', 'specialPanel_local_video']
        },
        {
            key: 'slides',
            tabIds: ['btnModeSlideshow', 'specialTab_slides'],
            secIds: ['secSlideshow', 'specialPanel_slides']
        },
        {
            key: 'streamable',
            tabIds: ['btnModeStreamable', 'specialTab_streamable'],
            secIds: ['secStreamable', 'specialPanel_streamable']
        }
    ];

    modesConfig.forEach(m => {
        const isActive = (m.key === curMode);
        m.tabIds.forEach(tid => {
            const tab = document.getElementById(tid);
            if (tab) {
                if (isActive) {
                    tab.classList.add('active');
                    tab.style.background = '#1e293b';
                    tab.style.color = '#f1f5f9';
                    tab.style.border = '1px solid #334155';
                } else {
                    tab.classList.remove('active');
                    tab.style.background = 'transparent';
                    tab.style.color = '#94a3b8';
                    tab.style.border = 'none';
                }
            }
        });
        m.secIds.forEach(sid => {
            const sec = document.getElementById(sid);
            if (sec) {
                sec.style.display = isActive ? 'block' : 'none';
            }
        });
    });

    // Panel 1: Local Video Info Box
    const vInfoBox = document.getElementById('specialVideoInfoBox');
    const vNameTag = document.getElementById('specialVideoFileName') || document.getElementById('specialLocalVideoName');
    if (vState.url && (curMode === 'local_video')) {
        if (vInfoBox) vInfoBox.style.display = 'flex';
        if (vNameTag) vNameTag.textContent = vState.videoName || 'video.mp4';
    } else {
        if (vInfoBox) vInfoBox.style.display = 'none';
    }

    // Panel 2: Slideshow 20s
    const slidesList = document.getElementById('specialSlidesList');
    const slidesCount = Array.isArray(vState.images) ? vState.images.length : 0;
    const slidesCountEl = document.getElementById('specialSlidesCount');
    const slidePerTimeEl = document.getElementById('specialSlidePerTime');

    if (slidesCountEl) slidesCountEl.textContent = `${slidesCount} ảnh`;
    if (slidePerTimeEl) {
        slidePerTimeEl.textContent = slidesCount > 0 ? `${(20 / slidesCount).toFixed(1)}s` : '-- s';
    }

    if (slidesList) {
        if (slidesCount > 0) {
            slidesList.innerHTML = vState.images.map((img, idx) => `
                <div style="position:relative; width:48px; height:36px; flex-shrink:0; border-radius:4px; overflow:hidden; border:1px solid #334155; background:#000;">
                    <img src="${img.url || img}" style="width:100%; height:100%; object-fit:cover;" alt="Slide ${idx + 1}" />
                    <span style="position:absolute; bottom:1px; left:2px; font-size:8px; font-weight:bold; color:#fff; text-shadow:0 0 3px #000; background:rgba(0,0,0,0.6); padding:0 3px; border-radius:2px;">#${idx + 1}</span>
                    <button type="button" onclick="removeSpecialSlide(${idx})" style="position:absolute; top:1px; right:1px; width:14px; height:14px; line-height:12px; font-size:10px; border-radius:50%; background:#ef4444; color:#fff; border:none; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center;">×</button>
                </div>
            `).join('');
        } else {
            slidesList.innerHTML = `<div style="width: 100%; text-align: center; color: #64748b; font-size: 9px; padding: 6px 0;">Bấm "Tải nhiều ảnh" để thêm ảnh vào chuỗi 20s.</div>`;
        }
    }

    // Panel 3: Streamable / Web URL
    const urlInp = document.getElementById('streamableUrlInput') || document.getElementById('videoUrlInput');
    if (urlInp && vState.url && document.activeElement !== urlInp) {
        urlInp.value = vState.url;
    }

    // Loop
    const chkLoop = document.getElementById('chkSpecialLoop');
    if (chkLoop) {
        chkLoop.checked = (vState.loop !== false);
    }
    const loopBtn = document.getElementById('btnSpecialToggleLoop');
    if (loopBtn) {
        loopBtn.textContent = vState.loop ? "🔁 Lặp lại: BẬT" : "➡️ Lặp lại: TẮT";
        loopBtn.style.background = vState.loop ? "#0284c7" : "#334155";
    }

    // Playback Action Buttons
    const showBtn = document.getElementById('btnShowVideo') || document.getElementById('btnSpecialShow');
    if (showBtn) {
        if (vState.visible) {
            showBtn.textContent = "👁️ Đang hiện";
            showBtn.style.background = "#2563eb";
        } else {
            showBtn.textContent = "👁️ Hiện";
            showBtn.style.background = "#d97706";
        }
    }

    const playBtn = document.getElementById('btnPlayVideo') || document.getElementById('btnSpecialPlay');
    if (playBtn) {
        if (vState.playing) {
            playBtn.textContent = "⏸️ Đang phát 20s";
            playBtn.style.background = "#15803d";
        } else {
            playBtn.textContent = "▶️ Phát 20s";
            playBtn.style.background = "#16a34a";
        }
    }
}

// Backward compatibility video stubs
function renderVideoUI() { renderSpecialRoundUI(); }
function showVideo() { showSpecialRoundMedia(); }
function playVideo() { playSpecialRoundMedia(); }
function hideVideo() { hideSpecialRoundMedia(); }

/* =====================================================
   HIDE COLOR & BOARD RENDER
===================================================== */
function toggleHideColor(color) {
    if (!gameState.hiddenColors) {
        gameState.hiddenColors = { red: false, green: false, white: false, blue: false };
    }
    gameState.hiddenColors[color] = !gameState.hiddenColors[color];
    renderPanels();
    broadcastState("toggleHideColor");
    showToast(`${gameState.hiddenColors[color] ? "Ẩn" : "Hiện"} màu ${color.toUpperCase()} trên Projector`);
}

function renderPanels() {
    const previewBoard = document.getElementById("previewBoard");
    if (previewBoard) previewBoard.innerHTML = "";

    gameState.panels.forEach(panel => {
        const btn = document.getElementById("btn" + panel.number);
        const cell = document.createElement("div");
        cell.id = "pCell" + panel.number;
        cell.className = "preview-cell";
        cell.textContent = panel.number;

        if (btn) {
            btn.className = "panel-button";
            btn.textContent = panel.number;
        }

        if (panel.color) {
            const isHidden = gameState.hiddenColors && gameState.hiddenColors[panel.color];
            if (btn) {
                btn.classList.add("panel-" + panel.color);
                if (isHidden) btn.classList.add("color-hidden");
            }
            if (!isHidden) {
                cell.classList.add("panel-" + panel.color);
            }
        }

        if (panel.used) {
            if (btn) btn.classList.add("used");
            cell.classList.add("used");
        }

        if (gameState.selectedPanel === panel.number) {
            if (btn) btn.classList.add("active");
            cell.classList.add("active");
        }

        if (previewBoard) previewBoard.appendChild(cell);
    });

    const selVal = document.getElementById("selectedPanelValue");
    if (selVal) {
        selVal.textContent = gameState.selectedPanel || "---";
    }

    updatePreviewScores();
}

/* =====================================================
   PLAYER & SCORE LOGIC
===================================================== */
function updatePlayerName(color, name) {
    gameState.players[color].name = name;
    broadcastState("updateName");
}

function changeScore(color, delta) {
    let s = (gameState.players[color].score || 0) + delta;
    if (s < 0) s = 0;
    gameState.players[color].score = s;
    const input = document.getElementById("score" + capitalize(color));
    if (input) input.value = s;
    updatePreviewScores();
    broadcastState("updateScore");
}

function updateScore(color, val) {
    let s = parseInt(val, 10);
    if (isNaN(s) || s < 0) s = 0;
    gameState.players[color].score = s;
    updatePreviewScores();
    broadcastState("updateScore");
}

function updatePreviewScores() {
    ['red', 'green', 'white', 'blue'].forEach(color => {
        const score = gameState.players[color].score || 0;
        const pEl = document.getElementById("pPlayer" + capitalize(color));
        if (pEl) {
            pEl.textContent = score;
        }
    });
}

function resetAllScores() {
    ['red', 'green', 'white', 'blue'].forEach(color => {
        gameState.players[color].score = 0;
        const input = document.getElementById("score" + capitalize(color));
        if (input) input.value = 0;
    });
    updatePreviewScores();
    broadcastState("resetScores");
    showToast("Đã reset toàn bộ điểm số về 0.");
}

function resetGame() {
    gameState.selectedPanel = null;
    gameState.panels.forEach(panel => {
        panel.used = false;
        panel.color = null;
    });
    resetBuzzer();
    resetAllScores();
    renderPanels();
    broadcastState("resetGame");
    showToast("Đã reset toàn bộ trò chơi.");
}

/* =====================================================
   GLOBAL RENDER & INITIALIZATION
===================================================== */
function renderAll() {
    renderQuestion();
    renderPanels();
    renderBuzzerUI();
    updateSoundboardVolumeUI(gameState.soundVolume !== undefined ? gameState.soundVolume : 100);
    renderDatabaseTable();
    updateTopbarMediaStatus();
}

// Initial setup
try {
    const savedVol = localStorage.getItem("attack25_sound_volume");
    if (savedVol !== null && !isNaN(Number(savedVol))) {
        gameState.soundVolume = Number(savedVol);
    }
    const urlParams = new URLSearchParams(window.location.search);
    const qRoom = urlParams.get('roomid') || urlParams.get('roomId') || urlParams.get('room') || localStorage.getItem('attack25_active_roomid');
    if (qRoom && /^\d{6}$/.test(qRoom)) {
        const inputRoom = document.getElementById('ctrlRoomId');
        if (inputRoom) inputRoom.value = qRoom;
    }
} catch (e) {}

createPanelButtons();
renderAll();
activateRoomFromController();

(function fetchInitialServerState() {
    const currentRoom = (document.getElementById('ctrlRoomId') && document.getElementById('ctrlRoomId').value) || '123456';
    fetch('/api/state?roomid=' + encodeURIComponent(currentRoom))
        .then(res => res.json())
        .then(data => {
            if (data && data.state) {
                ensureValidPanels(data.state);
                gameState = data.state;
                if (data.state.currentQuestionIndex !== undefined) {
                    currentQuestionIndex = data.state.currentQuestionIndex;
                }
                renderAll();
            }
            if (data && data.questions && data.questions.length > 0) {
                questionsList = data.questions;
                renderQuestion();
                renderDatabaseTable();
            }
        })
        .catch(() => {});
})();
