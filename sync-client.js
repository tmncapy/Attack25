/**
 * Universal Real-time Synchronizer for Panel Quiz Attack 25
 * Hỗ trợ Socket.io, Supabase Realtime, BroadcastChannel & LocalStorage Fallback.
 */

(function (window) {
    'use strict';

    // Cấu hình kết nối mặc định
    const CONFIG = {
        supabaseUrl: 'YOUR_SUPABASE_URL', // Thay bằng Supabase URL của bạn nếu dùng Supabase
        supabaseKey: 'YOUR_SUPABASE_ANON_KEY', // Thay bằng Anon Key của bạn
        serverHost: localStorage.getItem('attack25_ws_server_host') || window.location.host,
        channelName: 'panel_quiz_attack_25'
    };

    // State mặc định khởi tạo
    let gameState = {
        selectedPanel: null,
        panels: Array.from({ length: 25 }, (_, i) => ({ number: i + 1, used: false, color: null })),
        players: {
            red: { name: "PLAYER 1", score: 0 },
            green: { name: "PLAYER 2", score: 0 },
            white: { name: "PLAYER 3", score: 0 },
            blue: { name: "PLAYER 4", score: 0 }
        },
        buzzer: {
            status: 'locked', // 'locked' | 'armed' | 'buzzed'
            winner: null,
            buzzTime: null,
            pressOrder: [],
            lockedPlayers: []
        }
    };

    const listeners = {
        stateChange: [],
        sound: [],
        connection: []
    };

    let socket = null;
    let localChannel = null;
    let isConnected = false;

    // 1. Tải trạng thái đã lưu trước đó (nếu có)
    try {
        const saved = localStorage.getItem('attack25_gamestate');
        if (saved) gameState = JSON.parse(saved);
    } catch (e) {
        console.warn('Lỗi đọc LocalStorage:', e);
    }

    // 2. Thiết lập BroadcastChannel cho cùng trình duyệt/thiết bị
    if ('BroadcastChannel' in window) {
        localChannel = new BroadcastChannel(CONFIG.channelName);
        localChannel.onmessage = (event) => {
            if (event.data) handleIncomingMessage(event.data);
        };
    }

    // 3. Theo dõi biến đổi LocalStorage
    window.addEventListener('storage', (e) => {
        if (e.key === 'attack25_gamestate' && e.newValue) {
            try {
                handleIncomingMessage({ type: 'STATE_UPDATE', state: JSON.parse(e.newValue) });
            } catch (err) {}
        }
    });

    // 4. Khởi tạo kết nối Socket.io (khi deploy lên server Node.js / Render / Glitch)
    function initSocketIO() {
        if (typeof io !== 'undefined') {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
                const socketUrl = CONFIG.serverHost.startsWith('http') ? CONFIG.serverHost : `${window.location.protocol}//${CONFIG.serverHost}`;
                
                socket = io(socketUrl, {
                    transports: ['websocket', 'polling'],
                    reconnectionAttempts: 5,
                    timeout: 5000
                });

                socket.on('connect', () => {
                    isConnected = true;
                    notifyConnection(true, 'websocket');
                });

                socket.on('disconnect', () => {
                    isConnected = false;
                    notifyConnection(false, 'websocket');
                });

                socket.on('sync_state', (state) => {
                    handleIncomingMessage({ type: 'STATE_UPDATE', state: state });
                });

                socket.on('play_sound', (sound) => {
                    notifySound(sound);
                });

                socket.on('player_buzzed', (data) => {
                    if (data && data.player) processBuzz(data.player);
                });
            } catch (err) {
                console.warn('Socket.io không thể khởi tạo:', err);
                notifyConnection(false, 'local');
            }
        } else {
            notifyConnection(true, 'local');
        }
    }

    // 5. Khởi tạo kết nối Supabase Realtime (Nếu file html có import thư viện Supabase)
    function initSupabase() {
        if (window.supabase && CONFIG.supabaseUrl !== 'YOUR_SUPABASE_URL') {
            const client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
            const channel = client.channel(CONFIG.channelName);

            channel.on('broadcast', { event: 'sync' }, (payload) => {
                if (payload.payload) handleIncomingMessage(payload.payload);
            }).subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    isConnected = true;
                    notifyConnection(true, 'supabase');
                }
            });
        }
    }

    // Xử lý thông điệp nhận được
    function handleIncomingMessage(msg) {
        if (!msg) return;

        if (msg.type === 'STATE_UPDATE' && msg.state) {
            gameState = msg.state;
            saveStateToStorage(gameState);
            notifyStateChange(gameState);
        } else if (msg.type === 'PLAY_SOUND' && msg.sound) {
            notifySound(msg.sound);
        } else if (msg.type === 'PLAYER_BUZZ' && msg.player) {
            processBuzz(msg.player);
        }
    }

    // Xử lý logic bấm chuông
    function processBuzz(player) {
        if (gameState.buzzer.status !== 'armed') return;
        if (gameState.buzzer.lockedPlayers && gameState.buzzer.lockedPlayers.includes(player)) return;

        gameState.buzzer.status = 'buzzed';
        gameState.buzzer.winner = player;
        gameState.buzzer.buzzTime = (Math.random() * 0.2 + 0.1).toFixed(2);
        
        if (!gameState.buzzer.pressOrder.includes(player)) {
            gameState.buzzer.pressOrder.push(player);
        }

        broadcastState(gameState);
        broadcastSound(`buzz_${player}`);
    }

    // Lưu state xuống bộ nhớ tạm
    function saveStateToStorage(state) {
        try {
            localStorage.setItem('attack25_gamestate', JSON.stringify(state));
        } catch (e) {}
    }

    // Gửi thông báo cập nhật State tới tất cả thiết bị
    function broadcastState(state) {
        gameState = state;
        saveStateToStorage(state);
        notifyStateChange(state);

        const payload = { type: 'STATE_UPDATE', state: state };

        if (localChannel) localChannel.postMessage(payload);
        if (socket && socket.connected) socket.emit('update_state', state);
    }

    // Gửi tín hiệu âm thanh
    function broadcastSound(sound) {
        notifySound(sound);
        const payload = { type: 'PLAY_SOUND', sound: sound };

        if (localChannel) localChannel.postMessage(payload);
        if (socket && socket.connected) socket.emit('trigger_sound', sound);
    }

    // Gửi yêu cầu bấm chuông từ máy người chơi
    function sendPlayerBuzz(playerRole) {
        processBuzz(playerRole);
        const payload = { type: 'PLAYER_BUZZ', player: playerRole };

        if (localChannel) localChannel.postMessage(payload);
        if (socket && socket.connected) socket.emit('player_buzz', { player: playerRole });
    }

    // Quản lý Callback Listeners
    function notifyStateChange(state) {
        listeners.stateChange.forEach(fn => fn(state));
    }

    function notifySound(sound) {
        listeners.sound.forEach(fn => fn(sound));
    }

    function notifyConnection(status, mode) {
        listeners.connection.forEach(fn => fn({ connected: status, mode: mode }));
    }

    // Khởi chạy khi load xong DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initSocketIO();
            initSupabase();
        });
    } else {
        initSocketIO();
        initSupabase();
    }

    // API Export ra toàn cục (Attack25Sync)
    window.Attack25Sync = {
        getState: () => gameState,
        setState: broadcastState,
        playSound: broadcastSound,
        sendPlayerBuzz: sendPlayerBuzz,
        onStateChange: (fn) => {
            listeners.stateChange.push(fn);
            fn(gameState); // Gọi ngay lập tức dữ liệu hiện tại khi Đăng ký
        },
        onSound: (fn) => listeners.sound.push(fn),
        onConnectionChange: (fn) => listeners.connection.push(fn),
        setServerHost: (host) => {
            localStorage.setItem('attack25_ws_server_host', host);
            CONFIG.serverHost = host;
            initSocketIO();
        }
    };

})(window);