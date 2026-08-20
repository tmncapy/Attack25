/**
 * ============================================================
 * PANEL QUIZ ATTACK 25 - UNIVERSAL REAL-TIME SERVER
 * ============================================================
 *
 * Chức năng:
 * - Phục vụ toàn bộ file HTML/CSS/JS/image/audio trong thư mục.
 * - WebSocket đồng bộ thời gian thực.
 * - Controller <-> Projector <-> các thiết bị khác.
 * - Lưu trạng thái game hiện tại trong RAM.
 * - Thiết bị mới kết nối sẽ tự nhận trạng thái mới nhất.
 * - Hoạt động Localhost / LAN / Internet.
 *
 * Cài đặt:
 *   npm install
 *
 * Chạy:
 *   npm start
 *
 * Hoặc:
 *   node server.js
 *
 * Local:
 *   http://localhost:3000/Controller(2).html
 *   http://localhost:3000/Projector.html
 *
 * LAN:
 *   http://IP-MAY-CHU:3000/Controller(2).html
 *   http://IP-MAY-CHU:3000/Projector.html
 *
 * ============================================================
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");

/* ============================================================
   CONFIG
============================================================ */

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const ROOT_DIR = __dirname;

/*
 * Giới hạn file upload qua HTTP nếu sau này project có thêm API.
 * Hiện tại server chỉ phục vụ file tĩnh + WebSocket.
 */
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB


/* ============================================================
   MIME TYPES
============================================================ */

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",

    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",

    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",

    ".mp4": "video/mp4",
    ".webm": "video/webm",

    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",

    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".csv": "text/csv; charset=utf-8",

    ".pdf": "application/pdf"
};


/* ============================================================
   GAME STATE
============================================================ */

/*
 * Server không tự quyết định luật game.
 * Server chỉ lưu và chuyển tiếp dữ liệu từ Controller.
 */

let latestGameState = null;
let latestQuestions = null;
let latestBuzzerState = null;

/*
 * Danh sách sự kiện gần nhất.
 * Giúp thiết bị mới kết nối có thể biết trạng thái cơ bản.
 */
const eventHistory = [];
const MAX_EVENT_HISTORY = 50;


/* ============================================================
   HTTP STATIC SERVER
============================================================ */

function sendResponse(res, statusCode, contentType, data, extraHeaders = {}) {
    res.writeHead(statusCode, {
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        ...extraHeaders
    });

    res.end(data);
}


function send404(res) {
    sendResponse(
        res,
        404,
        "text/plain; charset=utf-8",
        "404 - File not found"
    );
}


function send500(res, error) {
    console.error("HTTP ERROR:", error);

    sendResponse(
        res,
        500,
        "text/plain; charset=utf-8",
        "500 - Internal Server Error"
    );
}


/*
 * Chống truy cập ra ngoài thư mục project.
 */
function getSafeFilePath(urlPath) {
    try {
        const decodedPath = decodeURIComponent(urlPath);

        let relativePath = decodedPath;

        if (relativePath === "/" || relativePath === "") {
            relativePath = "/Controller(2).html";
        }

        relativePath = relativePath.replace(/^[/\\]+/, "");

        const normalizedPath = path.normalize(relativePath);

        const absolutePath = path.resolve(ROOT_DIR, normalizedPath);
        const rootPath = path.resolve(ROOT_DIR);

        /*
         * Kiểm tra file có nằm trong thư mục project không.
         */
        if (
            absolutePath !== rootPath &&
            !absolutePath.startsWith(rootPath + path.sep)
        ) {
            return null;
        }

        return absolutePath;

    } catch (error) {
        return null;
    }
}


function handleHttpRequest(req, res) {
    /*
     * CORS preflight
     */
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });

        res.end();
        return;
    }


    /*
     * Chỉ phục vụ GET / HEAD.
     */
    if (req.method !== "GET" && req.method !== "HEAD") {
        sendResponse(
            res,
            405,
            "text/plain; charset=utf-8",
            "405 - Method Not Allowed",
            {
                "Allow": "GET, HEAD, OPTIONS"
            }
        );

        return;
    }


    let requestUrl;

    try {
        requestUrl = new URL(
            req.url,
            `http://${req.headers.host || "localhost"}`
        );
    } catch (error) {
        send404(res);
        return;
    }


    const pathname = requestUrl.pathname;


    /*
     * API kiểm tra trạng thái server.
     */
    if (pathname === "/api/health") {
        const payload = JSON.stringify({
            ok: true,
            service: "Panel Quiz Attack 25",
            clients: clients.size,
            timestamp: Date.now()
        });

        sendResponse(
            res,
            200,
            "application/json; charset=utf-8",
            payload
        );

        return;
    }


    /*
     * API lấy state hiện tại.
     */
    if (pathname === "/api/state") {
        const payload = JSON.stringify({
            gameState: latestGameState,
            questions: latestQuestions,
            buzzer: latestBuzzerState,
            timestamp: Date.now()
        });

        sendResponse(
            res,
            200,
            "application/json; charset=utf-8",
            payload
        );

        return;
    }


    const filePath = getSafeFilePath(pathname);

    if (!filePath) {
        send404(res);
        return;
    }


    fs.stat(filePath, (statError, stats) => {
        if (statError) {
            send404(res);
            return;
        }


        /*
         * Nếu truy cập thư mục.
         */
        if (stats.isDirectory()) {
            const indexFile = path.join(
                filePath,
                "Controller(2).html"
            );

            fs.stat(indexFile, (indexError, indexStats) => {
                if (
                    indexError ||
                    !indexStats ||
                    !indexStats.isFile()
                ) {
                    send404(res);
                    return;
                }

                serveFile(indexFile, req, res);
            });

            return;
        }


        if (!stats.isFile()) {
            send404(res);
            return;
        }


        /*
         * Tránh phục vụ file quá lớn ngoài ý muốn.
         */
        if (stats.size > MAX_FILE_SIZE) {
            sendResponse(
                res,
                413,
                "text/plain; charset=utf-8",
                "413 - File Too Large"
            );

            return;
        }


        serveFile(filePath, req, res);
    });
}


function serveFile(filePath, req, res) {
    const extension = path.extname(filePath).toLowerCase();

    const contentType =
        MIME_TYPES[extension] ||
        "application/octet-stream";


    /*
     * HEAD chỉ trả header.
     */
    if (req.method === "HEAD") {
        res.writeHead(200, {
            "Content-Type": contentType,
            "Content-Length": fs.statSync(filePath).size,
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Access-Control-Allow-Origin": "*"
        });

        res.end();
        return;
    }


    const stream = fs.createReadStream(filePath);

    res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "Access-Control-Allow-Origin": "*"
    });


    stream.on("error", (error) => {
        console.error("FILE STREAM ERROR:", error);

        if (!res.headersSent) {
            send500(res, error);
        } else {
            res.destroy(error);
        }
    });


    stream.pipe(res);
}


/* ============================================================
   CREATE HTTP SERVER
============================================================ */

const server = http.createServer(handleHttpRequest);


/* ============================================================
   WEBSOCKET SERVER
============================================================ */

const wss = new WebSocketServer({
    server,
    path: "/ws",

    /*
     * Tránh payload quá lớn.
     */
    maxPayload: 10 * 1024 * 1024
});


const clients = new Set();


/* ============================================================
   HELPERS
============================================================ */

function safeJsonParse(data) {
    try {
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}


function safeJsonStringify(data) {
    try {
        return JSON.stringify(data);
    } catch (error) {
        console.error("JSON STRINGIFY ERROR:", error);
        return null;
    }
}


function sendToClient(ws, data) {
    if (!ws) return false;

    if (ws.readyState !== WebSocket.OPEN) {
        return false;
    }

    const json = safeJsonStringify(data);

    if (!json) return false;

    try {
        ws.send(json);
        return true;
    } catch (error) {
        console.error("WEBSOCKET SEND ERROR:", error);
        return false;
    }
}


function broadcast(data, excludeClient = null) {
    const json = safeJsonStringify(data);

    if (!json) return;

    for (const client of clients) {
        if (
            client === excludeClient ||
            client.readyState !== WebSocket.OPEN
        ) {
            continue;
        }

        try {
            client.send(json);
        } catch (error) {
            console.error("WEBSOCKET BROADCAST ERROR:", error);
        }
    }
}


function addToHistory(event) {
    eventHistory.push({
        ...event,
        serverTimestamp: Date.now()
    });

    if (eventHistory.length > MAX_EVENT_HISTORY) {
        eventHistory.splice(
            0,
            eventHistory.length - MAX_EVENT_HISTORY
        );
    }
}


/* ============================================================
   SAVE STATE
============================================================ */

function processIncomingMessage(message) {
    if (!message || typeof message !== "object") {
        return;
    }


    /*
     * Hỗ trợ nhiều kiểu protocol.
     *
     * Ví dụ:
     * {
     *   type: "state",
     *   state: {...}
     * }
     *
     * hoặc:
     * {
     *   type: "questions",
     *   questions: [...]
     * }
     *
     * hoặc:
     * {
     *   type: "sound",
     *   sound: "arm"
     * }
     */

    const type =
        message.type ||
        message.action ||
        "message";


    /*
     * GAME STATE
     */
    if (
        type === "state" ||
        type === "game_state" ||
        type === "update" ||
        type === "sync" ||
        type === "buzzer_armed" ||
        type === "buzzer_locked" ||
        type === "buzzer_reset" ||
        message.state
    ) {
        if (message.state && typeof message.state === "object") {
            latestGameState = message.state;

            if (latestGameState.buzzer) {
                latestBuzzerState =
                    latestGameState.buzzer;
            }
        }
    }


    /*
     * QUESTIONS
     */
    if (
        type === "questions" ||
        type === "question_list" ||
        Array.isArray(message.questions)
    ) {
        if (Array.isArray(message.questions)) {
            latestQuestions = message.questions;
        }
    }


    /*
     * BUZZER
     */
    if (
        type === "buzzer" ||
        message.buzzer
    ) {
        if (
            message.buzzer &&
            typeof message.buzzer === "object"
        ) {
            latestBuzzerState = message.buzzer;
        }
    }


    /*
     * SOUND không cần lưu lâu dài.
     * Chỉ broadcast ngay.
     */

    addToHistory({
        type,
        hasState: !!message.state,
        hasQuestions: Array.isArray(message.questions),
        hasSound: !!message.sound
    });
}


/* ============================================================
   SEND INITIAL SYNC
============================================================ */

function sendInitialState(ws) {
    /*
     * Gửi snapshot tổng.
     */
    sendToClient(ws, {
        type: "sync_snapshot",
        timestamp: Date.now(),
        state: latestGameState,
        questions: latestQuestions,
        buzzer: latestBuzzerState
    });


    /*
     * Gửi riêng từng dữ liệu để tương thích client cũ.
     */

    if (latestGameState) {
        sendToClient(ws, {
            type: "state",
            action: "sync",
            state: latestGameState
        });
    }


    if (latestQuestions) {
        sendToClient(ws, {
            type: "questions",
            questions: latestQuestions
        });
    }


    if (latestBuzzerState) {
        sendToClient(ws, {
            type: "buzzer",
            buzzer: latestBuzzerState
        });
    }
}


/* ============================================================
   WEBSOCKET CONNECTION
============================================================ */

wss.on("connection", (ws, request) => {
    clients.add(ws);

    const remoteAddress =
        request.socket.remoteAddress || "unknown";

    console.log(
        `[WS] Connected: ${remoteAddress} | Clients: ${clients.size}`
    );


    /*
     * Chào client.
     */
    sendToClient(ws, {
        type: "connected",
        connected: true,
        serverTime: Date.now(),
        clients: clients.size
    });


    /*
     * Đồng bộ state hiện tại cho client mới.
     */
    sendInitialState(ws);


    /*
     * Thông báo số client mới.
     */
    broadcast({
        type: "clients",
        count: clients.size
    });


    ws.on("message", (rawData, isBinary) => {
        /*
         * Không xử lý binary.
         */
        if (isBinary) {
            return;
        }


        const text = rawData.toString("utf8");

        const message = safeJsonParse(text);

        if (!message) {
            console.warn(
                "[WS] Invalid JSON from:",
                remoteAddress
            );

            return;
        }


        /*
         * Client yêu cầu sync lại.
         */
        if (
            message.type === "request_sync" ||
            message.type === "get_state"
        ) {
            sendInitialState(ws);
            return;
        }


        /*
         * Ping cấp ứng dụng.
         */
        if (message.type === "ping") {
            sendToClient(ws, {
                type: "pong",
                timestamp: Date.now()
            });

            return;
        }


        /*
         * Lưu trạng thái.
         */
        processIncomingMessage(message);


        /*
         * Chuyển nguyên message đến tất cả client khác.
         *
         * Không gửi lại client gửi để tránh vòng lặp.
         */
        broadcast(message, ws);
    });


    ws.on("close", () => {
        clients.delete(ws);

        console.log(
            `[WS] Disconnected: ${remoteAddress} | Clients: ${clients.size}`
        );


        broadcast({
            type: "clients",
            count: clients.size
        });
    });


    ws.on("error", (error) => {
        console.error(
            `[WS] Error from ${remoteAddress}:`,
            error.message
        );
    });
});


/* ============================================================
   HEARTBEAT
============================================================ */

/*
 * Phát hiện client chết mà không gửi sự kiện close.
 */

const heartbeatInterval = setInterval(() => {
    for (const ws of clients) {

        if (ws.isAlive === false) {
            clients.delete(ws);

            try {
                ws.terminate();
            } catch (error) {}

            continue;
        }


        ws.isAlive = false;


        try {
            ws.ping();
        } catch (error) {}
    }

}, 30000);


wss.on("connection", (ws) => {
    ws.isAlive = true;

    ws.on("pong", () => {
        ws.isAlive = true;
    });
});


/* ============================================================
   SERVER ERROR
============================================================ */

server.on("error", (error) => {
    console.error("\n==================================================");
    console.error("SERVER ERROR");
    console.error("==================================================");
    console.error(error);

    if (error.code === "EADDRINUSE") {
        console.error(
            `\nPort ${PORT} đang được sử dụng.`
        );

        console.error(
            "Hãy đóng server khác hoặc chạy với PORT khác."
        );
    }

    console.error("==================================================\n");
});


/* ============================================================
   START SERVER
============================================================ */

server.listen(PORT, HOST, () => {

    console.log("");
    console.log("==================================================");
    console.log(" PANEL QUIZ ATTACK 25 - UNIVERSAL SERVER");
    console.log("==================================================");
    console.log(`Server running on port: ${PORT}`);
    console.log(`Host: ${HOST}`);
    console.log("");
    console.log(`Local Controller:`);
    console.log(`http://localhost:${PORT}/Controller(2).html`);
    console.log("");
    console.log(`Local Projector:`);
    console.log(`http://localhost:${PORT}/Projector.html`);
    console.log("");
    console.log(`WebSocket:`);
    console.log(`ws://localhost:${PORT}/ws`);
    console.log("");
    console.log(`Health check:`);
    console.log(`http://localhost:${PORT}/api/health`);
    console.log("==================================================");
    console.log("");
});


/* ============================================================
   GRACEFUL SHUTDOWN
============================================================ */

function shutdown(signal) {
    console.log(`\n[SERVER] ${signal} received. Shutting down...`);

    clearInterval(heartbeatInterval);


    for (const ws of clients) {
        try {
            ws.close(1001, "Server shutting down");
        } catch (error) {}
    }


    wss.close(() => {
        server.close(() => {
            console.log("[SERVER] Closed successfully.");
            process.exit(0);
        });
    });


    /*
     * Ép thoát nếu có client treo.
     */
    setTimeout(() => {
        process.exit(0);
    }, 5000).unref();
}


process.on("SIGINT", () => {
    shutdown("SIGINT");
});


process.on("SIGTERM", () => {
    shutdown("SIGTERM");
});