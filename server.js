import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Ensure uploads folder exists and serve it statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/SFX', express.static(path.join(__dirname, 'SFX')));

// Upload media endpoint for local videos and slideshow images
app.post('/api/upload-media', (req, res) => {
  try {
    const { fileName, dataUrl } = req.body;
    if (!dataUrl || !fileName) {
      return res.status(400).json({ error: 'Missing fileName or dataUrl' });
    }
    const matches = dataUrl.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid data URL format' });
    }
    const buffer = Buffer.from(matches[2], 'base64');
    const ext = path.extname(fileName) || '.bin';
    const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = `${Date.now()}_${baseName}${ext}`;
    const filePath = path.join(uploadsDir, safeFileName);
    fs.writeFileSync(filePath, buffer);

    return res.json({
      success: true,
      url: `/uploads/${safeFileName}`,
      fileName: fileName,
      size: buffer.length
    });
  } catch (err) {
    console.error('Error in /api/upload-media:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Enable CORS for all local and remote origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Explicit named routes
app.get(['/', '/index', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get(['/host', '/host.html', '/Host.html', '/Host'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Host.html'));
});

app.get(['/projector', '/projector.html', '/Projector.html', '/Projector'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Projector.html'));
});

app.get(['/controller', '/controller.html', '/Controller.html', '/Controller', '/admin'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Controller.html'));
});

app.get(['/player', '/player.html', '/Player.html', '/Player'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Player.html'));
});

app.get(['/player1', '/player1.html', '/Player1.html', '/p1', '/red'], (req, res) => {
  res.sendFile(path.join(__dirname, 'player1.html'));
});

app.get(['/player2', '/player2.html', '/p2', '/green'], (req, res) => {
  res.sendFile(path.join(__dirname, 'player2.html'));
});

app.get(['/player3', '/player3.html', '/p3', '/white'], (req, res) => {
  res.sendFile(path.join(__dirname, 'player3.html'));
});

app.get(['/player4', '/player4.html', '/p4', '/blue'], (req, res) => {
  res.sendFile(path.join(__dirname, 'player4.html'));
});

app.use(express.static(__dirname));

// Server Authoritative State per Room
function createInitialGameState() {
  return {
    currentQuestionIndex: 0,
    selectedPanel: null,
    panels: Array.from({ length: 25 }, (_, i) => ({ number: i + 1, used: false, color: null })),
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
      playing: false,
      visible: false,
      startTime: null,
      playToken: null,
      loop: true
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
    soundVolume: 100
  };
}

const defaultQuestions = [
  { stt: 1, question: "Năm 2026 là năm con gì theo can chi?", answer: "Bính Ngọ (Con Ngựa)" },
  { stt: 2, question: "Đỉnh núi cao nhất Việt Nam là đỉnh núi nào?", answer: "Fansipan (3.143m)" },
  { stt: 3, question: "Hành tinh nào gần Mặt Trời nhất trong Hệ Mặt Trời?", answer: "Sao Thủy (Mercury)" },
  { stt: 4, question: "Bức họa nổi tiếng 'Mona Lisa' là tác phẩm của danh họa nào?", answer: "Leonardo da Vinci" },
  { stt: 5, question: "Kim loại nào dẫn điện tốt nhất ở điều kiện tiêu chuẩn?", answer: "Bạc (Ag)" }
];

// Room storage: Map<roomId, RoomData>
const rooms = new Map();

function getOrCreateRoom(roomId, passwords = null) {
  roomId = String(roomId || '123456').trim();
  if (!roomId) roomId = '123456';
  
  if (!rooms.has(roomId)) {
    const defaultPasswords = {
      host: "1234",
      red: "1111",
      green: "2222",
      white: "3333",
      blue: "4444"
    };
    rooms.set(roomId, {
      roomId,
      passwords: passwords ? { ...defaultPasswords, ...passwords } : defaultPasswords,
      state: createInitialGameState(),
      questions: [...defaultQuestions],
      buzzerArmTime: null
    });
  } else if (passwords) {
    const room = rooms.get(roomId);
    room.passwords = { ...room.passwords, ...passwords };
  }
  return rooms.get(roomId);
}

// Create default room for testing
getOrCreateRoom("123456");

function verifyRoomCredentials(roomId, auth, role) {
  roomId = String(roomId || '').trim();
  auth = String(auth || '').trim();
  role = String(role || '').toLowerCase().trim();

  if (!roomId) {
    return { success: false, message: 'Mã phòng không được để trống!' };
  }

  if (role === 'player1' || role === 'p1') role = 'red';
  if (role === 'player2' || role === 'p2') role = 'green';
  if (role === 'player3' || role === 'p3') role = 'white';
  if (role === 'player4' || role === 'p4') role = 'blue';

  // If room is not in memory, gracefully initialize it with default passwords
  const room = getOrCreateRoom(roomId);

  if (role === 'projector' || role === 'preview') {
    return { success: true, roomId, role, passwords: room.passwords };
  }

  if (!role || !room.passwords[role]) {
    return { success: false, message: 'Vai trò không hợp lệ!' };
  }

  // Allow correct role password, or master host password '1234', or host's password
  if (room.passwords[role] === auth || room.passwords.host === auth || auth === '1234') {
    return { success: true, roomId, role, passwords: room.passwords };
  }

  return { success: false, message: 'Mật khẩu không đúng!' };
}

app.post('/api/create-room', (req, res) => {
  const roomId = String(req.body?.roomId || req.body?.roomid || req.body?.room || '').trim();
  const passwords = req.body?.passwords || null;
  if (!roomId || roomId.length !== 6) {
    return res.status(400).json({ success: false, message: 'Mã phòng phải gồm 6 chữ số!' });
  }
  const room = getOrCreateRoom(roomId, passwords);
  res.json({ success: true, roomId: room.roomId, passwords: room.passwords });
});

app.post('/api/verify-room', (req, res) => {
  const roomId = req.body?.roomId || req.body?.roomid || req.body?.room;
  const auth = req.body?.auth;
  const role = req.body?.role;
  const result = verifyRoomCredentials(roomId, auth, role);
  res.json(result);
});

app.get('/api/verify-room', (req, res) => {
  const roomId = req.query.roomid || req.query.roomId || req.query.room;
  const auth = req.query.auth;
  const role = req.query.role;
  const result = verifyRoomCredentials(roomId, auth, role);
  res.json(result);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Attack25',
    activeRooms: rooms.size,
    connections: wss ? wss.clients.size : 0,
    timestamp: Date.now()
  });
});

app.get('/api/state', (req, res) => {
  const roomId = String(req.query.roomid || req.query.roomId || req.query.room || '123456').trim();
  const room = getOrCreateRoom(roomId);
  recalculateScores(room.state);
  res.json({ state: room.state, questions: room.questions, roomId: room.roomId });
});

// Create HTTP and WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 100 * 1024 * 1024 });

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

function broadcastToRoom(roomId, data, excludeWs = null) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.roomId === roomId && client !== excludeWs && client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (e) {}
    }
  });
}

function recalculateScores(state) {
  if (state && state.panels && Array.isArray(state.panels) && state.players) {
    ['red', 'green', 'white', 'blue'].forEach(color => {
      const count = state.panels.filter(p => p.color === color).length;
      if (state.players[color]) {
        state.players[color].score = count;
      }
    });
  }
}

// WebSocket Heartbeat / Keepalive
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      try { ws.terminate(); } catch (e) {}
      return;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  });
}, 25000);

server.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (ws, request) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Extract initial roomId from URL if present
  let initialRoomId = '123456';
  try {
    if (request && request.url) {
      const parsedUrl = new URL(request.url, 'http://localhost:3000');
      const qRoom = parsedUrl.searchParams.get('roomid') || parsedUrl.searchParams.get('roomId') || parsedUrl.searchParams.get('room');
      if (qRoom) initialRoomId = String(qRoom).trim();
    }
  } catch (e) {}

  ws.roomId = initialRoomId;
  const room = getOrCreateRoom(ws.roomId);

  // Send current state to newly connected client immediately
  try {
    recalculateScores(room.state);
    ws.send(JSON.stringify({
      channel: 'attack25-sync-v3',
      type: 'state',
      roomId: room.roomId,
      state: room.state,
      questions: room.questions
    }));
  } catch (e) {}

  ws.on('message', (message) => {
    try {
      ws.isAlive = true;
      const data = JSON.parse(message.toString());
      const roomId = String(data.roomId || ws.roomId || '123456').trim();
      ws.roomId = roomId;
      const currentRoom = getOrCreateRoom(roomId);

      if (data.type === 'CREATE_ROOM') {
        if (data.roomId && data.passwords) {
          getOrCreateRoom(String(data.roomId).trim(), data.passwords);
          ws.send(JSON.stringify({
            channel: 'attack25-sync-v3',
            type: 'ROOM_CREATED',
            roomId: data.roomId,
            success: true
          }));
        }
      } else if (data.type === 'GET_STATE') {
        recalculateScores(currentRoom.state);
        ws.send(JSON.stringify({
          channel: 'attack25-sync-v3',
          type: 'state',
          roomId: currentRoom.roomId,
          state: currentRoom.state,
          questions: currentRoom.questions
        }));
      } else if (data.type === 'SYNC_STATE' || data.type === 'state') {
        if (data.state) {
          currentRoom.state = data.state;
          recalculateScores(currentRoom.state);
          if (data.action === 'buzzer_armed' || data.action === 'arm') {
            currentRoom.buzzerArmTime = Date.now();
          }
        }
        broadcastToRoom(currentRoom.roomId, {
          channel: 'attack25-sync-v3',
          type: 'state',
          roomId: currentRoom.roomId,
          action: data.action,
          state: currentRoom.state,
          sound: data.sound,
          msgId: data.msgId || ('srv_state_' + Date.now())
        }, ws);
      } else if (data.type === 'SYNC_QUESTIONS' || data.type === 'questions') {
        if (data.questions) {
          currentRoom.questions = data.questions;
        }
        broadcastToRoom(currentRoom.roomId, {
          channel: 'attack25-sync-v3',
          type: 'questions',
          roomId: currentRoom.roomId,
          questions: currentRoom.questions,
          msgId: data.msgId || ('srv_q_' + Date.now())
        }, ws);
      } else if (data.type === 'PLAYER_BUZZ' || data.type === 'buzz') {
        const player = data.player;
        if (currentRoom.state.buzzer.status === 'armed' && (!currentRoom.state.buzzer.lockedPlayers || !currentRoom.state.buzzer.lockedPlayers.includes(player))) {
          const now = Date.now();
          const elapsed = currentRoom.buzzerArmTime ? ((now - currentRoom.buzzerArmTime) / 1000).toFixed(3) : "0.150";

          if (!currentRoom.state.buzzer.winner) {
            currentRoom.state.buzzer.status = 'buzzed';
            currentRoom.state.buzzer.winner = player;
            currentRoom.state.buzzer.buzzTime = elapsed;
            currentRoom.state.buzzer.pressOrder = [{ player: player, time: elapsed }];

            broadcastToRoom(currentRoom.roomId, {
              channel: 'attack25-sync-v3',
              type: 'state',
              roomId: currentRoom.roomId,
              action: 'buzzer_hit',
              state: currentRoom.state,
              sound: `buzzer_${player}`,
              msgId: 'srv_buzz_' + Date.now() + '_' + player
            });
          } else {
            if (!currentRoom.state.buzzer.pressOrder.some(p => p.player === player)) {
              currentRoom.state.buzzer.pressOrder.push({ player: player, time: elapsed });
              broadcastToRoom(currentRoom.roomId, {
                channel: 'attack25-sync-v3',
                type: 'state',
                roomId: currentRoom.roomId,
                action: 'buzzer_order_update',
                state: currentRoom.state,
                msgId: 'srv_order_' + Date.now()
              });
            }
          }
        }
      } else if (data.type === 'sound') {
        broadcastToRoom(currentRoom.roomId, {
          channel: 'attack25-sync-v3',
          type: 'sound',
          roomId: currentRoom.roomId,
          sound: data.sound,
          msgId: data.msgId || ('srv_snd_' + Date.now())
        }, ws);
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('error', () => {});
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Attack 25 room-scoped server running on http://0.0.0.0:${PORT}`);
});
