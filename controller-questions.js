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
    const viewGame = document.getElementById('gameWorkspace');
    const viewDb = document.getElementById('questionsDatabaseView');

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
    dbFilter = (type === 'slideshow') ? 'slides' : type;
    document.querySelectorAll('.db-filter-btn').forEach(b => {
        const f = b.getAttribute('data-filter');
        if (f === type || (f === 'slideshow' && type === 'slides') || (f === 'slides' && type === 'slideshow')) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
    renderDatabaseTable();
}

function handleDbSearch(val) {
    dbSearch = (val || '').toLowerCase().trim();
    renderDatabaseTable();
}

function renderDatabaseTable() {
    const tbody = document.getElementById("dbTableBody");
    if (!tbody) return;

    const totalCount = questionsList.length;
    const textCount = questionsList.filter(q => !q.type || q.type === 'text').length;
    const imageCount = questionsList.filter(q => q.type === 'image').length;
    const videoCount = questionsList.filter(q => q.type === 'video').length;
    const audioCount = questionsList.filter(q => q.type === 'audio').length;
    const slidesCount = questionsList.filter(q => q.type === 'slides').length;

    // Header stats
    const totalEl = document.getElementById("dbTotalCount") || document.getElementById("dbStatTotal");
    const textEl = document.getElementById("dbTextCount") || document.getElementById("dbStatText");
    const imageEl = document.getElementById("dbImageCount") || document.getElementById("dbStatImage");
    const videoEl = document.getElementById("dbVideoCount") || document.getElementById("dbStatVideo");
    const slidesEl = document.getElementById("dbSlideshowCount") || document.getElementById("dbStatSlideshow");
    const tabBadge = document.getElementById("tabBadgeCount");

    if (totalEl) totalEl.textContent = totalCount;
    if (textEl) textEl.textContent = textCount;
    if (imageEl) imageEl.textContent = imageCount;
    if (videoEl) videoEl.textContent = videoCount;
    if (slidesEl) slidesEl.textContent = slidesCount;
    if (tabBadge) tabBadge.textContent = totalCount;

    // Filter tags count
    const fAll = document.getElementById("filterAllCount");
    const fText = document.getElementById("filterTextCount");
    const fImage = document.getElementById("filterImageCount");
    const fVideo = document.getElementById("filterVideoCount");
    const fSlides = document.getElementById("filterSlideshowCount");

    if (fAll) fAll.textContent = totalCount;
    if (fText) fText.textContent = textCount;
    if (fImage) fImage.textContent = imageCount;
    if (fVideo) fVideo.textContent = videoCount;
    if (fSlides) fSlides.textContent = slidesCount;

    let filtered = questionsList.map((q, originalIdx) => ({ ...q, originalIdx }));

    if (dbFilter !== 'all') {
        if (dbFilter === 'media') {
            filtered = filtered.filter(q => q.type === 'image' || q.type === 'video' || q.type === 'audio' || q.type === 'slides');
        } else if (dbFilter === 'slides' || dbFilter === 'slideshow') {
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
        let mediaCell = '<span style="color:#64748b; font-size:10px;">— (Văn bản)</span>';

        const isShowingOnProj = gameState.questionMedia &&
            gameState.questionMedia.visible &&
            gameState.questionMedia.questionStt === (q.stt || (q.originalIdx + 1));

        if (q.type === 'image') {
            formatBadge = `<span class="db-format-pill db-format-image">🖼️ Hình ảnh</span>`;
            if (q.mediaUrl) {
                mediaCell = `
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                        <img src="${q.mediaUrl}" class="db-thumb" onclick="openEditQuestionModal(${q.originalIdx})" title="Nhấp để sửa/xem ảnh" style="cursor:pointer;" />
                        <button class="button ${isShowingOnProj ? 'button-green' : 'button-blue'}" style="height:22px; font-size:9px; padding:0 6px;" onclick="showQuestionMediaFromDb(${q.originalIdx})">
                            ${isShowingOnProj ? '✅ Đang chiếu' : '📺 Chiếu Full'}
                        </button>
                    </div>
                `;
            }
        } else if (q.type === 'audio') {
            formatBadge = `<span class="db-format-pill db-format-audio">🎵 Âm thanh</span>`;
            if (q.mediaUrl) {
                mediaCell = `
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                        <div class="db-thumb-audio" onclick="openEditQuestionModal(${q.originalIdx})" style="cursor:pointer;" title="Nhấp để sửa/nghe audio">🎵</div>
                        <button class="button ${isShowingOnProj ? 'button-green' : 'button-purple'}" style="height:22px; font-size:9px; padding:0 6px;" onclick="showQuestionMediaFromDb(${q.originalIdx})">
                            ${isShowingOnProj ? '✅ Đang phát' : '🎵 Phát Audio'}
                        </button>
                    </div>
                `;
            }
        } else if (q.type === 'slides') {
            const slideCount = Array.isArray(q.images) ? q.images.length : 0;
            formatBadge = `<span class="db-format-pill" style="background:rgba(124,58,237,0.15); color:#a78bfa; border:1px solid rgba(124,58,237,0.4);">📑 ${slideCount} Slide</span>`;
            const firstImg = (Array.isArray(q.images) && q.images.length > 0) ? (q.images[0].url || q.images[0]) : '';
            mediaCell = `
                <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                    ${firstImg ? `<img src="${firstImg}" class="db-thumb" onclick="openEditQuestionModal(${q.originalIdx})" title="Nhấp xem các slide" style="cursor:pointer;" />` : ''}
                    <button class="button ${isShowingOnProj ? 'button-green' : 'button-purple'}" style="height:22px; font-size:9px; padding:0 6px;" onclick="showQuestionMediaFromDb(${q.originalIdx})">
                        ${isShowingOnProj ? '✅ Đang chiếu' : '📑 Chiếu Slide'}
                    </button>
                </div>
            `;
        } else if (q.type === 'video') {
            formatBadge = `<span class="db-format-pill db-format-video">🎬 Video</span>`;
            mediaCell = `
                <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                    <div class="db-thumb-video" onclick="openEditQuestionModal(${q.originalIdx})" style="cursor:pointer;" title="Nhấp để sửa video">▶️</div>
                    <button class="button ${isShowingOnProj ? 'button-green' : 'button-orange'}" style="height:22px; font-size:9px; padding:0 6px;" onclick="showQuestionMediaFromDb(${q.originalIdx})">
                        ${isShowingOnProj ? '✅ Đang chiếu' : '🎬 Chiếu Video'}
                    </button>
                </div>
            `;
        } else {
            formatBadge = `<span class="db-format-pill db-format-text">📝 Văn bản</span>`;
        }

        return `
            <tr class="${isCurrent ? 'active-q-row' : ''}">
                <td style="font-weight:bold; color:var(--gold); width: 45px; text-align:center;">${q.stt || (q.originalIdx + 1)}</td>
                <td style="width: 100px; text-align:center;">${formatBadge}</td>
                <td style="font-weight:600; color:#fff; max-width: 340px;">${escapeHtml(q.question)}</td>
                <td style="font-weight:700; color:#4ade80; max-width: 180px;">${escapeHtml(q.answer)}</td>
                <td style="width: 155px; text-align:center;">${mediaCell}</td>
                <td style="width: 135px; white-space:nowrap; text-align:center;">
                    <button class="button button-blue" style="height:22px; font-size:9px; display:inline-flex; padding:0 6px;" onclick="jumpToQuestion(${q.originalIdx}); switchAppTab('game');" title="Chọn làm câu hỏi hiện tại trên Bàn điều khiển">🎯 Chọn</button>
                    <button class="button button-orange" style="height:22px; font-size:9px; display:inline-flex; padding:0 6px;" onclick="openEditQuestionModal(${q.originalIdx})" title="Chỉnh sửa câu hỏi">✏️ Sửa</button>
                    <button class="button button-gray" style="height:22px; font-size:9px; display:inline-flex; padding:0 4px;" onclick="moveQuestionUp(${q.originalIdx})" title="Di chuyển lên">⬆️</button>
                    <button class="button button-gray" style="height:22px; font-size:9px; display:inline-flex; padding:0 4px;" onclick="moveQuestionDown(${q.originalIdx})" title="Di chuyển xuống">⬇️</button>
                    <button class="button button-red" style="height:22px; font-size:9px; display:inline-flex; padding:0 6px;" onclick="deleteQuestion(${q.originalIdx})" title="Xóa câu hỏi">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function showQuestionMediaFromDb(idx) {
    if (idx !== undefined && idx >= 0 && idx < questionsList.length) {
        currentQuestionIndex = idx;
        gameState.currentQuestionIndex = currentQuestionIndex;
    }
    showCurrentQuestionMedia();
    renderDatabaseTable();
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
    audioUrl: '',
    audioName: '',
    slides: [],
    totalDuration: 20
};

function selectModalFormat(format) {
    if (format === 'slideshow') format = 'slides';
    modalMediaData.mode = format;

    const optMap = {
        'text': 'formatOptText',
        'image': 'formatOptImage',
        'video': 'formatOptVideo',
        'audio': 'formatOptAudio',
        'slides': 'formatOptSlideshow',
        'slideshow': 'formatOptSlideshow'
    };

    ['text', 'image', 'video', 'audio', 'slideshow'].forEach(f => {
        const cardId = optMap[f] || `formatOpt${f.charAt(0).toUpperCase() + f.slice(1)}`;
        const card = document.getElementById(cardId);
        if (card) {
            if (f === format || (format === 'slides' && f === 'slideshow')) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        }
    });

    const secImg = document.getElementById('modalImageSection');
    const secVid = document.getElementById('modalVideoSection');
    const secAud = document.getElementById('modalAudioSection');
    const secSlides = document.getElementById('modalSlideshowSection') || document.getElementById('modalSlidesSection');

    if (secImg) secImg.style.display = (format === 'image') ? 'flex' : 'none';
    if (secVid) secVid.style.display = (format === 'video') ? 'flex' : 'none';
    if (secAud) secAud.style.display = (format === 'audio') ? 'flex' : 'none';
    if (secSlides) secSlides.style.display = (format === 'slides' || format === 'slideshow') ? 'flex' : 'none';
}

function openAddQuestionModal() {
    modalMediaData = {
        mode: 'text',
        editIndex: -1,
        imageUrl: '',
        imageName: '',
        videoUrl: '',
        videoName: '',
        audioUrl: '',
        audioName: '',
        slides: [],
        totalDuration: 20
    };

    const titleEl = document.getElementById('modalTitle');
    if (titleEl) titleEl.innerHTML = '<span>➕</span> Thêm câu hỏi mới';

    const editIdxEl = document.getElementById('modalEditIndex');
    if (editIdxEl) editIdxEl.value = -1;

    const sttEl = document.getElementById('modalStt');
    if (sttEl) sttEl.value = questionsList.length + 1;

    const qTextEl = document.getElementById('modalQuestionText');
    if (qTextEl) qTextEl.value = '';

    const ansEl = document.getElementById('modalAnswer') || document.getElementById('modalAnswerText');
    if (ansEl) ansEl.value = '';

    const imgUrlEl = document.getElementById('modalImageUrlInput');
    if (imgUrlEl) imgUrlEl.value = '';
    const vidUrlEl = document.getElementById('modalVideoUrlInput');
    if (vidUrlEl) vidUrlEl.value = '';
    const audUrlEl = document.getElementById('modalAudioUrlInput');
    if (audUrlEl) audUrlEl.value = '';

    resetModalMediaPreviews();
    selectModalFormat('text');

    const modal = document.getElementById('questionModal');
    if (modal) modal.style.display = 'flex';
}

function openEditQuestionModal(idx) {
    if (idx === undefined || idx < 0 || idx >= questionsList.length) {
        idx = currentQuestionIndex;
    }
    const q = questionsList[idx];
    if (!q) {
        showToast("⚠️ Không tìm thấy câu hỏi!");
        return;
    }

    modalMediaData = {
        mode: q.type || 'text',
        editIndex: idx,
        imageUrl: (q.type === 'image' ? q.mediaUrl : '') || '',
        imageName: (q.type === 'image' ? q.mediaName : '') || '',
        videoUrl: (q.type === 'video' ? q.mediaUrl : '') || '',
        videoName: (q.type === 'video' ? q.mediaName : '') || '',
        audioUrl: (q.type === 'audio' ? q.mediaUrl : '') || '',
        audioName: (q.type === 'audio' ? q.mediaName : '') || '',
        slides: Array.isArray(q.images) ? JSON.parse(JSON.stringify(q.images)) : [],
        totalDuration: q.totalDuration || 20
    };

    const titleEl = document.getElementById('modalTitle');
    if (titleEl) titleEl.innerHTML = `<span>✏️</span> Chỉnh sửa Câu ${q.stt || (idx + 1)}`;

    const editIdxEl = document.getElementById('modalEditIndex');
    if (editIdxEl) editIdxEl.value = idx;

    const sttEl = document.getElementById('modalStt');
    if (sttEl) sttEl.value = q.stt || (idx + 1);

    const qTextEl = document.getElementById('modalQuestionText');
    if (qTextEl) qTextEl.value = q.question || '';

    const ansEl = document.getElementById('modalAnswer') || document.getElementById('modalAnswerText');
    if (ansEl) ansEl.value = q.answer || '';

    const imgUrlEl = document.getElementById('modalImageUrlInput');
    if (imgUrlEl) imgUrlEl.value = (q.type === 'image' ? q.mediaUrl : '') || '';
    const vidUrlEl = document.getElementById('modalVideoUrlInput');
    if (vidUrlEl) vidUrlEl.value = (q.type === 'video' ? q.mediaUrl : '') || '';
    const audUrlEl = document.getElementById('modalAudioUrlInput');
    if (audUrlEl) audUrlEl.value = (q.type === 'audio' ? q.mediaUrl : '') || '';

    resetModalMediaPreviews();

    if (q.type === 'image' && q.mediaUrl) {
        showModalImagePreview(q.mediaUrl, q.mediaName || 'Ảnh câu hỏi');
    } else if (q.type === 'video' && q.mediaUrl) {
        showModalVideoPreview(q.mediaUrl, q.mediaName || 'Video câu hỏi');
    } else if (q.type === 'audio' && q.mediaUrl) {
        showModalAudioPreview(q.mediaUrl, q.mediaName || 'Audio câu hỏi');
    } else if ((q.type === 'slides' || q.type === 'slideshow') && Array.isArray(q.images)) {
        renderModalSlidesList();
    }

    selectModalFormat(q.type || 'text');

    const modal = document.getElementById('questionModal');
    if (modal) modal.style.display = 'flex';
}

function openEditModalForCurrentQuestion() {
    openEditQuestionModal(currentQuestionIndex);
}

function closeQuestionModal() {
    const modal = document.getElementById('questionModal');
    if (modal) modal.style.display = 'none';
}

function resetModalMediaPreviews() {
    const imgBox = document.getElementById('modalImagePreviewBox');
    const imgTag = document.getElementById('modalImagePreview') || document.getElementById('modalPreviewImgTag');
    if (imgBox) imgBox.style.display = 'none';
    if (imgTag) imgTag.src = '';

    const vidBox = document.getElementById('modalVideoPreviewBox');
    const vidTag = document.getElementById('modalVideoPreview') || document.getElementById('modalPreviewVideoTag');
    const frameTag = document.getElementById('modalFramePreview');
    if (vidBox) vidBox.style.display = 'none';
    if (vidTag) { vidTag.pause(); vidTag.src = ''; }
    if (frameTag) { frameTag.src = ''; frameTag.style.display = 'none'; }

    const audBox = document.getElementById('modalAudioPreviewBox');
    const audTag = document.getElementById('modalAudioPreview');
    if (audBox) audBox.style.display = 'none';
    if (audTag) { audTag.pause(); audTag.src = ''; }

    renderModalSlidesList();
}

async function handleModalImageUpload(eOrFile) {
    const file = eOrFile && eOrFile.target ? eOrFile.target.files[0] : eOrFile;
    if (file) {
        showToast("⏳ Đang tải ảnh lên...");
        const result = await uploadMediaFileToServer(file);
        modalMediaData.imageUrl = result.url;
        modalMediaData.imageName = result.name;
        const imgUrlInput = document.getElementById('modalImageUrlInput');
        if (imgUrlInput) imgUrlInput.value = result.url;
        showModalImagePreview(result.url, result.name);
        showToast(`✅ Đã tải ảnh: ${result.name}`);
    }
}

function handleModalImageUrlInput(url) {
    if (url && url.trim()) {
        const cleanUrl = url.trim();
        modalMediaData.imageUrl = cleanUrl;
        modalMediaData.imageName = 'URL hình ảnh';
        showModalImagePreview(cleanUrl, 'Link hình ảnh');
    }
}

function showModalImagePreview(url, name) {
    const box = document.getElementById('modalImagePreviewBox');
    const img = document.getElementById('modalImagePreview') || document.getElementById('modalPreviewImgTag');
    const info = document.getElementById('modalImageInfo');
    if (box && img) {
        img.src = url;
        if (info) info.textContent = `Tên file: ${name || 'image.png'}`;
        box.style.display = 'flex';
    }
}

async function handleModalVideoUpload(eOrFile) {
    const file = eOrFile && eOrFile.target ? eOrFile.target.files[0] : eOrFile;
    if (file) {
        showToast("⏳ Đang tải video lên...");
        const result = await uploadMediaFileToServer(file);
        modalMediaData.videoUrl = result.url;
        modalMediaData.videoName = result.name;
        const vidUrlInput = document.getElementById('modalVideoUrlInput');
        if (vidUrlInput) vidUrlInput.value = result.url;
        showModalVideoPreview(result.url, result.name);
        showToast(`✅ Đã tải video: ${result.name}`);
    }
}

function handleModalVideoUrlInput(url) {
    if (url && url.trim()) {
        let finalUrl = parseStreamableUrl(url.trim());
        finalUrl = parseYouTubeEmbedUrl(finalUrl);
        modalMediaData.videoUrl = finalUrl;
        modalMediaData.videoName = 'URL video web';
        showModalVideoPreview(finalUrl, 'Link video');
    }
}

function showModalVideoPreview(url, name) {
    const box = document.getElementById('modalVideoPreviewBox');
    const vid = document.getElementById('modalVideoPreview') || document.getElementById('modalPreviewVideoTag');
    const frame = document.getElementById('modalFramePreview');
    const info = document.getElementById('modalVideoInfo');

    if (!box) return;

    if (url.includes('streamable.com/e/') || url.includes('youtube.com/embed/')) {
        if (vid) { vid.style.display = 'none'; vid.src = ''; }
        if (frame) {
            frame.src = url;
            frame.style.display = 'block';
        }
    } else {
        if (frame) { frame.style.display = 'none'; frame.src = ''; }
        if (vid) {
            vid.src = url;
            vid.style.display = 'block';
        }
    }
    if (info) info.textContent = `Video: ${name || 'video.mp4'}`;
    box.style.display = 'flex';
}

async function handleModalAudioUpload(eOrFile) {
    const file = eOrFile && eOrFile.target ? eOrFile.target.files[0] : eOrFile;
    if (file) {
        showToast("⏳ Đang tải audio lên...");
        const result = await uploadMediaFileToServer(file);
        modalMediaData.audioUrl = result.url;
        modalMediaData.audioName = result.name;
        const audUrlInput = document.getElementById('modalAudioUrlInput');
        if (audUrlInput) audUrlInput.value = result.url;
        showModalAudioPreview(result.url, result.name);
        showToast(`✅ Đã tải audio: ${result.name}`);
    }
}

function handleModalAudioUrlInput(url) {
    if (url && url.trim()) {
        const cleanUrl = url.trim();
        modalMediaData.audioUrl = cleanUrl;
        modalMediaData.audioName = 'URL audio';
        showModalAudioPreview(cleanUrl, 'Link Audio');
    }
}

function showModalAudioPreview(url, name) {
    const box = document.getElementById('modalAudioPreviewBox');
    const aud = document.getElementById('modalAudioPreview');
    const info = document.getElementById('modalAudioInfo');
    if (box && aud) {
        aud.src = url;
        if (info) info.textContent = `Audio: ${name || 'audio.mp3'}`;
        box.style.display = 'flex';
    }
}

async function handleModalSlidesUpload(eOrFiles) {
    let files = [];
    if (eOrFiles && eOrFiles.target) {
        files = Array.from(eOrFiles.target.files);
    } else if (eOrFiles && eOrFiles.length !== undefined) {
        files = Array.from(eOrFiles);
    }
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
    const countEl = document.getElementById('modalSlidesCount');
    const perTimeEl = document.getElementById('modalSlidePerTime');

    const totalSlides = modalMediaData.slides.length;
    if (countEl) countEl.textContent = totalSlides;
    if (perTimeEl) {
        perTimeEl.textContent = totalSlides > 0 ? `${(20 / totalSlides).toFixed(1)}s` : '--s';
    }

    if (!container) return;

    if (totalSlides === 0) {
        container.innerHTML = `<div style="width: 100%; text-align: center; color: #64748b; font-size: 9.5px; padding: 8px 0;">Chưa chọn ảnh nào</div>`;
        return;
    }

    container.innerHTML = modalMediaData.slides.map((s, idx) => `
        <div class="modal-slide-card">
            <img src="${s.url}" alt="Slide ${idx + 1}" />
            <span class="slide-num">#${idx + 1}</span>
            <button class="slide-del" type="button" onclick="removeModalSlide(${idx})" title="Xóa slide này">✕</button>
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
    showToast("Đã xóa tất cả slide.");
}

function removeModalMedia(type) {
    if (type === 'image' || (!type && modalMediaData.mode === 'image')) {
        modalMediaData.imageUrl = '';
        modalMediaData.imageName = '';
        const el = document.getElementById('modalImageUrlInput');
        if (el) el.value = '';
    } else if (type === 'video' || (!type && modalMediaData.mode === 'video')) {
        modalMediaData.videoUrl = '';
        modalMediaData.videoName = '';
        const el = document.getElementById('modalVideoUrlInput');
        if (el) el.value = '';
    } else if (type === 'audio' || (!type && modalMediaData.mode === 'audio')) {
        modalMediaData.audioUrl = '';
        modalMediaData.audioName = '';
        const el = document.getElementById('modalAudioUrlInput');
        if (el) el.value = '';
    }
    resetModalMediaPreviews();
    showToast("Đã xóa file đính kèm.");
}

function saveQuestionModal(showOnProjector = false) {
    const sttEl = document.getElementById('modalStt');
    const qTextEl = document.getElementById('modalQuestionText');
    const ansEl = document.getElementById('modalAnswer') || document.getElementById('modalAnswerText');

    const stt = parseInt(sttEl ? sttEl.value : (questionsList.length + 1), 10) || (questionsList.length + 1);
    const questionText = (qTextEl ? qTextEl.value : '').trim();
    const answerText = (ansEl ? ansEl.value : '').trim();

    if (!questionText) {
        showToast("⚠️ Vui lòng nhập nội dung câu hỏi!");
        if (qTextEl) qTextEl.focus();
        return;
    }
    if (!answerText) {
        showToast("⚠️ Vui lòng nhập đáp án!");
        if (ansEl) ansEl.focus();
        return;
    }

    let itemType = modalMediaData.mode;
    if (itemType === 'slideshow') itemType = 'slides';

    let mediaUrl = '';
    let mediaName = '';
    let images = [];

    if (itemType === 'image') {
        mediaUrl = modalMediaData.imageUrl;
        mediaName = modalMediaData.imageName;
    } else if (itemType === 'video') {
        mediaUrl = modalMediaData.videoUrl;
        mediaName = modalMediaData.videoName;
    } else if (itemType === 'audio') {
        mediaUrl = modalMediaData.audioUrl;
        mediaName = modalMediaData.audioName;
    } else if (itemType === 'slides') {
        images = JSON.parse(JSON.stringify(modalMediaData.slides));
    }

    const editIdx = modalMediaData.editIndex;

    const newQ = {
        stt: stt,
        type: itemType,
        question: questionText,
        answer: answerText,
        mediaUrl: mediaUrl,
        mediaName: mediaName,
        images: images,
        totalDuration: 20
    };

    let targetIndex = editIdx;

    if (editIdx >= 0 && editIdx < questionsList.length) {
        questionsList[editIdx] = newQ;
        showToast(`✅ Đã cập nhật Câu ${stt}!`);
    } else {
        questionsList.push(newQ);
        targetIndex = questionsList.length - 1;
        showToast(`✅ Đã thêm Câu ${stt}!`);
    }

    saveAndBroadcastQuestions();
    closeQuestionModal();
    renderDatabaseTable();
    renderQuestion();

    if (showOnProjector && targetIndex >= 0) {
        currentQuestionIndex = targetIndex;
        gameState.currentQuestionIndex = currentQuestionIndex;
        showCurrentQuestionMedia();
    }
}

/* =====================================================
   EXCEL / CSV / JSON IMPORT & EXPORT
===================================================== */
function handleExcelUpload(eOrFile) {
    let file = null;
    if (eOrFile && eOrFile.target && eOrFile.target.files) {
        file = eOrFile.target.files[0];
    } else if (eOrFile instanceof File) {
        file = eOrFile;
    } else if (eOrFile && eOrFile.files) {
        file = eOrFile.files[0];
    } else if (eOrFile && eOrFile[0]) {
        file = eOrFile[0];
    }

    if (!file) {
        showToast("⚠️ Vui lòng chọn một file Excel (.xlsx, .xls) hoặc CSV!");
        return;
    }

    const fileName = file.name.toLowerCase();

    // Reset input value so re-uploading same file triggers change event
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) fileInput.value = '';

    if (fileName.endsWith('.json')) {
        importQuestionsJSON(file);
        return;
    }

    showToast("⏳ Đang nạp dữ liệu từ file " + file.name + "...");

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
                if (typeof XLSX === 'undefined') {
                    showToast("⚠️ Thư viện XLSX chưa sẵn sàng. Vui lòng thử lại sau giây lát!");
                    return;
                }
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                parseRawRows(jsonRows);
            } catch (err) {
                showToast("⚠️ Lỗi phân tích file Excel: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function isMediaUrl(str) {
    if (!str) return false;
    const s = String(str).trim().toLowerCase();
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('/uploads/')) {
        return true;
    }
    if (s.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mp3|wav|ogg|avi|mov)$/i)) {
        return true;
    }
    return false;
}

function parseRawRows(rows) {
    if (!rows || rows.length === 0) {
        showToast("⚠️ File không chứa dữ liệu!");
        return;
    }

    let parsedQuestions = [];
    let startRow = 0;

    // Detect Header Row & Mapping in first 5 rows
    let colMap = { stt: -1, question: -1, answer: -1, media: -1, type: -1 };
    let hasHeader = false;

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
        const rowArr = rows[r];
        if (!rowArr || rowArr.length < 2) continue;
        const rowStr = rowArr.map(c => String(c || '').toLowerCase()).join(' ');

        if (rowStr.includes('câu') || rowStr.includes('question') || rowStr.includes('đáp án') || rowStr.includes('answer') || rowStr.includes('stt') || rowStr.includes('nội dung')) {
            hasHeader = true;
            startRow = r + 1;

            rowArr.forEach((cell, colIdx) => {
                const cText = String(cell || '').toLowerCase().trim();
                if (cText.includes('stt') || cText.includes('câu số') || cText === 'no' || cText === 'num' || cText === '#') {
                    colMap.stt = colIdx;
                } else if (cText.includes('câu hỏi') || cText.includes('question') || cText.includes('nội dung') || cText === 'q' || cText.includes('đề bài')) {
                    colMap.question = colIdx;
                } else if (cText.includes('đáp án') || cText.includes('answer') || cText.includes('kết quả') || cText === 'a' || cText === 'ans' || cText.includes('trả lời')) {
                    colMap.answer = colIdx;
                } else if (cText.includes('link') || cText.includes('media') || cText.includes('url') || cText.includes('ảnh') || cText.includes('video') || cText.includes('audio')) {
                    colMap.media = colIdx;
                } else if (cText.includes('loại') || cText.includes('type') || cText.includes('định dạng') || cText.includes('format')) {
                    colMap.type = colIdx;
                }
            });
            break;
        }
    }

    // Process Data Rows
    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const cleanedRow = row.map(c => (c !== undefined && c !== null) ? String(c).trim() : '');
        
        // Skip empty row
        if (cleanedRow.every(c => c === '')) continue;

        let stt = 0;
        let qText = '';
        let aText = '';
        let mUrl = '';
        let mType = 'text';

        if (hasHeader && colMap.question >= 0) {
            if (colMap.stt >= 0 && cleanedRow[colMap.stt]) {
                const pStt = parseInt(cleanedRow[colMap.stt], 10);
                if (!isNaN(pStt)) stt = pStt;
            }
            if (colMap.question >= 0) qText = cleanedRow[colMap.question] || '';
            if (colMap.answer >= 0) aText = cleanedRow[colMap.answer] || '';
            if (colMap.media >= 0) mUrl = cleanedRow[colMap.media] || '';
            if (colMap.type >= 0) mType = cleanedRow[colMap.type] || 'text';
        } else {
            // Position-based heuristic
            const firstNum = parseInt(cleanedRow[0], 10);
            if (!isNaN(firstNum) && String(firstNum) === cleanedRow[0]) {
                stt = firstNum;
                qText = cleanedRow[1] || '';
                aText = cleanedRow[2] || '';
                if (cleanedRow[3]) mUrl = cleanedRow[3];
                if (cleanedRow[4]) mType = cleanedRow[4];
            } else {
                qText = cleanedRow[0] || '';
                aText = cleanedRow[1] || '';
                if (cleanedRow[2]) mUrl = cleanedRow[2];
                if (cleanedRow[3]) mType = cleanedRow[3];
            }
        }

        // SMART RECOVERY FOR SHIFTED ANSWERS:
        // If aText is empty (e.g. cell placed in Col D/E as in row 21, 24, 25, 28, 30 of Excel screenshot)
        if (!aText) {
            for (let c = 0; c < cleanedRow.length; c++) {
                const val = cleanedRow[c];
                if (!val) continue;
                if (c === colMap.stt || c === colMap.question) continue;
                if (stt > 0 && String(stt) === val) continue;
                if (val === qText) continue;

                if (isMediaUrl(val)) {
                    if (!mUrl) mUrl = val;
                } else {
                    aText = val;
                    break;
                }
            }
        }

        // Auto-detect media type if mUrl is present
        if (mUrl) {
            const urlLower = mUrl.toLowerCase();
            if (urlLower.match(/\.(mp4|webm|avi|mov)$/i) || urlLower.includes('streamable.com') || urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
                mType = 'video';
            } else if (urlLower.match(/\.(mp3|wav|ogg|aac|m4a)$/i)) {
                mType = 'audio';
            } else if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) || urlLower.startsWith('data:image')) {
                mType = 'image';
            } else if (!mType || mType === 'text') {
                mType = 'image';
            }
        }

        if (!stt) {
            stt = parsedQuestions.length + 1;
        }

        if (qText) {
            parsedQuestions.push({
                stt: stt,
                type: (mType || 'text').toLowerCase(),
                question: qText,
                answer: aText || '(Chưa có đáp án)',
                mediaUrl: mUrl,
                mediaName: mUrl ? 'File đính kèm' : ''
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
