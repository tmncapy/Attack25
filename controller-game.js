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

    if (gameState.players && gameState.players[winnerColor]) {
        gameState.players[winnerColor].score = (gameState.players[winnerColor].score || 0) + 1;
        const input = document.getElementById("score" + capitalize(winnerColor));
        if (input) input.value = gameState.players[winnerColor].score;
        updatePreviewScores();
    }

    gameState.buzzer.status = 'locked';
    renderBuzzerUI();
    broadcastState("judgeCorrect", 'correct');
    showToast(`✅ ${winnerName} TRẢ LỜI ĐÚNG! (+1 Điểm)`);
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
    const banner = document.getElementById("buzzerBanner") || document.getElementById("buzzerStatusBanner");
    const valText = document.getElementById("buzzerStateText") || document.getElementById("buzzerStateVal");
    const winnerInfo = document.getElementById("buzzerWinnerDisplay") || document.getElementById("buzzerWinnerInfo");
    const badge = document.getElementById("buzzerBadge");
    const bzState = gameState.buzzer || {};

    const status = bzState.status || 'locked';

    if (banner) {
        banner.className = 'buzzer-status-banner';
        if (status === 'armed') {
            banner.classList.add('armed');
        } else if (status === 'buzzed') {
            banner.classList.add('buzzed');
        } else {
            banner.classList.add('locked');
        }
    }

    if (badge) {
        if (status === 'armed') {
            badge.textContent = 'ĐANG MỞ';
            badge.style.background = '#14532d';
            badge.style.color = '#86efac';
        } else if (status === 'buzzed') {
            badge.textContent = 'ĐÃ BẤM';
            badge.style.background = '#78350f';
            badge.style.color = '#fde047';
        } else {
            badge.textContent = 'ĐÃ KHÓA';
            badge.style.background = '#7f1d1d';
            badge.style.color = '#fca5a5';
        }
    }

    if (valText) {
        if (status === 'armed') {
            valText.textContent = '🟢 ĐANG MỞ CHUÔNG';
        } else if (status === 'buzzed') {
            valText.textContent = '🔔 ĐÃ BẤM CHUÔNG!';
        } else {
            valText.textContent = '🔒 ĐÃ KHÓA CHUÔNG';
        }
    }

    if (winnerInfo) {
        if (status === 'buzzed' && bzState.winner) {
            const pName = gameState.players[bzState.winner]?.name || bzState.winner;
            winnerInfo.innerHTML = `<span style="color:#ffd43b; font-weight:bold;">${escapeHtml(pName)}</span> <span style="font-size:9.5px; color:#94a3b8;">(+${bzState.buzzTime || '0.00'}s)</span>`;
        } else if (status === 'armed') {
            winnerInfo.innerHTML = '<span style="color:#4ade80; font-weight:bold;">Sẵn sàng nhận tín hiệu...</span>';
        } else {
            winnerInfo.textContent = 'Chưa có ai bấm chuông';
        }
    }

    ['red', 'green', 'white', 'blue'].forEach(color => {
        const btn = document.getElementById('buzzBtn' + capitalize(color)) || document.getElementById(`buzzerBtn_${color}`);
        const rankTag = document.getElementById(`buzzerRank_${color}`);
        const nameEl = document.getElementById('buzzName' + capitalize(color));

        if (nameEl && gameState.players && gameState.players[color]) {
            nameEl.textContent = gameState.players[color].name || color.toUpperCase();
        }

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
    gameState.video.mode = mode;
    renderSpecialRoundUI();
    broadcastState("setSpecialMode");
}

async function handleSpecialVideoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        showToast("⏳ Đang tải video lên...");
        const result = await uploadMediaFileToServer(file);
        gameState.video.url = result.url;
        gameState.video.videoName = result.name;
        gameState.video.mode = 'local_video';
        renderSpecialRoundUI();
        broadcastState("setSpecialMedia");
        showToast(`✅ Đã nạp Video: ${result.name}`);
    }
}

function removeSpecialVideo() {
    gameState.video.url = '';
    gameState.video.videoName = '';
    renderSpecialRoundUI();
    broadcastState("setSpecialMedia");
    showToast("Đã xóa video Vòng Đặc Biệt.");
}

async function handleSpecialSlidesUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    showToast(`⏳ Đang xử lý ${files.length} ảnh slide...`);
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
}

function removeSpecialSlide(idx) {
    if (Array.isArray(gameState.video.images)) {
        gameState.video.images.splice(idx, 1);
        renderSpecialRoundUI();
        broadcastState("setSpecialMedia");
    }
}

function clearSpecialSlides() {
    gameState.video.images = [];
    renderSpecialRoundUI();
    broadcastState("setSpecialMedia");
    showToast("Đã xóa toàn bộ slide Vòng Đặc Biệt.");
}

function updateVideoUrl() {
    const input = document.getElementById("videoUrlInput");
    if (!input) return;
    const url = input.value.trim();
    if (!url) {
        showToast("⚠️ Vui lòng nhập đường dẫn URL hợp lệ!");
        return;
    }
    const embedUrl = parseStreamableUrl(url);
    const finalEmbedUrl = parseYouTubeEmbedUrl(embedUrl);
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

function toggleSpecialRoundLoop() {
    gameState.video.loop = !gameState.video.loop;
    renderSpecialRoundUI();
    broadcastState("setSpecialMedia");
    showToast(`Lặp lại: ${gameState.video.loop ? 'BẬT' : 'TẮT'}`);
}

function validateHasSpecialMedia() {
    const mode = gameState.video.mode || 'local_video';
    if (mode === 'slides') {
        return Array.isArray(gameState.video.images) && gameState.video.images.length > 0;
    }
    if (mode === 'streamable') {
        return !!(gameState.video.embedUrl || gameState.video.url);
    }
    return !!gameState.video.url;
}

function projectSpecialMediaFull() {
    showSpecialRoundMedia();
    playSpecialRoundMedia();
}

function startSpecialRoundProgressLoop() {
    if (specialCountdownInterval) clearInterval(specialCountdownInterval);
    const totalDuration = gameState.video.totalDuration || 20;

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
    const bar = document.getElementById("specialProgressFill") || document.getElementById("specialProgressBar");
    const text = document.getElementById("specialTimeText") || document.getElementById("specialCountdownLabel");
    if (!bar || !text) return;

    const percent = Math.min(100, Math.max(0, (current / total) * 100));
    bar.style.width = percent + "%";
    text.textContent = `${current.toFixed(1)}s / ${total}s`;
}

function renderSpecialRoundUI() {
    const vState = gameState.video || {};
    const curMode = vState.mode || 'local_video';

    // Tabs and Panels (supports both specialTab_* and btnMode* naming)
    const modeMap = {
        'local_video': { btn: 'btnModeLocalVideo', sec: 'secLocalVideo', tab: 'specialTab_local_video', panel: 'specialPanel_local_video' },
        'slideshow': { btn: 'btnModeSlideshow', sec: 'secSlideshow', tab: 'specialTab_slides', panel: 'specialPanel_slides' },
        'slides': { btn: 'btnModeSlideshow', sec: 'secSlideshow', tab: 'specialTab_slides', panel: 'specialPanel_slides' },
        'streamable': { btn: 'btnModeStreamable', sec: 'secStreamable', tab: 'specialTab_streamable', panel: 'specialPanel_streamable' }
    };

    ['local_video', 'slideshow', 'streamable'].forEach(m => {
        const info = modeMap[m];
        const isCurrent = (curMode === m || (m === 'slideshow' && curMode === 'slides'));
        
        const btn = document.getElementById(info.btn);
        if (btn) {
            btn.style.background = isCurrent ? '#2563eb' : '#334155';
            btn.style.borderColor = isCurrent ? '#60a5fa' : 'transparent';
        }
        const sec = document.getElementById(info.sec);
        if (sec) {
            sec.style.display = isCurrent ? 'block' : 'none';
        }
        const tab = document.getElementById(info.tab);
        if (tab) {
            if (isCurrent) tab.classList.add('active');
            else tab.classList.remove('active');
        }
        const panel = document.getElementById(info.panel);
        if (panel) {
            panel.style.display = isCurrent ? 'block' : 'none';
        }
    });

    const vNameTag = document.getElementById('specialLocalVideoName') || document.getElementById('specialVideoFileName');
    const vInfoBox = document.getElementById('specialVideoInfoBox');
    if (vNameTag) {
        vNameTag.textContent = vState.videoName || (vState.url ? 'Video đã nạp' : 'Chưa có video');
    }
    if (vInfoBox) {
        vInfoBox.style.display = (vState.videoName || vState.url) ? 'flex' : 'none';
    }

    const slidesCountTag = document.getElementById('specialSlidesCount');
    if (slidesCountTag) {
        slidesCountTag.textContent = `${Array.isArray(vState.images) ? vState.images.length : 0} ảnh`;
    }

    const slidesList = document.getElementById('specialSlidesList');
    if (slidesList) {
        if (Array.isArray(vState.images) && vState.images.length > 0) {
            slidesList.innerHTML = vState.images.map((img, idx) => `
                <div class="special-slide-card">
                    <img src="${img.url || img}" alt="Slide ${idx + 1}" />
                    <span class="special-slide-idx">#${idx + 1}</span>
                    <button class="special-slide-del" onclick="removeSpecialSlide(${idx})">×</button>
                </div>
            `).join('');
        } else {
            slidesList.innerHTML = `<span style="font-size:10px; color:#64748b; padding:6px 0;">Chưa có ảnh slide nào. Hãy chọn nhiều file ảnh để nạp.</span>`;
        }
    }

    const urlInp = document.getElementById('videoUrlInput') || document.getElementById('streamableUrlInput');
    if (urlInp && vState.url && document.activeElement !== urlInp) {
        urlInp.value = vState.url;
    }

    const loopChk = document.getElementById('chkSpecialLoop');
    if (loopChk) {
        loopChk.checked = !!vState.loop;
    }

    const loopBtn = document.getElementById('btnSpecialToggleLoop');
    if (loopBtn) {
        loopBtn.textContent = vState.loop ? "🔁 Lặp lại: BẬT" : "➡️ Lặp lại: TẮT";
        loopBtn.style.background = vState.loop ? "#0284c7" : "#334155";
    }

    const playBtn = document.getElementById('btnSpecialPlay');
    if (playBtn) {
        if (vState.playing) {
            playBtn.textContent = "⏸️ Tạm dừng";
            playBtn.style.background = "#d97706";
        } else {
            playBtn.textContent = "▶️ Phát (20s)";
            playBtn.style.background = "#15803d";
        }
    }

    const showBtn = document.getElementById('btnSpecialShow');
    if (showBtn) {
        showBtn.textContent = vState.visible ? "👁️ Đang chiếu" : "📺 Chiếu Projector";
        showBtn.style.background = vState.visible ? "#2563eb" : "#1e293b";
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
