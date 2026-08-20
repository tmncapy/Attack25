// =========================================================
// ATTACK 25 SERVER
// Static files + WebSocket
// Endpoint WebSocket: /ws
// =========================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const root = __dirname;

const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",

    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",

    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",

    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",

    ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls":
        "application/vnd.ms-excel",
    ".csv": "text/csv; charset=utf-8"
};


// =========================================================
// DỮ LIỆU ĐỒNG BỘ GẦN NHẤT
// =========================================================

let latestState = null;
let latestQuestions = null;


// =========================================================
// HTTP SERVER
// =========================================================

const server = http.createServer(function (req, res) {

    let requestPath = decodeURIComponent(
        req.url.split("?")[0]
    );

    // Route mặc định
    if (
        requestPath === "/" ||
        requestPath === "/index.html"
    ) {
        requestPath = "/Controller(2).html";
    }


    // Nếu repository của bạn dùng controller.html
    // thì tự map sang file Controller(2).html nếu cần.
    if (
        requestPath.toLowerCase() === "/controller.html" &&
        !fs.existsSync(
            path.join(root, "controller.html")
        )
    ) {
        requestPath = "/Controller(2).html";
    }


    // Projector aliases
    if (
        requestPath.toLowerCase() === "/project.html" &&
        !fs.existsSync(
            path.join(root, "Project.html")
        )
    ) {
        if (
            fs.existsSync(
                path.join(root, "Projector.html")
            )
        ) {
            requestPath = "/Projector.html";
        }
    }


    // Không cho truy cập ra ngoài thư mục project
    const filePath = path.normalize(
        path.join(root, requestPath)
    );

    if (!filePath.startsWith(root)) {
        res.writeHead(403, {
            "Content-Type": "text/plain; charset=utf-8"
        });

        res.end("Forbidden");

        return;
    }


    fs.stat(filePath, function (statError, stats) {

        if (
            statError ||
            !stats ||
            !stats.isFile()
        ) {
            res.writeHead(404, {
                "Content-Type":
                    "text/plain; charset=utf-8"
            });

            res.end("Not found");

            return;
        }


        const extension =
            path.extname(filePath).toLowerCase();

        const contentType =
            mime[extension] ||
            "application/octet-stream";


        res.writeHead(200, {
            "Content-Type": contentType,

            // Giúp Render/browser lấy file mới sau deploy
            "Cache-Control": "no-store, no-cache, must-revalidate"
        });


        const stream =
            fs.createReadStream(filePath);

        stream.on("error", function () {

            if (!res.headersSent) {
                res.writeHead(500, {
                    "Content-Type":
                        "text/plain; charset=utf-8"
                });
            }

            res.end("Server error");
        });

        stream.pipe(res);
    });

});


// =========================================================
// WEBSOCKET SERVER
//
// QUAN TRỌNG:
// Chỉ WebSocket URL /ws được chấp nhận.
//
// Render:
// wss://attack25.onrender.com/ws
//
// LAN:
// ws://192.168.x.x:3000/ws
// =========================================================

const wss = new WebSocket.Server({
    server: server,
    path: "/ws"
});


// =========================================================
// KẾT NỐI WEBSOCKET
// =========================================================

wss.on("connection", function (socket, request) {

    console.log(
        "[WS] Client connected:",
        request.socket.remoteAddress
    );


    // Gửi state mới nhất cho client vừa kết nối
    if (latestState !== null) {

        socket.send(
            JSON.stringify({
                channel: "attack25-sync-v3",
                type: "state",
                state: latestState,
                source: "server"
            })
        );
    }


    // Gửi danh sách câu hỏi mới nhất
    if (latestQuestions !== null) {

        socket.send(
            JSON.stringify({
                channel: "attack25-sync-v3",
                type: "questions",
                questions: latestQuestions,
                source: "server"
            })
        );
    }


    // Nhận dữ liệu
    socket.on("message", function (raw) {

        let message;

        try {
            message = JSON.parse(
                raw.toString()
            );
        } catch (error) {

            console.warn(
                "[WS] Invalid JSON received"
            );

            return;
        }


        if (
            !message ||
            message.channel !== "attack25-sync-v3"
        ) {
            return;
        }


        // Lưu dữ liệu gần nhất
        if (message.type === "state") {
            latestState = message.state;
        }

        if (message.type === "questions") {
            latestQuestions = message.questions;
        }


        // Broadcast cho tất cả client
        const text = JSON.stringify(message);

        wss.clients.forEach(function (client) {

            if (
                client.readyState ===
                WebSocket.OPEN
            ) {
                try {
                    client.send(text);
                } catch (error) {
                    console.warn(
                        "[WS] Send error:",
                        error.message
                    );
                }
            }
        });

    });


    socket.on("close", function () {

        console.log(
            "[WS] Client disconnected"
        );

    });


    socket.on("error", function (error) {

        console.warn(
            "[WS] Client error:",
            error.message
        );

    });

});


// =========================================================
// START SERVER
// Render tự cấp process.env.PORT
// =========================================================

const port =
    Number(process.env.PORT) || 3000;


server.listen(
    port,
    "0.0.0.0",
    function () {

        console.log("");
        console.log(
            "=========================================="
        );

        console.log(
            "ATTACK 25 SERVER RUNNING"
        );

        console.log(
            "HTTP: http://0.0.0.0:" + port
        );

        console.log(
            "WEBSOCKET: ws://0.0.0.0:" +
            port +
            "/ws"
        );

        console.log(
            "=========================================="
        );

        console.log("");

    }
);
