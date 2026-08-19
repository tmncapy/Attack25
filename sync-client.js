/**
 * Attack 25 Real-Time Universal Synchronizer (Global & Cross-Platform Edition)
 * Works everywhere: Local LAN, Global Internet Cloud, Cross-Browser, Multi-Device
 * Supports:
 * 1. Secure WebSockets (wss:// & ws://) with auto-reconnect
 * 2. URL Server Parameter (?server=...) for zero-config remote pairing
 * 3. HTTP State Sync Polling Fallback (Cross-continent firewall bypass)
 * 4. Local BroadcastChannel & Storage Event Sync
 */

(function(window) {
    'use strict';

    const SYNC_CHANNEL_NAME = 'panel_quiz_attack_25_channel';
    const STATE_KEY = 'attack25_gamestate';
    const QUESTIONS_KEY = 'attack25_questions';
    const SERVER_CONFIG_KEY = 'attack25_ws_server_host';

    let socket = null;
    let broadcastChannel = null;
    let reconnectTimeout = null;
    let pollingInterval = null;
    let isWsConnected = false;
    let activeServerUrl = '';

    const listeners = {
        state: [],
        questions: [],
        sound: [],
        connection: []
    };

    // 1. Initialize BroadcastChannel (instant zero-latency local fallback)
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
            broadcastChannel.onmessage = function(event) {
                if (event && event.data) {
                    handleIncomingMessage(event.data, 'broadcast');
                }
            };
        }
    } catch (e) {}

    // 2. Storage event listener (cross-tab local sync)
    try {
        window.addEventListener('storage', function(e) {
            if (e.key === STATE_KEY && e.newValue) {
                try {
                    const state = JSON.parse(e.newValue);
                    notifyListeners('state', state);
                } catch (err) {}
            }
            if (e.key === QUESTIONS_KEY && e.newValue) {
                try {
                    const questions = JSON.parse(e.newValue);
                    notifyListeners('questions', questions);
                } catch (err) {}
            }
        });
    } catch (e) {}

    // 3. Determine WebSocket Server URL
    function getWebSocketUrl() {
        try {
            // Check URL query param ?server=...
            const urlParams = new URLSearchParams(window.location.search);
            const queryServer = urlParams.get('server') || urlParams.get('ws') || urlParams.get('host');
            if (queryServer && queryServer.trim()) {
                let s = queryServer.trim();
                if (s.startsWith('http://')) s = 'ws://' + s.slice(7);
                else if (s.startsWith('https://')) s = 'wss://' + s.slice(8);
                else if (!s.startsWith('ws://') && !s.startsWith('wss://')) {
                    s = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + s;
                }
                if (!s.endsWith('/ws')) s = s.replace(/\/+$/, '') + '/ws';
                return s;
            }

            // Check localStorage saved server
            const savedHost = localStorage.getItem(SERVER_CONFIG_KEY);
            if (savedHost && savedHost.trim()) {
                let s = savedHost.trim();
                if (s.startsWith('http://')) s = 'ws://' + s.slice(7);
                else if (s.startsWith('https://')) s = 'wss://' + s.slice(8);
                else if (!s.startsWith('ws://') && !s.startsWith('wss://')) {
                    s = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + s;
                }
                if (!s.endsWith('/ws')) s = s.replace(/\/+$/, '') + '/ws';
                return s;
            }
        } catch (e) {}

        // If accessed via HTTP or HTTPS web server (Cloud / LAN)
        if (window.location.host) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${protocol}//${window.location.host}/ws`;
        }

        // Default local port
        return 'ws://localhost:3000/ws';
    }

    // 4. WebSocket Manager
    function connectWebSocket() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        const wsUrl = getWebSocketUrl();
        activeServerUrl = wsUrl;

        try {
            socket = new WebSocket(wsUrl);

            socket.onopen = function() {
                isWsConnected = true;
                stopPollingFallback();
                notifyListeners('connection', { connected: true, mode: 'websocket', url: wsUrl });
                // Request server authoritative state
                sendWs({ type: 'GET_STATE' });
            };

            socket.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    handleIncomingMessage(data, 'websocket');
                } catch (e) {}
            };

            socket.onclose = function() {
                isWsConnected = false;
                notifyListeners('connection', { connected: false, mode: 'local_fallback', url: wsUrl });
                startPollingFallback();
                reconnectTimeout = setTimeout(connectWebSocket, 2500);
            };

            socket.onerror = function() {
                isWsConnected = false;
                notifyListeners('connection', { connected: false, mode: 'local_fallback', url: wsUrl });
            };
        } catch (err) {
            isWsConnected = false;
            notifyListeners('connection', { connected: false, mode: 'local_fallback', url: wsUrl });
            startPollingFallback();
            reconnectTimeout = setTimeout(connectWebSocket, 3500);
        }
    }

    // HTTP Polling Fallback (for strict networks / long distance proxies)
    function startPollingFallback() {
        if (pollingInterval) return;
        if (!window.location.host && !localStorage.getItem(SERVER_CONFIG_KEY)) return;

        pollingInterval = setInterval(function() {
            if (isWsConnected) {
                stopPollingFallback();
                return;
            }
            try {
                let httpBase = window.location.origin;
                const saved = localStorage.getItem(SERVER_CONFIG_KEY);
                if (saved) {
                    httpBase = saved.replace(/^ws/, 'http');
                }
                if (httpBase && !httpBase.startsWith('file:')) {
                    fetch(`${httpBase}/api/state`, { cache: 'no-store' })
                        .then(r => r.json())
                        .then(data => {
                            if (data && data.state) {
                                handleIncomingMessage({ state: data.state, questions: data.questions }, 'polling');
                            }
                        })
                        .catch(() => {});
                }
            } catch (e) {}
        }, 1500);
    }

    function stopPollingFallback() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    function handleIncomingMessage(data, source) {
        if (!data) return;

        if (data.type === 'PLAYER_BUZZ' && !isWsConnected) {
            handleLocalPlayerBuzz(data.player);
            return;
        }

        if (data.state) {
            try {
                localStorage.setItem(STATE_KEY, JSON.stringify(data.state));
            } catch (e) {}
            notifyListeners('state', data.state);
        }

        if (data.questions) {
            try {
                localStorage.setItem(QUESTIONS_KEY, JSON.stringify(data.questions));
            } catch (e) {}
            notifyListeners('questions', data.questions);
        }

        if (data.sound) {
            notifyListeners('sound', data.sound);
        }
    }

    // Local referee fallback
    function handleLocalPlayerBuzz(playerColor) {
        try {
            const raw = localStorage.getItem(STATE_KEY);
            if (!raw) return;
            const state = JSON.parse(raw);

            if (state.buzzer && state.buzzer.status === 'armed') {
                if (state.buzzer.lockedPlayers && state.buzzer.lockedPlayers.includes(playerColor)) {
                    return;
                }

                if (!state.buzzer.winner) {
                    state.buzzer.status = 'buzzed';
                    state.buzzer.winner = playerColor;
                    state.buzzer.buzzTime = "0.150";
                    state.buzzer.pressOrder = [{ player: playerColor, time: "0.150" }];

                    try {
                        localStorage.setItem(STATE_KEY, JSON.stringify(state));
                    } catch (e) {}

                    const payload = {
                        type: 'SYNC_STATE',
                        action: 'buzzer_hit',
                        state: state,
                        sound: `buzzer_${playerColor}`
                    };

                    if (broadcastChannel) {
                        try { broadcastChannel.postMessage(payload); } catch (e) {}
                    }

                    notifyListeners('state', state);
                    notifyListeners('sound', `buzzer_${playerColor}`);
                }
            }
        } catch (e) {}
    }

    function notifyListeners(event, data) {
        if (listeners[event]) {
            listeners[event].forEach(function(fn) {
                try { fn(data); } catch (err) {}
            });
        }
    }

    function sendWs(msgObj) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            try {
                socket.send(JSON.stringify(msgObj));
                return true;
            } catch (e) {}
        }
        return false;
    }

    // Public API
    const Attack25Sync = {
        onStateChange(fn) {
            listeners.state.push(fn);
            try {
                const saved = localStorage.getItem(STATE_KEY);
                if (saved) fn(JSON.parse(saved));
            } catch (e) {}
        },

        onQuestionsChange(fn) {
            listeners.questions.push(fn);
            try {
                const saved = localStorage.getItem(QUESTIONS_KEY);
                if (saved) fn(JSON.parse(saved));
            } catch (e) {}
        },

        onSound(fn) {
            listeners.sound.push(fn);
        },

        onConnectionChange(fn) {
            listeners.connection.push(fn);
            fn({
                connected: isWsConnected,
                mode: isWsConnected ? 'websocket' : 'local_fallback',
                url: activeServerUrl || getWebSocketUrl()
            });
        },

        broadcastState(state, action = 'update', sound = null) {
            try {
                localStorage.setItem(STATE_KEY, JSON.stringify(state));
            } catch (e) {}

            const payload = {
                type: 'SYNC_STATE',
                action: action,
                state: state,
                sound: sound
            };

            const sentWs = sendWs(payload);

            if (broadcastChannel) {
                try { broadcastChannel.postMessage(payload); } catch (e) {}
            }
        },

        broadcastQuestions(questions) {
            try {
                localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
            } catch (e) {}

            const payload = {
                type: 'SYNC_QUESTIONS',
                questions: questions
            };

            sendWs(payload);

            if (broadcastChannel) {
                try { broadcastChannel.postMessage(payload); } catch (e) {}
            }
        },

        sendPlayerBuzz(playerColor) {
            const payload = {
                type: 'PLAYER_BUZZ',
                player: playerColor,
                timestamp: Date.now()
            };

            const sentWs = sendWs(payload);

            if (broadcastChannel) {
                try { broadcastChannel.postMessage(payload); } catch (e) {}
            }

            if (!sentWs) {
                handleLocalPlayerBuzz(playerColor);
            }
        },

        setServerHost(host) {
            try {
                if (host) {
                    localStorage.setItem(SERVER_CONFIG_KEY, host);
                } else {
                    localStorage.removeItem(SERVER_CONFIG_KEY);
                }
                if (socket) {
                    socket.close();
                }
                connectWebSocket();
            } catch (e) {}
        },

        getServerUrl() {
            return activeServerUrl || getWebSocketUrl();
        },

        isConnected() {
            return isWsConnected;
        },

        getMode() {
            return isWsConnected ? 'websocket' : 'local_fallback';
        }
    };

    window.Attack25Sync = Attack25Sync;

    // Connect immediately
    connectWebSocket();

})(window);
