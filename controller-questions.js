/**
 * ATTACK 25 - CONTROLLER QUESTIONS MODULE
 * Handles: Question teleprompter, database management, Excel/CSV/JSON import/export, modal question editor, question media projector broadcasting
 */

/* =====================================================
   APP TAB NAVIGATION (GAME vs DATABASE)
===================================================== */
let currentAppTab = 'game';

function switchAppTab(tabName) {
    currentAppTab = tabName;
    const tabGame = document.getElementById('tabBtnGame');
    const tabDb = document.getElementById('tabBtnDatabase');
    const viewGame = document.getElementById('gameWorkspaceView');
    const viewDb = document.getElementById('databaseView');

    if (tabName === 'game') {
        if (tabGame) tabGame.classList.add('active');
        if (tabDb) tabDb.classList.remove('active');
        if (viewGame) viewGame.style.display = 'grid';
        if (viewDb) viewDb.style.display = 'none';
    } else {
        if (tabGame) tabGame.classList.remove('active');
        if (tabDb) tabDb.classList.add('active');
        if (viewGame) viewGame.style.display = 'none';
        if (viewDb) viewDb.style.display = 'flex';
        renderDatabaseTable();
    }
}

/* =====================================================
   RENDER QUESTION & TELEPROMPTER
===================================================== */
function renderQuestion() {
    if (!questionsList || questionsList.length === 0) {
        questionsList = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
    }
    if (currentQuestionIndex < 0) currentQuestionIndex = 0;
    if (currentQuestionIndex >= questionsList.length) currentQuestionIndex = questionsList.length - 1;

    const currentQ = questionsList[currentQuestionIndex] || {
        stt: 1,
        type: 'text',
        question: "Chưa có câu hỏi",
        answer: "---"
    };

    const numTag = document.getElementById("qNumberTag");
    const countTag = document.getElementById("qCountTag");
    const textBox = document.getElementById("qTextBox");
    const answerVal = document.getElementById("qAnswerVal");
    const selectDropdown = document.getElementById("qSelectDropdown");
    const tabBadge = document.getElementById("tabBadgeCount");

    if (tabBadge) tabBadge.textContent = questionsList.length;
    if (numTag) numTag.textContent = `CÂU ${currentQ.stt || (currentQuestionIndex + 1)}`;
    if (countTag) countTag.textContent = `[${currentQuestionIndex + 1}/${questionsList.length}]`;
    if (textBox) textBox.textContent = currentQ.question;
    if (answerVal) answerVal.textContent = currentQ.answer;

    if (selectDropdown) {
        selectDropdown.innerHTML = "";
        questionsList.forEach((q, idx) => {
            const opt = document.createElement("option");
            opt.value = idx;
            const mediaIcon = q.type === 'image' ? '🖼️ ' : (q.type === 'video' ? '🎬 ' : (q.type === 'slides' ? '📑 ' : '📝 '));
            opt.textContent = `${mediaIcon}Câu ${q.stt || (idx + 1)}: ${q.question ? q.question.substring(0, 32) + (q.question.length > 32 ? '...' : '') : '(Trống)'}`;
            if (idx === currentQuestionIndex) {
                opt.selected = true;
            }
            selectDropdown.appendChild(opt);
        });
    }

    const qmBox = document.getElementById("questionMediaBox");
    const qmThumb = document.getElementById("qmThumb");
    const qmName = document.getElementById("qmName");
    const qmFormatTag = document.getElementById("qmFormatTag");
    const qmBtnShow = document.getElementById("btnShowQuestionMedia");
    const qmBtnHide = document.getElementById("btnHideQuestionMedia");

    if (qmBox) {
        const hasMedia = (currentQ.type === 'image' || currentQ.type === 'video' || currentQ.type === 'slides') &&
            ((currentQ.mediaUrl && currentQ.mediaUrl.trim() !== '') || (Array.isArray(currentQ.images) && currentQ.images.length > 0));

        if (hasMedia) {
            qmBox.style.display = "block";
            if (qmFormatTag) {
                qmFormatTag.textContent = currentQ.type === 'image' ? 'HÌNH ẢNH' : (currentQ.type === 'slides' ? `SLIDES (${currentQ.images?.length || 0})` : 'VIDEO');
                qmFormatTag.style.background = currentQ.type === 'image' ? '#059669' : (currentQ.type === 'slides' ? '#7c3aed' : '#d97706');
            }
            if (qmName) {
                qmName.textContent = currentQ.mediaName || (currentQ.type === 'slides' ? `${currentQ.images?.length || 0} ảnh slide` : 'Media');
            }
            if (qmThumb) {
                if (currentQ.type === 'image' && currentQ.mediaUrl) {
                    qmThumb.src = currentQ.mediaUrl;
                    qmThumb.style.display = "block";
                } else if (currentQ.type === 'slides' && Array.isArray(currentQ.images) && currentQ.images.length > 0) {
                    qmThumb.src = currentQ.images[0].url || currentQ.images[0];
                    qmThumb.style.display = "block";
                } else {
                    qmThumb.src = "";
                    qmThumb.style.display = "none";
                }
            }

            const isThisMediaShowing = gameState.questionMedia &&
                gameState.questionMedia.visible &&
                gameState.questionMedia.questionStt === (currentQ.stt || (currentQuestionIndex + 1));

            if (qmBtnShow) {
                qmBtnShow.style.background = isThisMediaShowing ? "#15803d" : "#2563eb";
                qmBtnShow.textContent = isThisMediaShowing ? "✅ Đang chiếu" : "📺 Chiếu Projector";
            }
            if (qmBtnHide) {
                qmBtnHide.style.display = isThisMediaShowing ? "inline-block" : "none";
            }
        } else {
            qmBox.style.display = "none";
        }
    }

    updateTopbarMediaStatus();
    renderSpecialRoundUI();
}

function updateTopbarMediaStatus() {
    const bar = document.getElementById("topbarMediaStatus");
    const text = document.getElementById("topbarMediaText");
    if (!bar || !text) return;

    if (gameState.questionMedia && gameState.questionMedia.visible) {
        bar.style.display = "flex";
        const typeStr = gameState.questionMedia.type === 'image' ? 'ẢNH' : (gameState.questionMedia.type === 'slides' ? 'SLIDES' : 'VIDEO');
        text.textContent = `📺 Chiếu Câu ${gameState.questionMedia.questionStt || ''} (${typeStr})`;
    } else {
        bar.style.display = "none";
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        gameState.currentQuestionIndex = currentQuestionIndex;
        syncActiveMediaOnQuestionChange();
        renderQuestion();
        broadcastState("questionChange");
    } else {
        showToast("Đã là câu hỏi đầu tiên.");
    }
}

function nextQuestion() {
    if (currentQuestionIndex < questionsList.length - 1) {
        currentQuestionIndex++;
        gameState.currentQuestionIndex = currentQuestionIndex;
        syncActiveMediaOnQuestionChange();
        renderQuestion();
        broadcastState("questionChange");
    } else {
        showToast("Đã là câu hỏi cuối cùng.");
    }
}

function jumpToQuestion(index) {
    const idx = parseInt(index, 10);
    if (!isNaN(idx) && idx >= 0 && idx < questionsList.length) {
        currentQuestionIndex = idx;
        gameState.currentQuestionIndex = currentQuestionIndex;
        syncActiveMediaOnQuestionChange();
        renderQuestion();
        broadcastState("questionChange");
    }
}

function syncActiveMediaOnQuestionChange() {
    if (gameState.questionMedia && gameState.questionMedia.visible) {
        const curQ = questionsList[currentQuestionIndex];
        const hasMedia = curQ && (curQ.type === 'image' || curQ.type === 'video' || curQ.type === 'slides') &&
            ((curQ.mediaUrl && curQ.mediaUrl.trim() !== '') || (Array.isArray(curQ.images) && curQ.images.length > 0));

        if (hasMedia) {
            showCurrentQuestionMedia();
        } else {
            hideQuestionMedia(true);
        }
    }
}

function randomQuestion() {
    if (questionsList.length <= 1) return;
    let rand = currentQuestionIndex;
    while (rand === currentQuestionIndex) {
        rand = Math.floor(Math.random() * questionsList.length);
    }
    currentQuestionIndex = rand;
    gameState.currentQuestionIndex = currentQuestionIndex;
    syncActiveMediaOnQuestionChange();
    renderQuestion();
    broadcastState("questionChange");
    showToast(`Đã chuyển ngẫu nhiên tới Câu ${questionsList[rand].stt || (rand + 1)}.`);
}

function armCurrentQuestion() {
    armBuzzer();
}

/* =====================================================
   QUESTION MEDIA PROJECTOR BROADCAST
===================================================== */
function showCurrentQuestionMedia() {
    const curQ = questionsList[currentQuestionIndex];
    if (!curQ) return;

    if (!curQ.type || curQ.type === 'text') {
        showToast("⚠️ Câu hỏi này không có media (hình ảnh/video).");
        return;
    }

    if (!gameState.questionMedia) {
        gameState.questionMedia = {};
    }

    gameState.questionMedia.visible = true;
    gameState.questionMedia.type = curQ.type;
    gameState.questionMedia.url = curQ.mediaUrl || '';
    gameState.questionMedia.images = Array.isArray(curQ.images) ? curQ.images : [];
    gameState.questionMedia.totalDuration = curQ.totalDuration || 20;
    gameState.questionMedia.questionText = curQ.question || '';
    gameState.questionMedia.questionStt = curQ.stt || (currentQuestionIndex + 1);
    gameState.questionMedia.answer = curQ.answer || '';
    gameState.questionMedia.playing = true;
    gameState.questionMedia.playToken = Date.now();

    broadcastState("showQuestionMedia");
    renderQuestion();
    showToast(`📺 Đang chiếu Media Câu ${curQ.stt || (currentQuestionIndex + 1)} sang Projector!`);
}

function hideQuestionMedia(silent = false) {
    if (gameState.questionMedia) {
        gameState.questionMedia.visible = false;
        gameState.questionMedia.playing = false;
    }
    broadcastState("hideQuestionMedia");
    renderQuestion();
    if (!silent) {
        showToast("⏹️ Đã tắt chiếu Media câu hỏi trên Projector.");
    }
}

/* =====================================================
   DATABASE VIEW (FILTER, SEARCH, RENDER TABLE)
===================================================== */
let dbFilter = 'all';
let dbSearch = '';

function filterDatabase(type) {
    dbFilter = type;
    document.querySelectorAll('.db-filter-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`filterBtn_${type}`);
    if (btn) btn.classList.add('active');
    renderDatabaseTable();
}

function handleDbSearch(val) {
    dbSearch = (val || '').toLowerCase().trim();
    renderDatabaseTable();
}

function renderDatabaseTable() {
    const tbody = document.getElementById("dbTableBody");
    const countTotal = document.getElementById("dbStatTotal");
    const countImage = document.getElementById("dbStatImage");
    const countVideo = document.getElementById("dbStatVideo");
    const countText = document.getElementById("dbStatText");

    if (!tbody) return;

    if (countTotal) countTotal.textContent = questionsList.length;
    if (countImage) countImage.textContent = questionsList.filter(q => q.type === 'image' || q.type === 'slides').length;
    if (countVideo) countVideo.textContent = questionsList.filter(q => q.type === 'video').length;
    if (countText) countText.textContent = questionsList.filter(q => !q.type || q.type === 'text').length;

    let filtered = questionsList.map((q, originalIdx) => ({ ...q, originalIdx }));

    if (dbFilter !== 'all') {
        if (dbFilter === 'media') {
            filtered = filtered.filter(q => q.type === 'image' || q.type === 'video' || q.type === 'slides');
        } else if (dbFilter === 'slides') {
            filtered = filtered.filter(q => q.type === 'slides');
        } else {
            filtered = filtered.filter(q => (q.type || 'text') === dbFilter);
        }
    }

    if (dbSearch) {
        filtered = filtered.filter(q =>
            (q.question && q.question.toLowerCase().includes(dbSearch)) ||
            (q.answer && q.answer.toLowerCase().includes(dbSearch)) ||
            (String(q.stt).includes(dbSearch))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color:#64748b;">Không tìm thấy câu hỏi phù hợp.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((q) => {
        const isCurrent = q.originalIdx === currentQuestionIndex;
        let formatBadge = '';
        let mediaPreview = '<span style="color:#64748b; font-size:10px;">—</span>';

        if (q.type === 'image') {
            formatBadge = `<span class="db-format-pill db-format-image">🖼️ Hình ảnh</span>`;
            if (q.mediaUrl) {
                mediaPreview = `<div class="db-media-cell"><img src="${q.mediaUrl}" class="db-thumb" onclick="openEditQuestionModal(${q.originalIdx})" title="Nhấp để sửa/xem ảnh" /> <span style="font-size:10px; color:#94a3b8;">${q.mediaName || 'Ảnh'}</span></div>`;
            }
        } else if (q.type === 'slides') {
            const slideCount = Array.isArray(q.images) ? q.images.length : 0;
            formatBadge = `<span class="db-format-pill" style="background:rgba(124,58,237,0.15); color:#a78bfa; border:1px solid rgba(124,58,237,0.4);">📑 ${slideCount} Slide</span>`;
            const firstImg = (Array.isArray(q.images) && q.images.length > 0) ? (q.images[0].url || q.images[0]) : '';
            if (firstImg) {
                mediaPreview = `<div class="db-media-cell"><img src="${firstImg}" class="db-thumb" onclick="openEditQuestionModal(${q.originalIdx})" title="Nhấp để xem các slide" /> <span style="font-size:10px; color:#94a3b8;">${slideCount} ảnh</span></div>`;
            }
        } else if (q.type === 'video') {
            formatBadge = `<span class="db-format-pill db-format-video">🎬 Video</span>`;
            mediaPreview = `<div class="db-media-cell"><div class="db-thumb-video" onclick="openEditQuestionModal(${q.originalIdx})">▶️</div> <span style="font-size:10px; color:#94a3b8;">${q.mediaName || 'Clip'}</span></div>`;
        } else {
            formatBadge = `<span class="db-format-pill db-format-text">📝 Văn bản</span>`;
        }

        return `
            <tr class="${isCurrent ? 'active-q-row' : ''}">
                <td style="font-weight:bold; color:var(--gold); width: 45px; text-align:center;">${q.stt || (q.originalIdx + 1)}</td>
                <td style="width: 100px;">${formatBadge}</td>
                <td style="font-weight:600; color:#fff; max-width: 340px;">${escapeHtml(q.question)}</td>
                <td style="font-weight:700; color:#4ade80; max-width: 180px;">${escapeHtml(q.answer)}</td>
                <td style="width: 150px;">${mediaPreview}</td>
                <td style="width: 220px; white-space:nowrap;">
                    <button class="button button-blue" style="height:22px; font-size:9px; display:inline-flex; padding:0 6px;" onclick="jumpToQuestion(${q.originalIdx}); switchAppTab('game');" title="Chọn làm câu hỏi hiện tại">🎯 Chọn</button>
                    <button class="button button-orange" style="height:22px; font-size:9px; display:inline-flex; padding:0 6px;" onclick="openEditQuestionModal(${q.originalIdx})" title="Chỉnh sửa câu hỏi">✏️ Sửa</button>
                    <button class="button button-gray" style="height:22px; font-size:9px; display:inline-flex; padding:0 4px;" onclick="moveQuestionUp(${q.originalIdx})" title="Di chuyển lên">⬆️</button>
                    <button class="button button-gray" style="height:22px; font-size:9px; display:inline-flex; padding:0 4px;" onclick="moveQuestionDown(${q.originalIdx})" title="Di chuyển xuống">⬇️</button>
                    <button class="button button-red" style="height:22px; font-size:9px; display:inline-flex; padding:0 6px;" onclick="deleteQuestion(${q.originalIdx})" title="Xóa câu hỏi">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function moveQuestionUp(idx) {
    if (idx <= 0) return;
    const temp = questionsList[idx];
    questionsList[idx] = questionsList[idx - 1];
    questionsList[idx - 1] = temp;
    questionsList.forEach((q, i) => q.stt = i + 1);
    saveAndBroadcastQuestions();
    renderDatabaseTable();
    renderQuestion();
}

function moveQuestionDown(idx) {
    if (idx >= questionsList.length - 1) return;
    const temp = questionsList[idx];
    questionsList[idx] = questionsList[idx + 1];
    questionsList[idx + 1] = temp;
    questionsList.forEach((q, i) => q.stt = i + 1);
    saveAndBroadcastQuestions();
    renderDatabaseTable();
    renderQuestion();
}

function deleteQuestion(idx) {
    if (questionsList.length <= 1) {
        showToast("⚠️ Cần giữ lại ít nhất 1 câu hỏi!");
        return;
    }
    const q = questionsList[idx];
    if (confirm(`Bạn có chắc chắn muốn xóa Câu ${q.stt || (idx + 1)}:\n"${q.question}"?`)) {
        questionsList.splice(idx, 1);
        questionsList.forEach((item, i) => item.stt = i + 1);
        if (currentQuestionIndex >= questionsList.length) {
            currentQuestionIndex = questionsList.length - 1;
        }
        saveAndBroadcastQuestions();
        renderDatabaseTable();
        renderQuestion();
        showToast("🗑️ Đã xóa câu hỏi.");
    }
}

function clearAllQuestions() {
    if (confirm("⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ câu hỏi trong database?")) {
        questionsList = [{ stt: 1, type: "text", question: "Câu hỏi mẫu", answer: "Đáp án mẫu" }];
        currentQuestionIndex = 0;
        saveAndBroadcastQuestions();
        renderDatabaseTable();
        renderQuestion();
        showToast("🧹 Đã làm trống database.");
    }
}

function resetToSampleQuestions() {
    if (confirm("Khôi phục danh sách 27 câu hỏi gốc tiêu chuẩn của Attack 25?")) {
        questionsList = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
        currentQuestionIndex = 0;
        saveAndBroadcastQuestions();
        renderDatabaseTable();
        renderQuestion();
        showToast("✅ Đã khôi phục 27 câu hỏi gốc!");
    }
}

function saveAndBroadcastQuestions() {
    try {
        localStorage.setItem("attack25_questions", JSON.stringify(questionsList));
    } catch (e) {}
    broadcastQuestions();
}

function setQuestionAsSpecialRoundMedia(idx) {
    const q = questionsList[idx !== undefined ? idx : currentQuestionIndex];
    if (!q) return;

    if (q.type === 'slides' && Array.isArray(q.images) && q.images.length > 0) {
        gameState.video.mode = 'slides';
        gameState.video.images = JSON.parse(JSON.stringify(q.images));
        gameState.video.totalDuration = q.totalDuration || 20;
        renderSpecialRoundUI();
        broadcastState("setSpecialMedia");
        showToast(`✅ Đã chuyển ${q.images.length} slide sang Vòng Đặc Biệt!`);
    } else if (q.type === 'image' && q.mediaUrl) {
        gameState.video.mode = 'slides';
        gameState.video.images = [{ url: q.mediaUrl, name: q.mediaName || 'Ảnh câu hỏi' }];
        gameState.video.totalDuration = 20;
        renderSpecialRoundUI();
        broadcastState("setSpecialMedia");
        showToast("✅ Đã chuyển ảnh sang Vòng Đặc Biệt!");
    } else if (q.type === 'video' && q.mediaUrl) {
        gameState.video.mode = 'local_video';
        gameState.video.url = q.mediaUrl;
        gameState.video.videoName = q.mediaName || 'Video câu hỏi';
        renderSpecialRoundUI();
        broadcastState("setSpecialMedia");
        showToast("✅ Đã chuyển video sang Vòng Đặc Biệt!");
    } else {
        showToast("⚠️ Câu hỏi này không có media hợp lệ!");
    }
}

/* =====================================================
   MODAL ADD / EDIT QUESTION LOGIC
===================================================== */
let modalMediaData = {
    mode: 'text',
    editIndex: -1,
    imageUrl: '',
    imageName: '',
    videoUrl: '',
    videoName: '',
    slides: [],
    totalDuration: 20
};

function selectModalFormat(format) {
    modalMediaData.mode = format;
    ['text', 'image', 'video', 'slides'].forEach(f => {
        const card = document.getElementById(`formatCard_${f}`);
        if (card) {
            if (f === format) card.classList.add('selected');
            else card.classList.remove('selected');
        }
    });

    const secImg = document.getElementById('modalImageSection');
    const secVid = document.getElementById('modalVideoSection');
    const secSlides = document.getElementById('modalSlidesSection');

    if (secImg) secImg.style.display = format === 'image' ? 'flex' : 'none';
    if (secVid) secVid.style.display = format === 'video' ? 'flex' : 'none';
    if (secSlides) secSlides.style.display = format === 'slides' ? 'flex' : 'none';
}

function openAddQuestionModal() {
    modalMediaData = {
        mode: 'text',
        editIndex: -1,
        imageUrl: '',
        imageName: '',
        videoUrl: '',
        videoName: '',
        slides: [],
        totalDuration: 20
    };

    document.getElementById('modalTitle').textContent = 'Thêm câu hỏi mới';
    document.getElementById('modalStt').value = questionsList.length + 1;
    document.getElementById('modalQuestionText').value = '';
    document.getElementById('modalAnswerText').value = '';
    document.getElementById('modalDuration').value = 20;

    resetModalMediaPreviews();
    selectModalFormat('text');
    document.getElementById('questionModal').style.display = 'flex';
}

function openEditQuestionModal(idx) {
    const q = questionsList[idx];
    if (!q) return;

    modalMediaData = {
        mode: q.type || 'text',
        editIndex: idx,
        imageUrl: (q.type === 'image' ? q.mediaUrl : '') || '',
        imageName: (q.type === 'image' ? q.mediaName : '') || '',
        videoUrl: (q.type === 'video' ? q.mediaUrl : '') || '',
        videoName: (q.type === 'video' ? q.mediaName : '') || '',
        slides: Array.isArray(q.images) ? JSON.parse(JSON.stringify(q.images)) : [],
        totalDuration: q.totalDuration || 20
    };

    document.getElementById('modalTitle').textContent = `Chỉnh sửa Câu ${q.stt || (idx + 1)}`;
    document.getElementById('modalStt').value = q.stt || (idx + 1);
    document.getElementById('modalQuestionText').value = q.question || '';
    document.getElementById('modalAnswerText').value = q.answer || '';
    document.getElementById('modalDuration').value = q.totalDuration || 20;

    resetModalMediaPreviews();

    if (q.type === 'image' && q.mediaUrl) {
        showModalImagePreview(q.mediaUrl, q.mediaName || 'Ảnh hiện tại');
    } else if (q.type === 'video' && q.mediaUrl) {
        showModalVideoPreview(q.mediaUrl, q.mediaName || 'Video hiện tại');
    } else if (q.type === 'slides' && Array.isArray(q.images)) {
        renderModalSlidesList();
    }

    selectModalFormat(q.type || 'text');
    document.getElementById('questionModal').style.display = 'flex';
}

function openEditModalForCurrentQuestion() {
    openEditQuestionModal(currentQuestionIndex);
}

function closeQuestionModal() {
    document.getElementById('questionModal').style.display = 'none';
}

function resetModalMediaPreviews() {
    const imgPrev = document.getElementById('modalImagePreview');
    const vidPrev = document.getElementById('modalVideoPreview');
    const slidesList = document.getElementById('modalSlidesList');

    if (imgPrev) imgPrev.style.display = 'none';
    if (vidPrev) vidPrev.style.display = 'none';
    if (slidesList) slidesList.innerHTML = '';
}

async function handleModalImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        showToast("⏳ Đang tải ảnh lên...");
        const result = await uploadMediaFileToServer(file);
        modalMediaData.imageUrl = result.url;
        modalMediaData.imageName = result.name;
        showModalImagePreview(result.url, result.name);
        showToast(`✅ Đã tải ảnh: ${result.name}`);
    }
}

function handleModalImageUrlInput(url) {
    if (url && url.trim()) {
        modalMediaData.imageUrl = url.trim();
        modalMediaData.imageName = 'Link hình ảnh';
        showModalImagePreview(url.trim(), 'Link hình ảnh');
    }
}

function showModalImagePreview(url, name) {
    const prev = document.getElementById('modalImagePreview');
    const img = document.getElementById('modalPreviewImgTag');
    const nameTag = document.getElementById('modalImageNameTag');
    if (prev && img) {
        img.src = url;
        if (nameTag) nameTag.textContent = name || 'Ảnh đã chọn';
        prev.style.display = 'flex';
    }
}

async function handleModalVideoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        showToast("⏳ Đang tải video lên...");
        const result = await uploadMediaFileToServer(file);
        modalMediaData.videoUrl = result.url;
        modalMediaData.videoName = result.name;
        showModalVideoPreview(result.url, result.name);
        showToast(`✅ Đã tải video: ${result.name}`);
    }
}

function handleModalVideoUrlInput(url) {
    if (url && url.trim()) {
        let finalUrl = parseStreamableUrl(url.trim());
        finalUrl = parseYouTubeEmbedUrl(finalUrl);
        modalMediaData.videoUrl = finalUrl;
        modalMediaData.videoName = 'Link video web';
        showModalVideoPreview(finalUrl, 'Link video');
    }
}

function showModalVideoPreview(url, name) {
    const prev = document.getElementById('modalVideoPreview');
    const vid = document.getElementById('modalPreviewVideoTag');
    const nameTag = document.getElementById('modalVideoNameTag');
    if (prev && vid) {
        vid.src = url;
        if (nameTag) nameTag.textContent = name || 'Video đã chọn';
        prev.style.display = 'flex';
    }
}

async function handleModalSlidesUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    showToast(`⏳ Đang xử lý ${files.length} ảnh slide...`);
    for (let f of files) {
        const result = await uploadMediaFileToServer(f);
        modalMediaData.slides.push({
            url: result.url,
            name: result.name
        });
    }
    renderModalSlidesList();
    showToast(`✅ Đã thêm ${files.length} slide! Tổng: ${modalMediaData.slides.length}`);
}

function renderModalSlidesList() {
    const container = document.getElementById('modalSlidesList');
    if (!container) return;

    if (modalMediaData.slides.length === 0) {
        container.innerHTML = `<span style="font-size:10px; color:#64748b; padding:8px 0;">Chưa có ảnh slide nào được thêm.</span>`;
        return;
    }

    container.innerHTML = modalMediaData.slides.map((s, idx) => `
        <div class="modal-slide-card">
            <img src="${s.url}" alt="Slide ${idx + 1}" />
            <span class="slide-num">#${idx + 1}</span>
            <button class="slide-del" onclick="removeModalSlide(${idx})" title="Xóa slide này">×</button>
        </div>
    `).join('');
}

function removeModalSlide(idx) {
    modalMediaData.slides.splice(idx, 1);
    renderModalSlidesList();
}

function clearModalSlides() {
    modalMediaData.slides = [];
    renderModalSlidesList();
}

function removeModalMedia() {
    modalMediaData.imageUrl = '';
    modalMediaData.imageName = '';
    modalMediaData.videoUrl = '';
    modalMediaData.videoName = '';
    resetModalMediaPreviews();
    showToast("Đã xóa file đính kèm.");
}

function saveQuestionModal() {
    const stt = parseInt(document.getElementById('modalStt').value, 10) || (questionsList.length + 1);
    const questionText = document.getElementById('modalQuestionText').value.trim();
    const answerText = document.getElementById('modalAnswerText').value.trim();
    const duration = parseInt(document.getElementById('modalDuration').value, 10) || 20;

    if (!questionText) {
        showToast("⚠️ Vui lòng nhập nội dung câu hỏi!");
        return;
    }
    if (!answerText) {
        showToast("⚠️ Vui lòng nhập câu trả lời!");
        return;
    }

    let itemType = modalMediaData.mode;
    let mediaUrl = '';
    let mediaName = '';
    let images = [];

    if (itemType === 'image') {
        mediaUrl = modalMediaData.imageUrl;
        mediaName = modalMediaData.imageName;
    } else if (itemType === 'video') {
        mediaUrl = modalMediaData.videoUrl;
        mediaName = modalMediaData.videoName;
    } else if (itemType === 'slides') {
        images = JSON.parse(JSON.stringify(modalMediaData.slides));
    }

    const newQ = {
        stt: stt,
        type: itemType,
        question: questionText,
        answer: answerText,
        mediaUrl: mediaUrl,
        mediaName: mediaName,
        images: images,
        totalDuration: duration
    };

    if (modalMediaData.editIndex >= 0 && modalMediaData.editIndex < questionsList.length) {
        questionsList[modalMediaData.editIndex] = newQ;
        showToast(`✅ Đã cập nhật Câu ${stt}!`);
    } else {
        questionsList.push(newQ);
        showToast(`✅ Đã thêm Câu ${stt}!`);
    }

    saveAndBroadcastQuestions();
    closeQuestionModal();
    renderDatabaseTable();
    renderQuestion();
}

/* =====================================================
   EXCEL / CSV / JSON IMPORT & EXPORT
===================================================== */
function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.json')) {
        importQuestionsJSON(file);
        return;
    }

    const reader = new FileReader();

    if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        reader.onload = function(e) {
            try {
                const text = e.target.result;
                const rows = parseCSVText(text);
                parseRawRows(rows);
            } catch (err) {
                showToast("⚠️ Lỗi đọc file CSV: " + err.message);
            }
        };
        reader.readAsText(file, "UTF-8");
    } else {
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                if (typeof XLSX === 'undefined') {
                    showToast("⚠️ Thư viện XLSX chưa sẵn sàng. Vui lòng thử lại!");
                    return;
                }
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                parseRawRows(jsonRows);
            } catch (err) {
                showToast("⚠️ Lỗi phân tích file Excel: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function parseRawRows(rows) {
    if (!rows || rows.length === 0) {
        showToast("⚠️ File không chứa dữ liệu!");
        return;
    }

    let parsedQuestions = [];
    let startRow = 0;

    if (rows.length > 0) {
        const firstRowStr = JSON.stringify(rows[0]).toLowerCase();
        if (firstRowStr.includes('câu') || firstRowStr.includes('đáp án') || firstRowStr.includes('question') || firstRowStr.includes('answer')) {
            startRow = 1;
        }
    }

    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        let stt = i + 1 - startRow;
        let qText = '';
        let aText = '';
        let mType = 'text';
        let mUrl = '';

        if (row.length === 2) {
            qText = String(row[0] || '').trim();
            aText = String(row[1] || '').trim();
        } else if (row.length >= 3) {
            if (!isNaN(parseInt(row[0], 10))) {
                stt = parseInt(row[0], 10);
                qText = String(row[1] || '').trim();
                aText = String(row[2] || '').trim();
                if (row[3]) mUrl = String(row[3]).trim();
                if (row[4]) mType = String(row[4]).trim().toLowerCase();
            } else {
                qText = String(row[0] || '').trim();
                aText = String(row[1] || '').trim();
                if (row[2]) mUrl = String(row[2]).trim();
                if (row[3]) mType = String(row[3]).trim().toLowerCase();
            }
        }

        if (mUrl && !mType) {
            if (mUrl.match(/\.(mp4|webm|avi|mov)$/i) || mUrl.includes('streamable') || mUrl.includes('youtube')) {
                mType = 'video';
            } else {
                mType = 'image';
            }
        }

        if (qText) {
            parsedQuestions.push({
                stt: stt,
                type: mType || 'text',
                question: qText,
                answer: aText,
                mediaUrl: mUrl,
                mediaName: mUrl ? 'Link đính kèm' : ''
            });
        }
    }

    if (parsedQuestions.length > 0) {
        questionsList = parsedQuestions;
        currentQuestionIndex = 0;
        saveAndBroadcastQuestions();
        renderDatabaseTable();
        renderQuestion();
        showToast(`🎉 Đã nạp thành công ${parsedQuestions.length} câu hỏi từ file!`);
    } else {
        showToast("⚠️ Không tìm thấy câu hỏi hợp lệ trong file!");
    }
}

function parseCSVText(text) {
    const lines = text.split(/\r\n|\n/);
    return lines.map(line => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(cur.trim());
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur.trim());
        return result;
    }).filter(r => r.length > 0 && r.some(c => c !== ''));
}

function exportQuestionsToExcel() {
    if (typeof XLSX === 'undefined') {
        showToast("⚠️ Thư viện XLSX chưa sẵn sàng.");
        return;
    }

    const data = [
        ["STT", "Định dạng", "Câu hỏi", "Đáp án", "Link Media"]
    ];

    questionsList.forEach(q => {
        data.push([
            q.stt,
            q.type || 'text',
            q.question,
            q.answer,
            q.mediaUrl || ''
        ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attack25_Questions");
    XLSX.writeFile(workbook, "Attack25_Questions_Export.xlsx");
    showToast("📥 Đã xuất file Excel thành công!");
}

function exportQuestionsJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(questionsList, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "attack25_questions.json");
    dlAnchorElem.click();
    showToast("📥 Đã xuất file JSON thành công!");
}

function importQuestionsJSON(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (Array.isArray(parsed) && parsed.length > 0) {
                questionsList = parsed;
                currentQuestionIndex = 0;
                saveAndBroadcastQuestions();
                renderDatabaseTable();
                renderQuestion();
                showToast(`🎉 Đã nạp ${parsed.length} câu hỏi từ JSON!`);
            } else {
                showToast("⚠️ File JSON không đúng định dạng mảng câu hỏi!");
            }
        } catch (err) {
            showToast("⚠️ Lỗi đọc file JSON: " + err.message);
        }
    };
    reader.readAsText(file, "UTF-8");
}

// Drag and drop support for Excel Dropzone
document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById("excelDropzone");
    const fileInput = document.getElementById("excelFileInput");

    if (dropzone && fileInput) {
        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        });

        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("dragover");
        });

        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleExcelUpload({ target: { files: e.dataTransfer.files } });
            }
        });
    }
});
