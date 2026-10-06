/* =========================================================
   ATTACK 25 - UNIVERSAL REAL-TIME SYNC CLIENT (ROOM SCOPED)
   High-Availability Multi-Tier Sync: WebSocket Auto-Probing +
   BroadcastChannel + LocalStorage Event Pulse + HTTP Polling Fallback
   ========================================================= */

(function () {
    "use strict";

    const CHANNEL_BASE = "attack25-sync-v3";

    const KEY_STATE_PREFIX = "attack25_gamestate_";
    const KEY_QUESTIONS_PREFIX = "attack25_questions_";
    const KEY_HOST = "attack25_ws_server_host";

    const urlParams = new URLSearchParams(window.location.search);
    let currentRoomId = urlParams.get('roomid') || urlParams.get('roomId') || urlParams.get('room') || '';
    if (!currentRoomId) {
        try { currentRoomId = localStorage.getItem('attack25_active_roomid') || '123456'; } catch (e) { currentRoomId = '123456'; }
    }
    let currentAuth = urlParams.get('auth') || '';
    if (!currentAuth) {
        try { currentAuth = localStorage.getItem('attack25_active_auth') || ''; } catch (e) { currentAuth = ''; }
    }

    // Support ?server=... or ?host=... or ?ws=... in URL for auto-configuring player/host devices
    const urlServerParam = urlParams.get('server') || urlParams.get('host') || urlParams.get('ws') || urlParams.get('wshost');

    const instanceId =
        (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : "attack25_" +
              Date.now() +
              "_" +
              Math.random().toString(36).slice(2);

    let ws = null;
    let reconnectTimer = null;
    let reconnecting = false;
    let activeWsUrl = "";
    let pollInterval = null;

    let manualHost = "";
    try {
        if (urlServerParam) {
            manualHost = normalizeHost(urlServerParam);
            localStorage.setItem(KEY_HOST, manualHost);
        } else if (!window.location.protocol.startsWith("http")) {
            manualHost = localStorage.getItem(KEY_HOST) || "";
        }
    } catch (e) {
        manualHost = "";
    }

    const stateHandlers = [];
    const questionHandlers = [];
    const soundHandlers = [];
    const connectionHandlers = [];
    const buzzHandlers = [];
    const buzzAttemptHandlers = [];

    /* =========================================================
       BROADCAST CHANNEL (SAME-DEVICE PEER SYNC)
       ========================================================= */
    let broadcastChannel = null;

    function initBroadcastChannel() {
        if ("BroadcastChannel" in window) {
            if (broadcastChannel) {
                try { broadcastChannel.close(); } catch (e) {}
            }
            try {
                broadcastChannel = new BroadcastChannel(CHANNEL_BASE + "_" + currentRoomId);
                broadcastChannel.onmessage = function (event) {
                    if (event.data) {
                        handleMessage(event.data);
                    }
                };
            } catch (e) {
                console.warn("BroadcastChannel unavailable:", e);
            }
        }
    }

    initBroadcastChannel();

    /* =========================================================
       LOCALSTORAGE PULSE (CROSS-WINDOW / CROSS-TAB SYNC FALLBACK)
       ========================================================= */
    window.addEventListener("storage", function (event) {
        if (!event || !event.key) return;
        if (event.key === "attack25_sync_pulse_" + currentRoomId && event.newValue) {
            try {
                const data = JSON.parse(event.newValue);
                handleMessage(data);
            } catch (e) {}
        }
    });

    /* =========================================================
       HELPERS & EMITTERS
       ========================================================= */
    function emit(handlers, data) {
        handlers.slice().forEach(function (handler) {
            try {
                handler(data);
            } catch (error) {
                console.error("Attack25Sync handler error:", error);
            }
        });
    }

    function emitConnection(connected, url, details) {
        activeWsUrl = connected ? (url || "") : "";
        emit(connectionHandlers, Object.assign({
            connected: !!connected,
            mode: connected ? "websocket" : (pollInterval ? "polling" : "local"),
            url: url || "",
            roomId: currentRoomId,
            serverHost: manualHost || (window.location.protocol !== "file:" ? window.location.host : "localhost:3000")
        }, details || {}));
    }

    function normalizeHost(host) {
        return String(host || "")
            .trim()
            .replace(/^https?:\/\//i, "")
            .replace(/^wss?:\/\//i, "")
            .replace(/\/+$/, "")
            .replace(/\/ws(\?.*)?$/i, "");
    }

    function getAppBasePath() {
        if (typeof window === 'undefined' || !window.location || !window.location.pathname) return '/';
        const pathname = window.location.pathname;
        const lastSlashIndex = pathname.lastIndexOf('/');
        if (lastSlashIndex <= 0) return '/';
        return pathname.substring(0, lastSlashIndex + 1);
    }

    /* =========================================================
       SMART WEBSOCKET URL CANDIDATE GENERATOR & AUTO-PROBING
       ========================================================= */
    let candidateIndex = 0;
    let candidateList = [];

    function buildCandidateList() {
        const candidates = [];
        const isHttps = window.location.protocol === "https:" || (typeof location !== 'undefined' && location.origin && location.origin.startsWith('https'));
        const protocol = isHttps ? "wss:" : "ws:";
        const qAuth = currentAuth ? "&auth=" + encodeURIComponent(currentAuth) : "";
        const query = "?roomid=" + encodeURIComponent(currentRoomId) + qAuth;
        const basePath = getAppBasePath();
        const wsPath = basePath === '/' ? '/ws' : (basePath.endsWith('/') ? basePath + 'ws' : basePath + '/ws');

        // 1. If currently loaded via HTTP/HTTPS, current origin is ALWAYS the primary target
        if (window.location.protocol.startsWith("http")) {
            const curHost = window.location.host;
            const curHostname = window.location.hostname;
            const curPort = window.location.port;

            // Primary: Current host with app base path (/ws or /Attack25/ws)
            const c1 = protocol + "//" + curHost + wsPath + query;
            if (!candidates.includes(c1)) candidates.push(c1);

            // Secondary: Current host at root /ws
            const c2 = protocol + "//" + curHost + "/ws" + query;
            if (!candidates.includes(c2)) candidates.push(c2);

            // Direct port 3000 candidate (e.g. for custom domain/Apache where Node is on 3000)
            if (curPort !== '3000' && curHostname && curHostname !== 'localhost' && !curHostname.includes('run.app')) {
                const cPort = "ws://" + curHostname + ":3000/ws" + query;
                if (!candidates.includes(cPort)) candidates.push(cPort);
                const cPortSecure = "wss://" + curHostname + ":3000/ws" + query;
                if (!candidates.includes(cPortSecure)) candidates.push(cPortSecure);
            }

            // Tertiary: Current host root /
            const c3 = protocol + "//" + curHost + "/" + query;
            if (!candidates.includes(c3)) candidates.push(c3);
        }

        // 2. If explicit server host parameter was passed in URL (?server=...)
        const normManual = normalizeHost(manualHost);
        if (normManual && (!window.location.protocol.startsWith("http") || normManual !== window.location.host)) {
            const m1 = protocol + "//" + normManual + wsPath + query;
            if (!candidates.includes(m1)) candidates.push(m1);
            const m2 = protocol + "//" + normManual + "/ws" + query;
            if (!candidates.includes(m2)) candidates.push(m2);
        }

        // 3. Fallback for file:// or local dev
        if (!window.location.protocol.startsWith("http")) {
            const loc1 = "ws://localhost:3000/ws" + query;
            if (!candidates.includes(loc1)) candidates.push(loc1);
            const loc2 = "ws://127.0.0.1:3000/ws" + query;
            if (!candidates.includes(loc2)) candidates.push(loc2);
        }

        return candidates;
    }

    function getWebSocketUrl() {
        if (!candidateList || candidateList.length === 0 || candidateIndex >= candidateList.length) {
            candidateList = buildCandidateList();
            candidateIndex = 0;
        }
        return candidateList[candidateIndex] || candidateList[0];
    }

    /* =========================================================
       SMART HTTP API CANDIDATES & MULTI-TARGET FETCHER
       ========================================================= */
    let lastWorkingApiBase = null;

    function getApiCandidates(endpoint, queryParams) {
        if (typeof window === 'undefined' || !window.location || !window.location.protocol.startsWith('http')) {
            return [];
        }
        const clean = endpoint.replace(/^\/+/, ''); // e.g. 'api/state'
        const q = queryParams ? (queryParams.startsWith('?') ? queryParams : '?' + queryParams) : '';
        const basePath = getAppBasePath();
        const curHostname = window.location.hostname;
        const curPort = window.location.port;
        const protocol = window.location.protocol;
        const list = [];

        // 1. If we discovered a working base in this session, prioritize it
        if (lastWorkingApiBase) {
            const pref = lastWorkingApiBase + clean + q;
            if (!list.includes(pref)) list.push(pref);
        }

        // 2. Base path with endpoint (e.g. '/Attack25/api/state?roomid=...')
        const b1 = (basePath === '/' ? '/' : basePath) + clean + q;
        if (!list.includes(b1)) list.push(b1);

        // 3. Root with endpoint (e.g. '/api/state?roomid=...')
        const b2 = '/' + clean + q;
        if (!list.includes(b2)) list.push(b2);

        // 4. PHP Fallback endpoints (e.g. '/Attack25/api.php?action=state&roomid=...')
        const phpAction = clean.replace(/^api\//, '');
        const phpSep = q ? '&' : '?';
        const phpQuery = (q || '?') + phpSep + 'action=' + encodeURIComponent(phpAction);
        const php1 = (basePath === '/' ? '/' : basePath) + 'api.php' + phpQuery;
        if (!list.includes(php1)) list.push(php1);
        const php2 = '/api.php' + phpQuery;
        if (!list.includes(php2)) list.push(php2);

        // 5. Short form without 'api/' prefix (e.g. '/Attack25/state', '/state')
        const shortClean = clean.replace(/^api\//, '');
        const b3 = (basePath === '/' ? '/' : basePath) + shortClean + q;
        if (!list.includes(b3)) list.push(b3);
        const b4 = '/' + shortClean + q;
        if (!list.includes(b4)) list.push(b4);

        // 6. Direct port 3000 if not already on 3000
        if (curPort !== '3000' && curHostname && curHostname !== 'localhost' && !curHostname.includes('run.app')) {
            const p1 = `${protocol}//${curHostname}:3000/${clean}${q}`;
            if (!list.includes(p1)) list.push(p1);
            const p2 = `http://${curHostname}:3000/${clean}${q}`;
            if (!list.includes(p2)) list.push(p2);
        }

        return list;
    }

    async function smartFetchApi(endpoint, options, queryParams) {
        const candidates = getApiCandidates(endpoint, queryParams);
        for (const url of candidates) {
            try {
                const res = await fetch(url, options || {});
                if (res && res.ok) {
                    try {
                        const parsed = new URL(url, window.location.href);
                        const cleanEndpoint = endpoint.replace(/^\/+/, '');
                        const idx = parsed.pathname.indexOf(cleanEndpoint);
                        if (idx >= 0) {
                            lastWorkingApiBase = parsed.pathname.substring(0, idx);
                        }
                    } catch (e) {}
                    return await res.json();
                }
            } catch (e) {
                // Silently try next candidate
            }
        }
        return null;
    }

    /* =========================================================
       LOCAL STORAGE PER ROOM & MESSAGE DEDUPLICATION
       ========================================================= */
    const seenMsgIds = new Set();
    const seenMsgOrder = [];
    function isDuplicateMsg(id) {
        if (!id) return false;
        if (seenMsgIds.has(id)) return true;
        seenMsgIds.add(id);
        seenMsgOrder.push(id);
        if (seenMsgOrder.length > 300) {
            const removed = seenMsgOrder.shift();
            seenMsgIds.delete(removed);
        }
        return false;
    }

    function saveStateLocal(state) {
        if (!state) return;
        try {
            localStorage.setItem(KEY_STATE_PREFIX + currentRoomId, JSON.stringify(state));
        } catch (e) {}
    }

    function saveQuestionsLocal(questions) {
        if (!questions) return;
        try {
            localStorage.setItem(KEY_QUESTIONS_PREFIX + currentRoomId, JSON.stringify(questions));
        } catch (e) {}
    }

    /* =========================================================
       MESSAGE DISPATCHER
       ========================================================= */
    function handleMessage(message) {
        if (!message || typeof message !== "object") {
            return;
        }

        // Drop messages belonging to other rooms
        if (message.roomId && message.roomId !== currentRoomId) {
            return;
        }

        if (message.source && message.source === instanceId) {
            return;
        }

        if (message.msgId && isDuplicateMsg(message.msgId)) {
            return;
        }

        const msgType = message.type;

        if (msgType === "state" || msgType === "SYNC_STATE" || msgType === "INIT_STATE") {
            if (message.state !== undefined) {
                saveStateLocal(message.state);
                emit(stateHandlers, message.state);
            }
            if (message.questions !== undefined) {
                saveQuestionsLocal(message.questions);
                emit(questionHandlers, message.questions);
            }
            if (message.sound !== undefined) {
                emit(soundHandlers, message.sound);
            }
        } else if (msgType === "questions" || msgType === "SYNC_QUESTIONS") {
            if (message.questions !== undefined) {
                saveQuestionsLocal(message.questions);
                emit(questionHandlers, message.questions);
            }
        } else if (msgType === "sound") {
            if (message.sound !== undefined) {
                emit(soundHandlers, message.sound);
            }
        } else if (msgType === "buzz" || msgType === "BUZZ" || msgType === "PLAYER_BUZZ" || msgType === "buzzer") {
            const player = message.player || message.color || message.role;
            if (player) {
                emit(buzzHandlers, {
                    player: player,
                    source: message.source,
                    time: message.time || Date.now(),
                    msgId: message.msgId
                });
            }
        } else if (msgType === "buzz_attempt" || msgType === "BUZZ_ATTEMPT") {
            const player = message.player || message.color || message.role;
            if (player) {
                emit(buzzAttemptHandlers, {
                    player: player,
                    source: message.source,
                    time: message.time || Date.now(),
                    msgId: message.msgId
                });
            }
        }
    }

    /* =========================================================
       SEND MESSAGE (TRIPLE-CHANNEL BROADCAST)
       ========================================================= */
    let msgCounter = 0;

    function send(message) {
        if (!message || typeof message !== "object") {
            return false;
        }

        const msgId = message.msgId || (instanceId + "_" + (++msgCounter) + "_" + Date.now());

        const payload = Object.assign(
            {
                channel: CHANNEL_BASE,
                source: instanceId,
                roomId: currentRoomId,
                auth: currentAuth,
                ts: Date.now(),
                msgId: msgId
            },
            message
        );
        payload.msgId = msgId;

        // Deduplicate locally
        isDuplicateMsg(msgId);

        // 1. Channel 1: BroadcastChannel (Instant peer sync for tabs in same browser)
        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage(payload);
            } catch (e) {}
        }

        // 2. Channel 2: LocalStorage Pulse (Instant cross-window / iframe fallback)
        try {
            localStorage.setItem("attack25_sync_pulse_" + currentRoomId, JSON.stringify(payload));
        } catch (e) {}

        // 3. Channel 3: WebSocket
        let sent = false;
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(payload));
                sent = true;
            } catch (e) {
                console.error("WebSocket send failed:", e);
            }
        }

        // 4. Channel 4: HTTP Fallback if WebSocket is not connected
        if (!sent && typeof fetch === 'function' && window.location.protocol.startsWith('http')) {
            smartFetchApi('api/sync-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => {
                if (res && res.state) {
                    handleMessage({ type: 'state', state: res.state, questions: res.questions, roomId: currentRoomId });
                }
            }).catch(() => {});
        }

        return sent;
    }

    /* =========================================================
       WEBSOCKET CONNECTION & AUTO-FAILOVER
       ========================================================= */
    let connTimer = null;

    function connect() {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (connTimer) {
            clearTimeout(connTimer);
            connTimer = null;
        }

        const url = getWebSocketUrl();
        reconnecting = true;

        try {
            ws = new WebSocket(url);
        } catch (error) {
            ws = null;
            emitConnection(false, url, { error: 'Failed to create WebSocket instance' });
            rotateCandidateAndScheduleReconnect(500);
            return;
        }

        // Connection timeout: If candidate fails to open in 2200ms, immediately rotate to next candidate
        connTimer = setTimeout(function () {
            if (ws && ws.readyState === WebSocket.CONNECTING) {
                try {
                    ws.onopen = null;
                    ws.onclose = null;
                    ws.onerror = null;
                    ws.close();
                } catch (e) {}
                ws = null;
                reconnecting = false;
                startPollingFallback();
                emitConnection(false, url, { error: 'Connection attempt timeout' });
                rotateCandidateAndScheduleReconnect(300);
            }
        }, 2200);

        ws.onopen = function () {
            if (connTimer) {
                clearTimeout(connTimer);
                connTimer = null;
            }
            reconnecting = false;
            stopPollingFallback();

            // Extract working host and record it
            try {
                const parsed = new URL(url);
                const workingHost = parsed.host;
                if (workingHost && workingHost !== window.location.host) {
                    manualHost = workingHost;
                    localStorage.setItem(KEY_HOST, workingHost);
                }
            } catch (e) {}

            emitConnection(true, url);

            // Request state for current room on connect
            try {
                ws.send(JSON.stringify({
                    channel: CHANNEL_BASE,
                    source: instanceId,
                    type: 'GET_STATE',
                    roomId: currentRoomId,
                    auth: currentAuth
                }));
            } catch (e) {}
        };

        ws.onmessage = function (event) {
            try {
                const message = JSON.parse(event.data);
                handleMessage(message);
            } catch (error) {}
        };

        ws.onerror = function () {
            // Handled in onclose
        };

        ws.onclose = function () {
            if (connTimer) {
                clearTimeout(connTimer);
                connTimer = null;
            }
            ws = null;
            reconnecting = false;
            startPollingFallback();
            emitConnection(false, url);
            rotateCandidateAndScheduleReconnect(1500);
        };
    }

    function rotateCandidateAndScheduleReconnect(delayMs) {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(function () {
            reconnectTimer = null;
            // Advance to next candidate if multiple exist
            if (candidateList && candidateList.length > 1) {
                candidateIndex = (candidateIndex + 1) % candidateList.length;
            }
            connect();
        }, (typeof delayMs === 'number' ? delayMs : 2000));
    }

    function fetchStateOnce() {
        if (!window.location.protocol.startsWith('http')) return;
        smartFetchApi('api/state', { method: 'GET' }, 'roomid=' + encodeURIComponent(currentRoomId))
            .then(data => {
                if (data && data.state) {
                    handleMessage({ type: 'state', state: data.state, questions: data.questions, roomId: currentRoomId });
                }
            })
            .catch(() => {});
    }

    function startPollingFallback() {
        if (!window.location.protocol.startsWith('http')) return;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        fetchStateOnce();
        if (pollInterval) return;
        pollInterval = setInterval(function() {
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                stopPollingFallback();
                return;
            }
            fetchStateOnce();
        }, 500);
    }

    function stopPollingFallback() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    /* =========================================================
       DIAGNOSTICS & SERVER CONFIG ASSISTANT MODAL
       ========================================================= */
    function showConnectionDiagnostics() {
        let modal = document.getElementById('attack25_diag_modal');
        if (modal) {
            modal.style.display = 'flex';
            return;
        }
        modal = document.createElement('div');
        modal.id = 'attack25_diag_modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;padding:16px;box-sizing:border-box;';
        
        const card = document.createElement('div');
        card.style.cssText = 'background:#181e29;border:2px solid #3b82f6;border-radius:12px;max-width:500px;width:100%;color:#fff;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,0.8);max-height:90vh;overflow-y:auto;';
        
        const isWs = ws && ws.readyState === WebSocket.OPEN;
        const modeText = isWs ? '<span style="color:#22c55e;">🟢 WebSocket Siêu Tốc (Đã kết nối)</span>' : '<span style="color:#eab308;">🟡 HTTP Realtime Fast-Polling (500ms)</span>';
        
        card.innerHTML = `
            <h2 style="margin:0 0 12px;font-size:18px;color:#60a5fa;display:flex;justify-content:space-between;align-items:center;">
                <span>🛠️ Kiểm Tra Kết Nối Mạng</span>
                <span id="close_diag_btn" style="cursor:pointer;font-size:20px;color:#94a3b8;">&times;</span>
            </h2>
            <div style="font-size:13px;line-height:1.6;background:#0f141d;padding:12px;border-radius:8px;border:1px solid #334155;margin-bottom:14px;">
                <div><strong>Phòng hiện tại:</strong> <span style="color:#38bdf8;">${currentRoomId}</span></div>
                <div><strong>Trạng thái:</strong> ${modeText}</div>
                <div><strong>Base URL:</strong> <code>${window.location.origin}${getAppBasePath()}</code></div>
                <div><strong>Last Working API:</strong> <code>${lastWorkingApiBase || 'Đang tự động nhận diện'}</code></div>
                <div><strong>WS Hiện tại:</strong> <code>${(ws && ws.url) || getWebSocketUrl()}</code></div>
            </div>
            <div style="margin-bottom:14px;">
                <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">IP / Tên miền máy chủ thủ công (Tùy chọn):</label>
                <div style="display:flex;gap:6px;">
                    <input id="diag_custom_host" type="text" placeholder="vd: acestudio.mooo.com:3000 hoặc IP LAN:3000" value="${manualHost || ''}" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:#fff;font-size:13px;" />
                    <button id="save_custom_host_btn" style="padding:8px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Lưu & Kết Nối</button>
                </div>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button id="test_ping_btn" style="padding:8px 12px;background:#334155;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">⚡ Thử Kết Nối Lại</button>
                <button id="close_diag_bottom" style="padding:8px 16px;background:#475569;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Đóng</button>
            </div>
            <div id="diag_log_output" style="margin-top:10px;font-size:11px;color:#a5f3fc;font-family:monospace;white-space:pre-wrap;"></div>
        `;
        
        modal.appendChild(card);
        document.body.appendChild(modal);
        
        const closeFn = () => { modal.style.display = 'none'; };
        document.getElementById('close_diag_btn').onclick = closeFn;
        document.getElementById('close_diag_bottom').onclick = closeFn;
        
        document.getElementById('save_custom_host_btn').onclick = () => {
            const val = document.getElementById('diag_custom_host').value.trim();
            if (val) {
                localStorage.setItem('attack25_server_host', val);
                manualHost = val;
            } else {
                localStorage.removeItem('attack25_server_host');
                manualHost = '';
            }
            candidateList = buildCandidateList();
            candidateIndex = 0;
            if (ws) { try { ws.close(); } catch(e){} ws = null; }
            connect();
            closeFn();
        };

        document.getElementById('test_ping_btn').onclick = async () => {
            const out = document.getElementById('diag_log_output');
            out.textContent = 'Đang kiểm tra các endpoint...';
            try {
                const res = await smartFetchApi('api/state', { method: 'GET' }, 'roomid=' + currentRoomId);
                if (res && res.state) {
                    out.textContent = '✅ Đã kết nối thành công tới máy chủ! Trạng thái cập nhật: OK.';
                    handleMessage({ type: 'state', state: res.state, questions: res.questions, roomId: currentRoomId });
                } else {
                    out.textContent = '⚠️ Không nhận được phản hồi. Đang chuyển sang kết nối trực tiếp...';
                }
            } catch (e) {
                out.textContent = '❌ Lỗi kết nối: ' + e.message;
            }
        };
    }

    // Auto-bind click on any status badges
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            const targets = document.querySelectorAll('.connection-status, #connectionIndicator, #syncStatus, #roomStatusBadge, [id*="Status"], [class*="status"]');
            targets.forEach(el => {
                if (el) {
                    el.style.cursor = 'pointer';
                    el.title = 'Bấm vào để kiểm tra kết nối mạng';
                    el.addEventListener('click', showConnectionDiagnostics);
                }
            });
        });
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */
    window.Attack25Sync = {
        setRoomId: function (roomId, auth) {
            if (!roomId) return;
            const changed = (roomId !== currentRoomId || auth !== currentAuth);
            currentRoomId = roomId;
            currentAuth = auth || '';

            try {
                localStorage.setItem('attack25_active_roomid', currentRoomId);
                if (currentAuth) {
                    localStorage.setItem('attack25_active_auth', currentAuth);
                }
            } catch (e) {}

            if (changed) {
                initBroadcastChannel();
                candidateList = buildCandidateList();
                candidateIndex = 0;
                if (ws) {
                    try { ws.close(); } catch (e) {}
                    ws = null;
                }
                connect();
            }
        },

        getRoomId: function () {
            return currentRoomId;
        },

        getAuth: function () {
            return currentAuth;
        },

        broadcastState: function (state, actionName, soundEvent) {
            if (!state) return;
            saveStateLocal(state);

            send({
                type: "state",
                state: state,
                action: actionName || "update",
                sound: soundEvent || null,
                roomId: currentRoomId
            });
        },

        broadcastQuestions: function (questions) {
            if (!questions) return;
            saveQuestionsLocal(questions);

            send({
                type: "questions",
                questions: questions,
                roomId: currentRoomId
            });
        },

        sendPlayerBuzz: function (player) {
            send({
                type: "buzz",
                player: player,
                time: Date.now(),
                roomId: currentRoomId
            });
        },

        sendPlayerBuzzAttempt: function (player) {
            send({
                type: "buzz_attempt",
                player: player,
                time: Date.now(),
                roomId: currentRoomId
            });
        },

        sendSound: function (soundName) {
            send({
                type: "sound",
                sound: soundName,
                roomId: currentRoomId
            });
        },

        onStateChange: function (callback) {
            if (typeof callback !== "function") return;
            stateHandlers.push(callback);

            try {
                const saved = localStorage.getItem(KEY_STATE_PREFIX + currentRoomId);
                if (saved) {
                    const state = JSON.parse(saved);
                    setTimeout(function () {
                        callback(state);
                    }, 0);
                }
            } catch (e) {}
        },

        onQuestionsChange: function (callback) {
            if (typeof callback !== "function") return;
            questionHandlers.push(callback);

            try {
                const saved = localStorage.getItem(KEY_QUESTIONS_PREFIX + currentRoomId);
                if (saved) {
                    const questions = JSON.parse(saved);
                    setTimeout(function () {
                        callback(questions);
                    }, 0);
                }
            } catch (e) {}
        },

        onSound: function (callback) {
            if (typeof callback !== "function") return;
            soundHandlers.push(callback);
        },

        onBuzz: function (callback) {
            if (typeof callback !== "function") return;
            buzzHandlers.push(callback);
        },

        onBuzzAttempt: function (callback) {
            if (typeof callback !== "function") return;
            buzzAttemptHandlers.push(callback);
        },

        onConnectionChange: function (callback) {
            if (typeof callback !== "function") return;
            connectionHandlers.push(callback);
            const url = getWebSocketUrl();

            setTimeout(function () {
                callback({
                    connected: !!(ws && ws.readyState === WebSocket.OPEN),
                    mode: (ws && ws.readyState === WebSocket.OPEN) ? "websocket" : (pollInterval ? "polling" : "local"),
                    url: activeWsUrl || url,
                    roomId: currentRoomId,
                    serverHost: manualHost || (window.location.protocol !== "file:" ? window.location.host : "localhost:3000")
                });
            }, 0);
        },

        setServerHost: function (host) {
            manualHost = normalizeHost(host);
            try {
                if (manualHost) {
                    localStorage.setItem(KEY_HOST, manualHost);
                } else {
                    localStorage.removeItem(KEY_HOST);
                }
            } catch (e) {}

            candidateList = buildCandidateList();
            candidateIndex = 0;

            if (ws) {
                try {
                    ws.onclose = null;
                    ws.close();
                } catch (e) {}
                ws = null;
            }

            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }

            connect();
        },

        getServerHost: function () {
            return manualHost || (window.location.protocol !== "file:" ? window.location.host : "localhost:3000");
        },

        getWebSocketUrl: function () {
            return activeWsUrl || getWebSocketUrl();
        },

        getConnectionDetails: function () {
            return {
                connected: !!(ws && ws.readyState === WebSocket.OPEN),
                activeUrl: activeWsUrl,
                currentUrl: getWebSocketUrl(),
                candidates: candidateList && candidateList.length ? candidateList : buildCandidateList(),
                candidateIndex: candidateIndex,
                manualHost: manualHost,
                roomId: currentRoomId,
                auth: currentAuth,
                isPolling: !!pollInterval
            };
        },

        reconnect: function () {
            if (ws) {
                try {
                    ws.onclose = null;
                    ws.close();
                } catch (e) {}
                ws = null;
            }

            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }

            candidateList = buildCandidateList();
            candidateIndex = 0;
            connect();
        }
    };

    setTimeout(function () {
        connect();
    }, 0);

})();
