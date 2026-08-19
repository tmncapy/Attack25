/**
 * Attack 25 Real-Time Universal Synchronizer
 * Combines WebSocket (cross-device/internet), BroadcastChannel (same-browser tabs),
 * and localStorage (offline/page reloads) for 100% reliable real-time game state sync.
 */

(function(window) {
    'use strict';

    const SYNC_CHANNEL_NAME = 'panel_quiz_attack_25';
    const STATE_KEY = 'attack25_gamestate';
    const QUESTIONS_KEY = 'attack25_questions';

    let socket = null;
    let broadcastChannel = null;
    let reconnectTimeout = null;
    let isConnected = false;
    const listeners = {
        state: [],
        questions: [],
        sound: [],
        connection: []
    };

    // Try BroadcastChannel for instant same-browser communication
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
            broadcastChannel.onmessage = (event) => {
                handleIncomingMessage(event.data, 'broadcast');
            };
        }
    } catch (e) {
        console.warn('[Sync] BroadcastChannel not supported:', e);
    }

    // Listen to localStorage changes across tabs
    window.addEventListener('storage', (e) => {
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

    // Listen to window postMessage
    window.addEventListener('message', (e) => {
        if (e.data && (e.data.type === 'SYNC_STATE' || e.data.state)) {
            handleIncomingMessage(e.data, 'postmessage');
        }
    });

    function connectWebSocket() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;

            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                isConnected = true;
                notifyListeners('connection', true);
                // Request initial state from server
                sendRaw({ type: 'GET_STATE' });
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleIncomingMessage(data, 'websocket');
                } catch (e) {
                    console.error('[Sync] Error parsing WS message:', e);
                }
            };

            socket.onclose = () => {
                isConnected = false;
                notifyListeners('connection', false);
                // Auto reconnect after 1.5s
                reconnectTimeout = setTimeout(connectWebSocket, 1500);
            };

            socket.onerror = () => {
                isConnected = false;
                notifyListeners('connection', false);
            };
        } catch (err) {
            console.warn('[Sync] WebSocket connection error:', err);
            reconnectTimeout = setTimeout(connectWebSocket, 2000);
        }
    }

    function handleIncomingMessage(data, source) {
        if (!data) return;

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

    function notifyListeners(event, data) {
        if (listeners[event]) {
            listeners[event].forEach(fn => {
                try { fn(data); } catch (err) { console.error(`[Sync] Error in ${event} listener:`, err); }
            });
        }
    }

    function sendRaw(msgObj) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(msgObj));
        }
    }

    // Public API
    const Attack25Sync = {
        onStateChange(fn) {
            listeners.state.push(fn);
            // Fire immediately with saved local state if available
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
            fn(isConnected);
        },

        broadcastState(state, action = 'update', sound = null) {
            // 1. Update localStorage
            try {
                localStorage.setItem(STATE_KEY, JSON.stringify(state));
            } catch (e) {}

            const payload = {
                type: 'SYNC_STATE',
                action: action,
                state: state,
                sound: sound
            };

            // 2. Send over WebSocket to server (all devices)
            sendRaw(payload);

            // 3. Send over BroadcastChannel (local tabs)
            if (broadcastChannel) {
                try { broadcastChannel.postMessage(payload); } catch (e) {}
            }

            // 4. Send over postMessage (iframes)
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(payload, '*');
                }
            } catch (e) {}
        },

        broadcastQuestions(questions) {
            try {
                localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
            } catch (e) {}

            const payload = {
                type: 'SYNC_QUESTIONS',
                questions: questions
            };

            sendRaw(payload);

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

            sendRaw(payload);

            if (broadcastChannel) {
                try { broadcastChannel.postMessage(payload); } catch (e) {}
            }
        },

        isConnected() {
            return isConnected;
        }
    };

    window.Attack25Sync = Attack25Sync;

    // Start WebSocket
    connectWebSocket();

})(window);
