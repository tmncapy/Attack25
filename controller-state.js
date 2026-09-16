/**
 * ATTACK 25 - CONTROLLER STATE, SYNC & AUDIO ENGINE
 * Handles: Global state, localStorage, WebSocket sync, audio broadcasting, room management, volume controls
 */

/* =====================================================
   SYNTHESIZER SOUND ENGINE (STUB FOR CONTROLLER)
===================================================== */
function getAudioCtx() {
    return null;
}

function getAudioContext() {
    return null;
}

function stopAllSounds() {
    if (window.activeAudios && Array.isArray(window.activeAudios)) {
        window.activeAudios.forEach(audio => {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (e) {}
        });
        window.activeAudios = [];
    }
}

function playSound(type) {
    // Không phát bất kỳ âm thanh hay nhạc nào trên Controller (chỉ phát trên Projector)
    return;
}

function playSynthTone(type) {
    // Không phát bất kỳ âm thanh hay nhạc nào trên Controller
    return;
}

const colorWavMap = {
    'red': 'red.wav',
    'green': 'green.wav',
    'white': 'white.wav',
    'blue': 'blue.wav',
    'buzzer_red': 'red.wav',
    'buzzer_green': 'green.wav',
    'buzzer_white': 'white.wav',
    'buzzer_blue': 'blue.wav',
    'buzz_red': 'red.wav',
    'buzz_green': 'green.wav',
    'buzz_white': 'white.wav',
    'buzz_blue': 'blue.wav'
};

/* =====================================================
   DEFAULT QUESTION BANK
===================================================== */
const DEFAULT_QUESTIONS = [
    { stt: 1, type: "text", question: "Trong tác phẩm Lão Hạc của Nam Cao, Lão Hạc nuôi con vật gì?", answer: "Con chó" },
    { stt: 2, type: "text", question: "Quần thể chùa Tam Chúc thuộc tỉnh nào của Việt Nam?", answer: "Hà Nam" },
    { stt: 3, type: "text", question: "Khi bị chảy máu cam, máu có màu gì?", answer: "Màu đỏ" },
    { stt: 4, type: "text", question: "Cá mập sinh sản bằng cách đẻ trứng hay đẻ con?", answer: "Đẻ con" },
    { stt: 5, type: "text", question: "Con khỉ đầu chó hay con chó đầu khỉ có thật?", answer: "Khỉ đầu chó" },
    { stt: 6, type: "text", question: "Cầu Mỹ Thuận bắc qua sông Tiền, nối liền hai tỉnh nào?", answer: "Tiền Giang – Vĩnh Long" },
    { stt: 7, type: "text", question: "Biển số xe mang ký hiệu 60 hiện nay thuộc tỉnh nào?", answer: "Đồng Nai" },
    { stt: 8, type: "text", question: "Trong truyện cổ tích Sọ Dừa, Sọ Dừa có bao nhiêu anh em?", answer: "Không có anh em" },
    { stt: 9, type: "text", question: "Nhân vật chính trong tác phẩm Tắt đèn của Ngô Tất Tố là ai?", answer: "Chị Dậu" },
    { stt: 10, type: "text", question: "Trong hệ thập phân của toán học, 30 + 70 – 50 bằng bao nhiêu?", answer: "50" },
    { stt: 11, type: "text", question: "Cột cờ Lũng Cú thuộc tỉnh nào của Việt Nam?", answer: "Hà Giang" },
    { stt: 12, type: "text", question: "Việt Nam đã từng đăng cai tổ chức SEA Games mấy lần?", answer: "2 lần" },
    { stt: 13, type: "text", question: "Nghề mộc sử dụng nguyên liệu chính là gì?", answer: "Gỗ" },
    { stt: 14, type: "text", question: "“Anh Hai là người thích nêm mắm dặm muối nhất” – anh Hai làm nghề gì?", answer: "Đầu bếp" },
    { stt: 15, type: "image", question: "Trong bức tranh dân gian Đông Hồ 'Em bé ôm gà' sau đây, em bé trong tranh là bé trai hay bé gái?", answer: "Bé trai", mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Dong_Ho_folk_painting_-_Be_om_ga.jpg/440px-Dong_Ho_folk_painting_-_Be_om_ga.jpg", mediaName: "dong_ho_em_be_om_ga.jpg" },
    { stt: 16, type: "text", question: "Tên gọi chính thức của Thái Lan là gì?", answer: "Vương quốc Thái Lan" },
    { stt: 17, type: "text", question: "Hoàn chỉnh thành ngữ: “Án binh bất …”", answer: "Động" },
    { stt: 18, type: "text", question: "Trong truyện Ăn khế trả vàng, loài chim nào xuất hiện?", answer: "Chim phượng hoàng" },
    { stt: 19, type: "image", question: "Hãy quan sát hình ảnh lá cờ sau đây và cho biết đây là quốc kỳ của quốc gia nào?", answer: "Canada", mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Flag_of_Canada_%28Pantone%29.svg/512px-Flag_of_Canada_%28Pantone%29.svg.png", mediaName: "quoc_ky_canada.png" },
    { stt: 20, type: "text", question: "Sân vận động Lạch Tray thuộc thành phố nào?", answer: "Hải Phòng" },
    { stt: 21, type: "text", question: "Con sông dài nhất châu Á là sông nào?", answer: "Trường Giang" },
    { stt: 22, type: "text", question: "Vân tay của cặp sinh đôi có hoàn toàn giống nhau không?", answer: "Không" },
    { stt: 23, type: "text", question: "Trong các loài: chim cánh cụt, gấu hải cẩu, cá – loài nào đẻ trứng?", answer: "Chim cánh cụt" },
    { stt: 24, type: "text", question: "Kim la bàn luôn chỉ về hai hướng nào?", answer: "Bắc – Nam" },
    { stt: 25, type: "text", question: "Tắm biển tại nơi có hai dòng hải lưu nóng – lạnh dễ gây hiện tượng gì?", answer: "Chuột rút" },
    { stt: 26, type: "text", question: "Bánh xèo truyền thống làm từ bột gạo hay bột bắp?", answer: "Bột gạo" },
    { stt: 27, type: "video", question: "Hãy quan sát đoạn clip sau đây và cho biết loài cá nhân vật chính trong phim Đi tìm Nemo tên là gì?", answer: "Cá Nemo / Cá hề (Clownfish)", mediaUrl: "https://streamable.com/e/mo9y9", mediaName: "clip_nemo_clownfish.mp4" }
];

let questionsList = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
let currentQuestionIndex = 0;

// Load questions from localStorage if saved
try {
    const savedQ = localStorage.getItem("attack25_questions");
    if (savedQ) {
        const parsed = JSON.parse(savedQ);
        if (Array.isArray(parsed) && parsed.length > 0) {
            questionsList = parsed.map((item, idx) => ({
                stt: item.stt || (idx + 1),
                type: item.type || (item.mediaUrl ? (item.mediaUrl.match(/\.(mp4|webm)|streamable|youtube/i) ? 'video' : 'image') : 'text'),
                question: item.question || '',
                answer: item.answer || '',
                mediaUrl: item.mediaUrl || '',
                mediaName: item.mediaName || ''
            }));
        }
    }
} catch (e) {}

/* =====================================================
   GAME STATE
===================================================== */
const defaultState = {
    currentQuestionIndex: 0,
    selectedPanel: null,
    panels: Array.from({ length: 25 }, (_, index) => ({
        number: index + 1,
        used: false,
        color: null
    })),
    players: {
        red: { name: "PLAYER 1", score: 0 },
        green: { name: "PLAYER 2", score: 0 },
        white: { name: "PLAYER 3", score: 0 },
        blue: { name: "PLAYER 4", score: 0 }
    },
    buzzer: {
        status: 'locked',
        winner: null,
        buzzTime: null,
        pressOrder: [],
        lockedPlayers: []
    },
    video: {
        mode: 'local_video',
        url: '',
        embedUrl: '',
        videoName: '',
        images: [],
        totalDuration: 20,
        visible: false,
        playing: false,
        startTime: null,
        playToken: null,
        loop: true,
        currentImageIndex: 0
    },
    questionMedia: {
        visible: false,
        type: 'none',
        url: '',
        images: [],
        totalDuration: 20,
        questionText: '',
        questionStt: 1,
        answer: '',
        playing: true,
        playToken: 0
    },
    hiddenColors: {
        red: false,
        green: false,
        white: false,
        blue: false
    },
    soundVolume: 100
};

function ensureValidPanels(state) {
    if (!state) return;
    if (state.soundVolume === undefined) {
        state.soundVolume = 100;
    }
    if (!state.video) {
        state.video = {
            mode: 'local_video',
            url: '',
            embedUrl: '',
            videoName: '',
            images: [],
            totalDuration: 20,
            visible: false,
            playing: false,
            startTime: null,
            playToken: null,
            loop: true,
            currentImageIndex: 0
        };
    } else {
        if (!state.video.mode) state.video.mode = 'local_video';
        if (!Array.isArray(state.video.images)) state.video.images = [];
        if (state.video.totalDuration === undefined) state.video.totalDuration = 20;
        if (state.video.loop === undefined) state.video.loop = true;
    }
    if (!state.questionMedia) {
        state.questionMedia = {
            visible: false,
            type: 'none',
            url: '',
            images: [],
            totalDuration: 20,
            questionText: '',
            questionStt: 1,
            answer: '',
            playing: true,
            playToken: 0
        };
    } else {
        if (!Array.isArray(state.questionMedia.images)) state.questionMedia.images = [];
        if (state.questionMedia.totalDuration === undefined) state.questionMedia.totalDuration = 20;
    }
    if (!state.hiddenColors) {
        state.hiddenColors = { red: false, green: false, white: false, blue: false };
    }
    if (!state.panels || !Array.isArray(state.panels) || state.panels.length !== 25) {
        state.panels = Array.from({ length: 25 }, (_, index) => ({
            number: index + 1,
            used: false,
            color: null
        }));
    } else {
        state.panels.forEach((p, idx) => {
            if (!p || typeof p !== 'object') {
                state.panels[idx] = { number: idx + 1, used: false, color: null };
            } else {
                p.number = parseInt(p.number, 10) || (idx + 1);
            }
        });
    }
}

let gameState = JSON.parse(JSON.stringify(defaultState));

// Restore state from localStorage
try {
    const saved = localStorage.getItem("attack25_gamestate");
    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.players && parsed.panels) {
            gameState = Object.assign(defaultState, parsed);
        }
    }
} catch (e) {}

ensureValidPanels(gameState);

/* =====================================================
   BROADCAST & REAL-TIME SYNC
===================================================== */
function broadcastState(action = "update", soundEvent = null) {
    ensureValidPanels(gameState);
    if (window.Attack25Sync) {
        Attack25Sync.broadcastState(gameState, action, soundEvent);
    }
}

function broadcastQuestions() {
    if (window.Attack25Sync) {
        Attack25Sync.broadcastQuestions(questionsList);
    }
}

if (window.Attack25Sync) {
    Attack25Sync.onStateChange((state) => {
        if (state) {
            ensureValidPanels(state);
            gameState = state;
            if (state.currentQuestionIndex !== undefined) {
                currentQuestionIndex = state.currentQuestionIndex;
            }
            if (typeof renderAll === 'function') renderAll();
        }
    });

    Attack25Sync.onQuestionsChange((questions) => {
        if (questions && questions.length > 0) {
            questionsList = questions;
            if (typeof renderQuestion === 'function') renderQuestion();
            if (typeof renderDatabaseTable === 'function') renderDatabaseTable();
        }
    });

    Attack25Sync.onConnectionChange((conn) => {
        const dot = document.getElementById("connectionDot");
        const text = document.getElementById("connectionText");
        const isOnline = typeof conn === 'object' ? conn.connected : !!conn;

        if (dot) dot.style.background = isOnline ? '#2fb344' : '#e03131';
        if (text) {
            if (isOnline) {
                text.textContent = 'WS REAL-TIME';
                text.title = `WebSocket kết nối tại: ${conn.url || 'localhost:3000'}`;
            } else {
                text.textContent = 'ĐANG KẾT NỐI WS...';
                text.title = 'Nhấp để cấu hình địa chỉ máy chủ WebSocket';
            }
        }
    });

    const connBox = document.getElementById("connectionBox");
    if (connBox) {
        connBox.style.cursor = 'pointer';
        connBox.onclick = () => {
            const current = localStorage.getItem('attack25_ws_server_host') || window.location.host || 'localhost:3000';
            showPrompt("Nhập địa chỉ máy chủ WebSocket (IP:PORT ví dụ: 192.168.1.10:3000 hoặc localhost:3000):", current, (server) => {
                if (server !== null && server !== undefined) {
                    Attack25Sync.setServerHost(server.trim());
                    showToast(`Đang kết nối lại tới máy chủ: ${server.trim() || 'Mặc định'}`);
                }
            });
        };
    }
}

/* =====================================================
   HELPERS & PROMPTS & UTILITIES
==================================================== */
function showToast(msg) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function showPrompt(title, defaultValue, onConfirm) {
    let overlay = document.getElementById('customPromptModal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'customPromptModal';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:inherit;';
        overlay.innerHTML = `
            <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;max-width:480px;width:90%;color:#fff;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
                <div id="customPromptTitle" style="font-size:15px;font-weight:bold;margin-bottom:12px;line-height:1.4;color:#f8fafc;"></div>
                <input type="text" id="customPromptInput" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:#fff;font-size:14px;margin-bottom:20px;box-sizing:border-box;outline:none;" />
                <div style="display:flex;justify-content:flex-end;gap:10px;">
                    <button id="customPromptCancel" style="padding:8px 16px;border-radius:6px;border:1px solid #475569;background:#334155;color:#fff;cursor:pointer;font-weight:bold;">Hủy</button>
                    <button id="customPromptOk" style="padding:8px 16px;border-radius:6px;border:none;background:#2563eb;color:#fff;cursor:pointer;font-weight:bold;">Xác nhận</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    const titleEl = overlay.querySelector('#customPromptTitle');
    const inputEl = overlay.querySelector('#customPromptInput');
    const okBtn = overlay.querySelector('#customPromptOk');
    const cancelBtn = overlay.querySelector('#customPromptCancel');

    titleEl.textContent = title;
    inputEl.value = defaultValue || '';
    overlay.style.display = 'flex';
    setTimeout(() => inputEl.focus(), 50);

    const close = () => {
        overlay.style.display = 'none';
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        inputEl.onkeydown = null;
    };

    okBtn.onclick = () => {
        const val = inputEl.value;
        close();
        if (onConfirm) onConfirm(val);
    };

    cancelBtn.onclick = () => {
        close();
    };

    inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            okBtn.click();
        } else if (e.key === 'Escape') {
            cancelBtn.click();
        }
    };
}

function capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function parseStreamableUrl(input) {
    if (!input || !input.trim()) return '';
    const str = input.trim();
    const match = str.match(/streamable\.com\/(?:e\/)?([a-zA-Z0-9]+)/i);
    if (match && match[1]) {
        return `https://streamable.com/e/${match[1]}`;
    }
    if (/^[a-zA-Z0-9]+$/.test(str)) {
        return `https://streamable.com/e/${str}`;
    }
    const srcMatch = str.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
        return parseStreamableUrl(srcMatch[1]);
    }
    return str;
}

function parseYouTubeEmbedUrl(url) {
    if (!url) return '';
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
        return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
    }
    return url;
}

async function uploadMediaFileToServer(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const dataUrl = e.target.result;
            try {
                const res = await fetch('/api/upload-media', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: file.name,
                        dataUrl: dataUrl
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.url) {
                        resolve({ url: data.url, name: file.name, dataUrl });
                        return;
                    }
                }
            } catch (err) {
                console.warn("Upload to server failed, using local dataUrl:", err);
            }
            resolve({ url: dataUrl, name: file.name, dataUrl });
        };
        reader.readAsDataURL(file);
    });
}

/* =====================================================
   ROOM MANAGEMENT & QUICK NAV
===================================================== */
function generateRandomRoomInfo() {
    const randomRoomId = Math.floor(100000 + Math.random() * 900000).toString();
    const randomPass = () => Math.floor(1000 + Math.random() * 9000).toString();

    document.getElementById('ctrlRoomId').value = randomRoomId;
    document.getElementById('ctrlPassHost').value = randomPass();
    document.getElementById('ctrlPassRed').value = randomPass();
    document.getElementById('ctrlPassGreen').value = randomPass();
    document.getElementById('ctrlPassWhite').value = randomPass();
    document.getElementById('ctrlPassBlue').value = randomPass();

    activateRoomFromController();
}

async function activateRoomFromController() {
    const roomIdEl = document.getElementById('ctrlRoomId');
    if (!roomIdEl) return;
    const roomId = roomIdEl.value.trim();
    const passwords = {
        host: document.getElementById('ctrlPassHost')?.value.trim() || '1234',
        red: document.getElementById('ctrlPassRed')?.value.trim() || '1111',
        green: document.getElementById('ctrlPassGreen')?.value.trim() || '2222',
        white: document.getElementById('ctrlPassWhite')?.value.trim() || '3333',
        blue: document.getElementById('ctrlPassBlue')?.value.trim() || '4444'
    };

    if (roomId.length !== 6 || !/^\d{6}$/.test(roomId)) {
        showToast('⚠️ Mã phòng phải gồm 6 chữ số!');
        return;
    }

    for (let key in passwords) {
        if (passwords[key].length !== 4 || !/^\d{4}$/.test(passwords[key])) {
            showToast('⚠️ Mật khẩu phải gồm 4 chữ số!');
            return;
        }
    }

    try {
        localStorage.setItem('attack25_active_roomid', roomId);
        localStorage.setItem('attack25_active_pass_host', passwords.host);
    } catch (e) {}

    if (window.Attack25Sync) {
        Attack25Sync.setRoomId(roomId, passwords.host);
    }
    const badge = document.getElementById('ctrlActiveRoomBadge');
    if (badge) badge.textContent = 'PHÒNG: ' + roomId;
    const pill = document.getElementById('controllerRoomPill');
    if (pill) pill.textContent = 'PHÒNG: ' + roomId;

    updateQuickNavLinks(roomId, passwords);

    try {
        const res = await fetch('/api/create-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, passwords })
        });
        const data = await res.json();
        if (data && data.success) {
            showToast(`✅ Đã kích hoạt phòng ${roomId}!`);
        } else {
            showToast(`✅ Phòng ${roomId} đang hoạt động`);
        }
    } catch (e) {
        showToast(`✅ Phòng ${roomId} sẵn sàng`);
    }
}

function updateQuickNavLinks(roomId, passwords) {
    const navHost = document.getElementById('navLinkHost');
    const navP1 = document.getElementById('navLinkP1');
    const navP2 = document.getElementById('navLinkP2');
    const navP3 = document.getElementById('navLinkP3');
    const navP4 = document.getElementById('navLinkP4');
    const navProj = document.getElementById('navLinkProj');
    const topProj = document.getElementById('topbarProjectorLink');
    const prevProj = document.getElementById('previewOpenProjectorBtn');
    const projPreview = document.getElementById('projectorPreviewIframe');

    if (navHost) navHost.href = `/Host.html?roomid=${roomId}&auth=${passwords.host}`;
    if (navP1) navP1.href = `/player1.html?roomid=${roomId}&auth=${passwords.red}`;
    if (navP2) navP2.href = `/player2.html?roomid=${roomId}&auth=${passwords.green}`;
    if (navP3) navP3.href = `/player3.html?roomid=${roomId}&auth=${passwords.white}`;
    if (navP4) navP4.href = `/player4.html?roomid=${roomId}&auth=${passwords.blue}`;
    if (navProj) navProj.href = `/Projector.html?roomid=${roomId}`;
    if (topProj) topProj.href = `/Projector.html?roomid=${roomId}`;
    if (prevProj) prevProj.href = `/Projector.html?roomid=${roomId}`;
    if (projPreview) projPreview.src = `/Projector.html?roomid=${roomId}&preview=1`;
}

function getActiveDomain() {
    let domain = window.location.origin;
    const customDomainEl = document.getElementById('ctrlCustomDomain');
    if (customDomainEl && customDomainEl.value.trim()) {
        domain = customDomainEl.value.trim().replace(/\/+$/, '');
        if (!/^https?:\/\//i.test(domain)) {
            domain = 'https://' + domain;
        }
    }
    return domain;
}

function getRoleLink(role) {
    const origin = getActiveDomain();
    const roomId = document.getElementById('ctrlRoomId')?.value.trim() || '123456';
    const passHost = document.getElementById('ctrlPassHost')?.value.trim() || '1234';
    const passRed = document.getElementById('ctrlPassRed')?.value.trim() || '1111';
    const passGreen = document.getElementById('ctrlPassGreen')?.value.trim() || '2222';
    const passWhite = document.getElementById('ctrlPassWhite')?.value.trim() || '3333';
    const passBlue = document.getElementById('ctrlPassBlue')?.value.trim() || '4444';

    switch (role) {
        case 'host':
            return `${origin}/Host.html?roomid=${roomId}&auth=${passHost}`;
        case 'p1':
        case 'player1':
        case 'red':
            return `${origin}/player1.html?roomid=${roomId}&auth=${passRed}`;
        case 'p2':
        case 'player2':
        case 'green':
            return `${origin}/player2.html?roomid=${roomId}&auth=${passGreen}`;
        case 'p3':
        case 'player3':
        case 'white':
            return `${origin}/player3.html?roomid=${roomId}&auth=${passWhite}`;
        case 'p4':
        case 'player4':
        case 'blue':
            return `${origin}/player4.html?roomid=${roomId}&auth=${passBlue}`;
        case 'projector':
        case 'proj':
            return `${origin}/Projector.html?roomid=${roomId}`;
        case 'controller':
            return `${origin}/Controller.html?roomid=${roomId}&auth=${passHost}`;
        default:
            return `${origin}/?roomid=${roomId}`;
    }
}

function copyRoleLink(role) {
    const link = getRoleLink(role);
    const roleLabels = {
        host: 'Host (MC)',
        p1: 'Player 1 (Đỏ)',
        player1: 'Player 1 (Đỏ)',
        red: 'Player 1 (Đỏ)',
        p2: 'Player 2 (Xanh Lá)',
        player2: 'Player 2 (Xanh Lá)',
        green: 'Player 2 (Xanh Lá)',
        p3: 'Player 3 (Trắng)',
        player3: 'Player 3 (Trắng)',
        white: 'Player 3 (Trắng)',
        p4: 'Player 4 (Xanh Dương)',
        player4: 'Player 4 (Xanh Dương)',
        blue: 'Player 4 (Xanh Dương)',
        projector: 'Màn hình Projector'
    };
    const label = roleLabels[role] || role;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {
            showToast(`📋 Đã chép link ${label}!\n${link}`);
        }).catch(() => {
            showPrompt(`Link tham gia ${label}:`, link, () => {
                showToast(`📋 Đã sao chép link ${label}!`);
            });
        });
    } else {
        showPrompt(`Link tham gia ${label}:`, link, () => {
            showToast(`📋 Đã sao chép link ${label}!`);
        });
    }
}

function copyAllRoleLinks() {
    const origin = getActiveDomain();
    const roomId = document.getElementById('ctrlRoomId')?.value.trim() || '123456';
    const passHost = document.getElementById('ctrlPassHost')?.value.trim() || '1234';
    const passRed = document.getElementById('ctrlPassRed')?.value.trim() || '1111';
    const passGreen = document.getElementById('ctrlPassGreen')?.value.trim() || '2222';
    const passWhite = document.getElementById('ctrlPassWhite')?.value.trim() || '3333';
    const passBlue = document.getElementById('ctrlPassBlue')?.value.trim() || '4444';

    const text = `🎮 LINK THAM GIA PANEL QUIZ ATTACK 25 (PHÒNG: ${roomId})\n` +
        `----------------------------------------\n` +
        `🎤 Host (MC): ${origin}/Host.html?roomid=${roomId}&auth=${passHost}\n` +
        `🔴 Player 1 (Đỏ): ${origin}/player1.html?roomid=${roomId}&auth=${passRed}\n` +
        `🟢 Player 2 (Xanh Lá): ${origin}/player2.html?roomid=${roomId}&auth=${passGreen}\n` +
        `⚪ Player 3 (Trắng): ${origin}/player3.html?roomid=${roomId}&auth=${passWhite}\n` +
        `🔵 Player 4 (Xanh Dương): ${origin}/player4.html?roomid=${roomId}&auth=${passBlue}\n` +
        `🖥️ Projector: ${origin}/Projector.html?roomid=${roomId}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`📋 Đã sao chép toàn bộ link tham gia phòng ${roomId}!`);
        }).catch(() => {
            showPrompt('Toàn bộ link tham gia:', text, () => {
                showToast('📋 Đã sao chép!');
            });
        });
    } else {
        showPrompt('Toàn bộ link tham gia:', text, () => {
            showToast('📋 Đã sao chép!');
        });
    }
}

function onRolePassChange() {
    const roomId = document.getElementById('ctrlRoomId')?.value.trim() || '123456';
    const passwords = {
        host: document.getElementById('ctrlPassHost')?.value.trim() || '1234',
        red: document.getElementById('ctrlPassRed')?.value.trim() || '1111',
        green: document.getElementById('ctrlPassGreen')?.value.trim() || '2222',
        white: document.getElementById('ctrlPassWhite')?.value.trim() || '3333',
        blue: document.getElementById('ctrlPassBlue')?.value.trim() || '4444'
    };
    updateQuickNavLinks(roomId, passwords);
}

function copyRoomInfoToClipboard() {
    const roomId = document.getElementById('ctrlRoomId')?.value.trim() || '';
    const h = document.getElementById('ctrlPassHost')?.value.trim() || '';
    const p1 = document.getElementById('ctrlPassRed')?.value.trim() || '';
    const p2 = document.getElementById('ctrlPassGreen')?.value.trim() || '';
    const p3 = document.getElementById('ctrlPassWhite')?.value.trim() || '';
    const p4 = document.getElementById('ctrlPassBlue')?.value.trim() || '';

    const info = `🎮 ATTACK 25 - PHÒNG CHƠI: ${roomId}\nHost: ${h}\nPlayer 1 (Đỏ): ${p1}\nPlayer 2 (Xanh): ${p2}\nPlayer 3 (Trắng): ${p3}\nPlayer 4 (Lam): ${p4}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(info).then(() => {
            showToast('📋 Đã sao chép thông tin phòng!');
        }).catch(() => {
            showToast('⚠️ Không thể sao chép tự động!');
        });
    } else {
        showToast('📋 Đã sao chép thông tin phòng!');
    }
}

/* =====================================================
   SOUNDBOARD & VOLUME LOGIC
===================================================== */
let localSfxDataUrl = null;

function handleLocalSfxSelected(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('localSfxStatus').textContent = `⏳ Đang đọc file: ${file.name}...`;
        const reader = new FileReader();
        reader.onload = function(e) {
            localSfxDataUrl = e.target.result;
            document.getElementById('localSfxStatus').textContent = `📂 ${file.name}`;
            
            const btnPlay = document.getElementById('btnPlayLocalSfx');
            const btnStop = document.getElementById('btnStopLocalSfx');
            if (btnPlay) {
                btnPlay.disabled = false;
                btnPlay.style.opacity = "1";
            }
            if (btnStop) {
                btnStop.disabled = false;
                btnStop.style.opacity = "1";
            }
            showToast(`✅ Đã nạp file "${file.name}"`);
        };
        reader.onerror = function() {
            document.getElementById('localSfxStatus').textContent = `⚠️ Lỗi nạp file!`;
            showToast("⚠️ Không thể đọc file âm thanh!");
        };
        reader.readAsDataURL(file);
    }
}

function playLocalSfx() {
    if (localSfxDataUrl) {
        if (window.Attack25Sync && typeof Attack25Sync.broadcastSound === 'function') {
            Attack25Sync.broadcastSound(localSfxDataUrl);
        } else {
            broadcastState("playSound", localSfxDataUrl);
        }
        showToast("▶️ Đang phát SFX trên Projector");
    } else {
        showToast("⚠️ Vui lòng chọn file âm thanh trước!");
    }
}

function stopLocalSfx() {
    if (window.Attack25Sync && typeof Attack25Sync.broadcastSound === 'function') {
        Attack25Sync.broadcastSound('stop');
    } else {
        broadcastState("playSound", 'stop');
    }
    showToast("⏹️ Đã dừng âm thanh trên Projector");
}

function triggerBroadcastSound(soundPath) {
    if (window.Attack25Sync && typeof Attack25Sync.broadcastSound === 'function') {
        Attack25Sync.broadcastSound(soundPath);
    } else {
        broadcastState("playSound", soundPath);
    }
    if (soundPath === 'stop') {
        showToast("⏹️ Đã gửi lệnh dừng âm thanh sang Projector");
    } else {
        showToast("🎵 Đã gửi lệnh phát âm thanh sang Projector");
    }
}

let previousSoundboardVolume = 100;

function updateSoundboardVolumeUI(val) {
    const num = Math.max(0, Math.min(100, Number(val !== undefined ? val : 100)));
    const slider = document.getElementById("soundboardVolumeSlider");
    const percentEl = document.getElementById("sfxVolPercent");
    const iconEl = document.getElementById("sfxVolIcon");
    const btnMute = document.getElementById("btnToggleMuteSfx");

    if (slider && Number(slider.value) !== num) {
        slider.value = num;
    }
    if (percentEl) {
        percentEl.textContent = `${num}%`;
    }
    if (iconEl) {
        if (num === 0) iconEl.textContent = "🔇";
        else if (num < 40) iconEl.textContent = "🔈";
        else if (num < 75) iconEl.textContent = "🔉";
        else iconEl.textContent = "🔊";
    }
    if (btnMute) {
        btnMute.textContent = num === 0 ? "🔊 Unmute" : "🔇 Mute";
    }
}

function onSoundboardVolumeInput(val) {
    const num = Math.max(0, Math.min(100, Number(val)));
    updateSoundboardVolumeUI(num);
    gameState.soundVolume = num;

    if (window.Attack25Sync && typeof Attack25Sync.broadcastSound === 'function') {
        Attack25Sync.broadcastSound('volume:' + (num / 100));
    }
}

function onSoundboardVolumeChange(val) {
    const num = Math.max(0, Math.min(100, Number(val)));
    gameState.soundVolume = num;
    try {
        localStorage.setItem("attack25_sound_volume", String(num));
    } catch (e) {}

    broadcastState("changeVolume");
    showToast(`🔊 Âm lượng Soundboard: ${num}%`);
}

function setSoundboardVolume(val) {
    const num = Math.max(0, Math.min(100, Number(val)));
    onSoundboardVolumeInput(num);
    onSoundboardVolumeChange(num);
}

function toggleMuteSoundboard() {
    const current = Number(gameState.soundVolume !== undefined ? gameState.soundVolume : 100);
    if (current > 0) {
        previousSoundboardVolume = current;
        setSoundboardVolume(0);
    } else {
        const restore = previousSoundboardVolume > 0 ? previousSoundboardVolume : 100;
        setSoundboardVolume(restore);
    }
}
