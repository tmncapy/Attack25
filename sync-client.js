/* =========================================================
   ATTACK 25 - UNIVERSAL REAL-TIME SYNC CLIENT
   Hoạt động:
   - localhost
   - LAN
   - Render
   - HTTP / HTTPS
   ========================================================= */

(function () {
    "use strict";

    const CHANNEL = "attack25-sync-v3";

    const KEY_STATE = "attack25_gamestate";
    const KEY_QUESTIONS = "attack25_questions";
    const KEY_HOST = "attack25_ws_server_host";

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

    if ("BroadcastChannel" in window) {
        try {
            broadcastChannel = new BroadcastChannel(CHANNEL);
        } catch (e) {
            console.warn("BroadcastChannel unavailable:", e);
        }
    }


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
            url: url || ""
        });
    }


    /* =========================================================
       WEBSOCKET URL
       QUAN TRỌNG:
       Không dùng location.pathname
       Vì pathname có thể là /controller.html
       hoặc /Projector.html
       ========================================================= */

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

        // Nếu người dùng chưa nhập server riêng:
        // tự dùng domain/IP hiện tại
        if (!host && window.location.protocol !== "file:") {
            host = window.location.host;
        }

        // Chạy trực tiếp file HTML
        if (!host) {
            host = "localhost:3000";
        }

        // HTTPS -> WSS
        // HTTP -> WS
        const protocol =
            window.location.protocol === "https:"
                ? "wss:"
                : "ws:";

        /*
           Endpoint cố định là /ws

           Render:
           wss://attack25.onrender.com/ws

           LAN:
           ws://192.168.x.x:3000/ws

           Local:
           ws://localhost:3000/ws
        */
        return protocol + "//" + host + "/ws";
    }


    /* =========================================================
       LOCAL STORAGE
       ========================================================= */

    function saveStateLocal(state) {
        try {
            localStorage.setItem(KEY_STATE, JSON.stringify(state));
        } catch (e) {}
    }

    function saveQuestionsLocal(questions) {
        try {
            localStorage.setItem(
                KEY_QUESTIONS,
                JSON.stringify(questions)
            );
        } catch (e) {}
    }


    /* =========================================================
       XỬ LÝ MESSAGE
       ========================================================= */

    function handleMessage(message) {
        if (!message || typeof message !== "object") {
            return;
        }

        // Bỏ qua message từ phiên bản/protocol khác
        if (message.channel !== CHANNEL) {
            return;
        }

        // Không cần xử lý lại message của chính mình
        // BroadcastChannel không gửi lại cho chính tab,
        // nhưng WebSocket server có thể broadcast lại.
        if (message.source === instanceId) {
            return;
        }

        switch (message.type) {
            case "state":
                if (message.state !== undefined) {
                    saveStateLocal(message.state);
                    emit(stateHandlers, message.state);
                }
                break;

            case "questions":
                if (message.questions !== undefined) {
                    saveQuestionsLocal(message.questions);
                    emit(questionHandlers, message.questions);
                }
                break;

            case "sound":
                if (message.sound !== undefined) {
                    emit(soundHandlers, message.sound);
                }
                break;

            default:
                console.log(
                    "Attack25Sync unknown message:",
                    message
                );
                break;
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
                channel: CHANNEL,
                source: instanceId,
                ts: Date.now()
            },
            message
        );

        // Đồng bộ giữa các tab cùng trình duyệt
        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage(payload);
            } catch (e) {
                console.warn(
                    "BroadcastChannel send failed:",
                    e
                );
            }
        }

        // Đồng bộ qua Internet/LAN
        if (
            ws &&
            ws.readyState === WebSocket.OPEN
        ) {
            try {
                ws.send(JSON.stringify(payload));
                return true;
            } catch (e) {
                console.error(
                    "WebSocket send failed:",
                    e
                );
            }
        }

        return false;
    }


    /* =========================================================
       KẾT NỐI WEBSOCKET
       ========================================================= */

    function connect() {
        // Không tạo nhiều WebSocket cùng lúc
        if (
            ws &&
            (
                ws.readyState === WebSocket.OPEN ||
                ws.readyState === WebSocket.CONNECTING
            )
        ) {
            return;
        }

        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        const url = getWebSocketUrl();

        console.log(
            "[Attack25Sync] Connecting to:",
            url
        );

        reconnecting = true;

        try {
            ws = new WebSocket(url);
        } catch (error) {
            console.error(
                "[Attack25Sync] Cannot create WebSocket:",
                error
            );

            ws = null;
            emitConnection(false, url);
            scheduleReconnect();

            return;
        }


        ws.onopen = function () {
            console.log(
                "[Attack25Sync] WebSocket connected:",
                url
            );

            reconnecting = false;

            emitConnection(true, url);
        };


        ws.onmessage = function (event) {
            try {
                const message = JSON.parse(event.data);
                handleMessage(message);
            } catch (error) {
                console.error(
                    "[Attack25Sync] Invalid WebSocket message:",
                    error
                );
            }
        };


        ws.onerror = function () {
            // onclose sẽ xử lý reconnect
        };


        ws.onclose = function () {
            console.warn(
                "[Attack25Sync] WebSocket disconnected:",
                url
            );

            ws = null;
            reconnecting = false;

            emitConnection(false, url);

            scheduleReconnect();
        };
    }


    /* =========================================================
       TỰ ĐỘNG KẾT NỐI LẠI
       ========================================================= */

    function scheduleReconnect() {
        if (reconnectTimer) {
            return;
        }

        reconnectTimer = setTimeout(function () {
            reconnectTimer = null;
            connect();
        }, 2500);
    }


    /* =========================================================
       BROADCAST CHANNEL
       ========================================================= */

    if (broadcastChannel) {
        broadcastChannel.onmessage = function (event) {
            if (!event.data) {
                return;
            }

            handleMessage(event.data);
        };
    }


    /* =========================================================
       PUBLIC API
       Không thay đổi tên hàm để Controller/Projector
       hiện tại vẫn hoạt động
       ========================================================= */

    window.Attack25Sync = {

        broadcastState: function (
            state,
            action,
            soundEvent
        ) {
            action = action || "update";

            saveStateLocal(state);

            send({
                type: "state",
                state: state,
                action: action
            });

            if (soundEvent) {
                send({
                    type: "sound",
                    sound: soundEvent
                });
            }
        },


        broadcastQuestions: function (questions) {
            saveQuestionsLocal(questions);

            send({
                type: "questions",
                questions: questions
            });
        },


        onStateChange: function (callback) {
            if (typeof callback !== "function") {
                return;
            }

            stateHandlers.push(callback);

            // Khôi phục dữ liệu local nếu có
            try {
                const saved =
                    localStorage.getItem(KEY_STATE);

                if (saved) {
                    const state = JSON.parse(saved);

                    setTimeout(function () {
                        callback(state);
                    }, 0);
                }
            } catch (e) {}
        },


        onQuestionsChange: function (callback) {
            if (typeof callback !== "function") {
                return;
            }

            questionHandlers.push(callback);

            try {
                const saved =
                    localStorage.getItem(KEY_QUESTIONS);

                if (saved) {
                    const questions = JSON.parse(saved);

                    setTimeout(function () {
                        callback(questions);
                    }, 0);
                }
            } catch (e) {}
        },


        onSound: function (callback) {
            if (typeof callback !== "function") {
                return;
            }

            soundHandlers.push(callback);
        },


        onConnectionChange: function (callback) {
            if (typeof callback !== "function") {
                return;
            }

            connectionHandlers.push(callback);

            const url = getWebSocketUrl();

            setTimeout(function () {
                callback({
                    connected: !!(
                        ws &&
                        ws.readyState === WebSocket.OPEN
                    ),
                    mode: "websocket",
                    url: url
                });
            }, 0);
        },


        setServerHost: function (host) {
            manualHost = normalizeHost(host);

            try {
                if (manualHost) {
                    localStorage.setItem(
                        KEY_HOST,
                        manualHost
                    );
                } else {
                    localStorage.removeItem(KEY_HOST);
                }
            } catch (e) {}

            // Đóng kết nối cũ
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
            return manualHost ||
                (
                    window.location.protocol !== "file:"
                        ? window.location.host
                        : "localhost:3000"
                );
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


    /* =========================================================
       KHỞI ĐỘNG
       ========================================================= */

    setTimeout(function () {
        connect();
    }, 0);

})();
