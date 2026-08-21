/* =========================================================
   ATTACK 25 - UNIVERSAL REAL-TIME SYNC CLIENT (ROOM SCOPED)
   ========================================================= */

(function () {
    "use strict";

    const CHANNEL_BASE = "attack25-sync-v3";

    const KEY_STATE_PREFIX = "attack25_gamestate_";
    const KEY_QUESTIONS_PREFIX = "attack25_questions_";
    const KEY_HOST = "attack25_ws_server_host";

    const urlParams = new URLSearchParams(window.location.search);
    let currentRoomId = urlParams.get('roomid') || '123456';
    let currentAuth = urlParams.get('auth') || '';

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

    let manualHost = "";

    try {
        manualHost = localStorage.getItem(KEY_HOST) || "";
    } catch (e) {
        manualHost = "";
    }

    const stateHandlers = [];
    const questionHandlers = [];
    const soundHandlers = [];
    const connectionHandlers = [];

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
       HELPER
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

    function emitConnection(connected, url) {
        emit(connectionHandlers, {
            connected: connected,
            mode: "websocket",
            url: url || "",
            roomId: currentRoomId
        });
    }

    function normalizeHost(host) {
        return String(host || "")
            .trim()
            .replace(/^https?:\/\//i, "")
            .replace(/^wss?:\/\//i, "")
            .replace(/\/+$/, "")
            .replace(/\/ws$/i, "");
    }

    function getWebSocketUrl() {
        let host = normalizeHost(manualHost);

        if (!host && window.location.protocol !== "file:") {
            host = window.location.host;
        }

        if (!host) {
            host = "localhost:3000";
        }

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        return protocol + "//" + host + "/ws";
    }

    /* =========================================================
       LOCAL STORAGE PER ROOM
       ========================================================= */

    function saveStateLocal(state) {
        try {
            localStorage.setItem(KEY_STATE_PREFIX + currentRoomId, JSON.stringify(state));
        } catch (e) {}
    }

    function saveQuestionsLocal(questions) {
        try {
            localStorage.setItem(KEY_QUESTIONS_PREFIX + currentRoomId, JSON.stringify(questions));
        } catch (e) {}
    }

    /* =========================================================
       XỬ LÝ MESSAGE
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
        }
    }

    /* =========================================================
       GỬI MESSAGE
       ========================================================= */

    function send(message) {
        if (!message || typeof message !== "object") {
            return false;
        }

        const payload = Object.assign(
            {
                channel: CHANNEL_BASE,
                source: instanceId,
                roomId: currentRoomId,
                auth: currentAuth,
                ts: Date.now()
            },
            message
        );

        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage(payload);
            } catch (e) {}
        }

        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(payload));
                return true;
            } catch (e) {
                console.error("WebSocket send failed:", e);
            }
        }

        return false;
    }

    /* =========================================================
       KẾT NỐI WEBSOCKET
       ========================================================= */

    function connect() {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        const url = getWebSocketUrl();
        reconnecting = true;

        try {
            ws = new WebSocket(url);
        } catch (error) {
            ws = null;
            emitConnection(false, url);
            scheduleReconnect();
            return;
        }

        ws.onopen = function () {
            reconnecting = false;
            emitConnection(true, url);

            // Request state for current room on connect
            ws.send(JSON.stringify({
                channel: CHANNEL_BASE,
                source: instanceId,
                type: 'GET_STATE',
                roomId: currentRoomId,
                auth: currentAuth
            }));
        };

        ws.onmessage = function (event) {
            try {
                const message = JSON.parse(event.data);
                handleMessage(message);
            } catch (error) {}
        };

        ws.onerror = function () {};

        ws.onclose = function () {
            ws = null;
            reconnecting = false;
            emitConnection(false, url);
            scheduleReconnect();
        };
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(function () {
            reconnectTimer = null;
            connect();
        }, 2500);
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.Attack25Sync = {
        setRoomId: function (roomId, auth) {
            if (roomId) {
                currentRoomId = String(roomId).trim();
                if (auth !== undefined) currentAuth = String(auth).trim();
                initBroadcastChannel();

                try {
                    const savedState = localStorage.getItem(KEY_STATE_PREFIX + currentRoomId);
                    if (savedState) {
                        emit(stateHandlers, JSON.parse(savedState));
                    }
                } catch (e) {}

                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        channel: CHANNEL_BASE,
                        source: instanceId,
                        type: 'GET_STATE',
                        roomId: currentRoomId,
                        auth: currentAuth
                    }));
                }
            }
        },

        getRoomId: function () {
            return currentRoomId;
        },

        getAuth: function () {
            return currentAuth;
        },

        broadcastState: function (state, action, soundEvent) {
            action = action || "update";
            saveStateLocal(state);

            send({
                type: "state",
                state: state,
                action: action,
                roomId: currentRoomId
            });

            if (soundEvent) {
                send({
                    type: "sound",
                    sound: soundEvent,
                    roomId: currentRoomId
                });
            }
        },

        broadcastQuestions: function (questions) {
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

        onConnectionChange: function (callback) {
            if (typeof callback !== "function") return;
            connectionHandlers.push(callback);
            const url = getWebSocketUrl();

            setTimeout(function () {
                callback({
                    connected: !!(ws && ws.readyState === WebSocket.OPEN),
                    mode: "websocket",
                    url: url,
                    roomId: currentRoomId
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
            return getWebSocketUrl();
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

            connect();
        }
    };

    setTimeout(function () {
        connect();
    }, 0);

})();
