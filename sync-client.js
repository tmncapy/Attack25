// ==========================================
// SYNC CLIENT - API + WEBSOCKET
// Chạy được trên:
// - localhost
// - mạng LAN
// - Render / HTTPS
// ==========================================

// API luôn lấy từ domain gốc
const API_BASE = "/api";

// Tự động chọn ws hoặc wss
const WS_PROTOCOL =
    window.location.protocol === "https:" ? "wss:" : "ws:";

// URL WebSocket
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws`;

let socket = null;
let reconnectTimer = null;


// ==========================================
// LẤY STATE TỪ SERVER
// ==========================================

async function getState() {
    try {
        const response = await fetch(`${API_BASE}/state`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `API /state lỗi: ${response.status} ${response.statusText}`
            );
        }

        const state = await response.json();

        console.log("Đã nhận state:", state);

        // Nếu project của bạn có hàm xử lý state,
        // hãy giữ hoặc gọi nó tại đây
        if (typeof applyState === "function") {
            applyState(state);
        }

        return state;

    } catch (error) {
        console.error("Không thể lấy state:", error);
        return null;
    }
}


// ==========================================
// CẬP NHẬT STATE LÊN SERVER
// ==========================================

async function updateState(data) {
    try {
        const response = await fetch(`${API_BASE}/state`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(
                `Không thể cập nhật state: ${response.status}`
            );
        }

        const result = await response.json();

        console.log("State đã cập nhật:", result);

        return result;

    } catch (error) {
        console.error("Lỗi cập nhật state:", error);
        return null;
    }
}


// ==========================================
// KẾT NỐI WEBSOCKET
// ==========================================

function connectWebSocket() {

    // Tránh tạo nhiều kết nối cùng lúc
    if (
        socket &&
        (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    console.log("Đang kết nối WebSocket:", WS_URL);

    try {
        socket = new WebSocket(WS_URL);

    } catch (error) {
        console.error("Không thể tạo WebSocket:", error);
        scheduleReconnect();
        return;
    }


    // --------------------------------------
    // KẾT NỐI THÀNH CÔNG
    // --------------------------------------

    socket.onopen = () => {

        console.log("WebSocket đã kết nối thành công");

        // Xóa timer reconnect nếu có
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        // Lấy state mới nhất khi vừa kết nối
        getState();
    };


    // --------------------------------------
    // NHẬN DỮ LIỆU TỪ SERVER
    // --------------------------------------

    socket.onmessage = (event) => {

        try {

            const message = JSON.parse(event.data);

            console.log("WebSocket nhận:", message);

            // Nếu server gửi state trực tiếp
            if (message.type === "state") {

                if (typeof applyState === "function") {
                    applyState(message.data);
                }

            }

            // Nếu server báo state đã thay đổi
            else if (
                message.type === "state-update" ||
                message.type === "update"
            ) {

                if (message.data && typeof applyState === "function") {
                    applyState(message.data);
                } else {
                    getState();
                }

            }

            // Xử lý các message khác nếu project có
            if (typeof handleSocketMessage === "function") {
                handleSocketMessage(message);
            }

        } catch (error) {

            console.error(
                "Không thể xử lý dữ liệu WebSocket:",
                error
            );

        }
    };


    // --------------------------------------
    // LỖI WEBSOCKET
    // --------------------------------------

    socket.onerror = (error) => {
        console.error("WebSocket xảy ra lỗi:", error);
    };


    // --------------------------------------
    // MẤT KẾT NỐI
    // --------------------------------------

    socket.onclose = () => {

        console.warn(
            "WebSocket đã ngắt kết nối. Đang thử kết nối lại..."
        );

        socket = null;

        scheduleReconnect();
    };
}


// ==========================================
// TỰ ĐỘNG KẾT NỐI LẠI
// ==========================================

function scheduleReconnect() {

    if (reconnectTimer) {
        return;
    }

    reconnectTimer = setTimeout(() => {

        reconnectTimer = null;

        connectWebSocket();

    }, 3000);
}


// ==========================================
// GỬI MESSAGE QUA WEBSOCKET
// ==========================================

function sendWebSocketMessage(data) {

    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {

        console.warn(
            "WebSocket chưa kết nối, không thể gửi dữ liệu"
        );

        return false;
    }

    try {

        socket.send(JSON.stringify(data));

        return true;

    } catch (error) {

        console.error(
            "Không thể gửi WebSocket message:",
            error
        );

        return false;
    }
}


// ==========================================
// KHỞI ĐỘNG
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("API:", API_BASE);
    console.log("WebSocket:", WS_URL);

    // Kết nối WebSocket
    connectWebSocket();

    // Lấy state lần đầu
    getState();

});


// ==========================================
// DỌN KẾT NỐI KHI ĐÓNG TRANG
// ==========================================

window.addEventListener("beforeunload", () => {

    if (socket) {

        socket.onclose = null;

        socket.close();

    }

});
