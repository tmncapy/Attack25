import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
  roomId?: string;
}

interface PlayerState {
  name: string;
  score: number;
}

interface BuzzerOrder {
  player: string;
  time: string;
}

interface GameState {
  currentQuestionIndex: number;
  selectedPanel: number | null;
  panels: Array<{ number: number; used: boolean; color: string | null }>;
  players: {
    red: PlayerState;
    green: PlayerState;
    white: PlayerState;
    blue: PlayerState;
    [key: string]: PlayerState;
  };
  buzzer: {
    status: string;
    winner: string | null;
    buzzTime: string | null;
    pressOrder: BuzzerOrder[];
    lockedPlayers: string[];
  };
  video: {
    mode: string;
    url: string;
    embedUrl: string;
    videoName: string;
    images: string[];
    totalDuration: number;
    playing: boolean;
    visible: boolean;
    startTime: number | null;
    playToken: number | null;
    loop: boolean;
  };
  questionMedia: {
    visible: boolean;
    type: string;
    url: string;
    images: string[];
    totalDuration: number;
    questionText: string;
    questionStt: number;
    answer: string;
    playing: boolean;
    playToken: number;
  };
  soundVolume: number;
  [key: string]: any;
}

interface RoomData {
  roomId: string;
  passwords: {
    host: string;
    red: string;
    green: string;
    white: string;
    blue: string;
    [key: string]: string;
  };
  state: GameState;
  questions: Array<{ stt: number; question: string; answer: string; [key: string]: any }>;
  buzzerArmTime: number | null;
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase body limit for large base64 uploads (media, sounds, questions)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Ensure uploads folder exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/SFX', express.static(path.join(process.cwd(), 'SFX')));

// Upload media endpoint for local videos, audio and slideshow images
app.post('/api/upload-media', (req: Request, res: Response) => {
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
  } catch (err: any) {
    console.error('Error in /api/upload-media:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Enable CORS for all local and remote origins
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Server Authoritative State per Room
function createInitialGameState(): GameState {
  return {
    currentQuestionIndex: 0,
    selectedPanel: null,
    panels: Array.from({ length: 25 }, (_, i) => ({ number: i + 1, used: false, color: null })),
    players: {
      red: { name: 'PLAYER 1', score: 0 },
      green: { name: 'PLAYER 2', score: 0 },
      white: { name: 'PLAYER 3', score: 0 },
      blue: { name: 'PLAYER 4', score: 0 }
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
  { stt: 1, question: 'Năm 2026 là năm con gì theo can chi?', answer: 'Bính Ngọ (Con Ngựa)' },
  { stt: 2, question: 'Đỉnh núi cao nhất Việt Nam là đỉnh núi nào?', answer: 'Fansipan (3.143m)' },
  { stt: 3, question: 'Hành tinh nào gần Mặt Trời nhất trong Hệ Mặt Trời?', answer: 'Sao Thủy (Mercury)' },
  { stt: 4, question: "Bức họa nổi tiếng 'Mona Lisa' là tác phẩm của danh họa nào?", answer: 'Leonardo da Vinci' },
  { stt: 5, question: 'Kim loại nào dẫn điện tốt nhất ở điều kiện tiêu chuẩn?', answer: 'Bạc (Ag)' }
];

// Room storage: Map<roomId, RoomData>
const rooms = new Map<string, RoomData>();

function getOrCreateRoom(roomId: string, passwords: any = null): RoomData {
  let cleanRoomId = String(roomId || '123456').trim();
  if (!cleanRoomId) cleanRoomId = '123456';

  if (!rooms.has(cleanRoomId)) {
    const defaultPasswords = {
      host: '1234',
      red: '1111',
      green: '2222',
      white: '3333',
      blue: '4444'
    };
    rooms.set(cleanRoomId, {
      roomId: cleanRoomId,
      passwords: passwords ? { ...defaultPasswords, ...passwords } : defaultPasswords,
      state: createInitialGameState(),
      questions: [...defaultQuestions],
      buzzerArmTime: null
    });
  } else if (passwords) {
    const room = rooms.get(cleanRoomId)!;
    room.passwords = { ...room.passwords, ...passwords };
  }
  return rooms.get(cleanRoomId)!;
}

// Create default room for testing
getOrCreateRoom('123456');

function verifyRoomCredentials(roomId: any, auth: any, role: any) {
  const cleanRoomId = String(roomId || '').trim();
  const cleanAuth = String(auth || '').trim();
  let cleanRole = String(role || '').toLowerCase().trim();

  if (!cleanRoomId) {
    return { success: false, message: 'Mã phòng không được để trống!' };
  }

  if (cleanRole === 'player1' || cleanRole === 'p1') cleanRole = 'red';
  if (cleanRole === 'player2' || cleanRole === 'p2') cleanRole = 'green';
  if (cleanRole === 'player3' || cleanRole === 'p3') cleanRole = 'white';
  if (cleanRole === 'player4' || cleanRole === 'p4') cleanRole = 'blue';

  const room = getOrCreateRoom(cleanRoomId);

  if (cleanRole === 'projector' || cleanRole === 'preview') {
    return { success: true, roomId: cleanRoomId, role: cleanRole, passwords: room.passwords };
  }

  if (!cleanRole || !room.passwords[cleanRole]) {
    return { success: false, message: 'Vai trò không hợp lệ!' };
  }

  // Allow correct role password, or master host password '1234', or host's password
  if (room.passwords[cleanRole] === cleanAuth || room.passwords.host === cleanAuth || cleanAuth === '1234') {
    return { success: true, roomId: cleanRoomId, role: cleanRole, passwords: room.passwords };
  }

  return { success: false, message: 'Mật khẩu không đúng!' };
}

function recalculateScores(state: GameState) {
  if (state && state.panels && Array.isArray(state.panels) && state.players) {
    ['red', 'green', 'white', 'blue'].forEach((color) => {
      const count = state.panels.filter((p) => p.color === color).length;
      if (state.players[color]) {
        state.players[color].score = count;
      }
    });
  }
}

// REST APIs
app.post('/api/create-room', (req: Request, res: Response) => {
  const roomId = String(req.body?.roomId || req.body?.roomid || req.body?.room || '').trim();
  const passwords = req.body?.passwords || null;
  if (!roomId || roomId.length !== 6) {
    return res.status(400).json({ success: false, message: 'Mã phòng phải gồm 6 chữ số!' });
  }
  const room = getOrCreateRoom(roomId, passwords);
  res.json({ success: true, roomId: room.roomId, passwords: room.passwords });
});

app.post('/api/verify-room', (req: Request, res: Response) => {
  const roomId = req.body?.roomId || req.body?.roomid || req.body?.room;
  const auth = req.body?.auth;
  const role = req.body?.role;
  const result = verifyRoomCredentials(roomId, auth, role);
  res.json(result);
});

app.get('/api/verify-room', (req: Request, res: Response) => {
  const roomId = req.query.roomid || req.query.roomId || req.query.room;
  const auth = req.query.auth;
  const role = req.query.role;
  const result = verifyRoomCredentials(roomId, auth, role);
  res.json(result);
});

app.get('/api/state', (req: Request, res: Response) => {
  const roomId = String(req.query.roomid || req.query.roomId || req.query.room || '123456').trim();
  const room = getOrCreateRoom(roomId);
  recalculateScores(room.state);
  res.json({ state: room.state, questions: room.questions, roomId: room.roomId });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Attack 25 Multi-Role Server',
    activeRooms: rooms.size,
    timestamp: Date.now()
  });
});

// Explicit Role Page Routes
function serveFileIfExists(res: Response, fileNames: string[]) {
  for (const fileName of fileNames) {
    const fullPath = path.join(process.cwd(), fileName);
    if (fs.existsSync(fullPath)) {
      return res.sendFile(fullPath);
    }
  }
  res.sendFile(path.join(process.cwd(), 'index.html'));
}

app.get(['/', '/index', '/index.html'], (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

app.get(['/host', '/host.html', '/Host.html', '/Host'], (_req: Request, res: Response) => {
  serveFileIfExists(res, ['Host.html', 'host.html']);
});

app.get(['/projector', '/projector.html', '/Projector.html', '/Projector'], (_req: Request, res: Response) => {
  serveFileIfExists(res, ['Projector.html', 'projector.html']);
});

app.get(['/controller', '/controller.html', '/Controller.html', '/Controller', '/admin'], (_req: Request, res: Response) => {
  serveFileIfExists(res, ['Controller.html', 'controller.html']);
});

app.get(['/player', '/player.html', '/Player.html', '/Player'], (_req: Request, res: Response) => {
  serveFileIfExists(res, ['Player.html', 'player.html']);
});

app.get(['/player1', '/player1.html', '/Player1.html', '/p1', '/red'], (_req: Request, res: Response) => {
  serveFileIfExists(res, ['player1.html', 'Player1.html']);
});

app.get(['/player2', '/player2.html', '/Player2.html', '/p2', '/green'], (_req: Request, res: Response) => {
  serveFileIfExists(res, ['player2.html', 'Player2.html']);
});

app.get(['/player3', '/player3.html', '/Player3.html', '/p3', '/white'], (_req: Request, res: Response) => {
  serveFileIfExists(res, ['player3.html', 'Player3.html']);
});

app.get(['/player4', '/player4.html', '/Player4.html', '/p4', '/blue'], (_req: Request, res: Response) => {
  serveFileIfExists(res, ['player4.html', 'Player4.html']);
});

// Serve root static files (sync-client.js, sound files, images, etc.)
app.use(express.static(process.cwd()));

// ==========================================
// START SERVER WITH WEBSOCKET SUPPORT
// ==========================================
async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 100 * 1024 * 1024 });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  function broadcastToRoom(roomId: string, data: any, excludeWs: CustomWebSocket | null = null) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      const wsClient = client as CustomWebSocket;
      if (wsClient.roomId === roomId && wsClient !== excludeWs && wsClient.readyState === WebSocket.OPEN) {
        try {
          wsClient.send(message);
        } catch (e) {}
      }
    });
  }

  // WebSocket Heartbeat / Keepalive
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as CustomWebSocket;
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch (e) {}
        return;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (e) {}
    });
  }, 25000);

  server.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: CustomWebSocket, request) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Extract initial roomId from URL if present
    let initialRoomId = '123456';
    try {
      if (request && request.url) {
        const parsedUrl = new URL(request.url, 'http://localhost:3000');
        const qRoom =
          parsedUrl.searchParams.get('roomid') ||
          parsedUrl.searchParams.get('roomId') ||
          parsedUrl.searchParams.get('room');
        if (qRoom) initialRoomId = String(qRoom).trim();
      }
    } catch (e) {}

    ws.roomId = initialRoomId;
    const room = getOrCreateRoom(ws.roomId);

    // Send current state to newly connected client immediately
    try {
      recalculateScores(room.state);
      ws.send(
        JSON.stringify({
          channel: 'attack25-sync-v3',
          type: 'state',
          roomId: room.roomId,
          state: room.state,
          questions: room.questions
        })
      );
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
            ws.send(
              JSON.stringify({
                channel: 'attack25-sync-v3',
                type: 'ROOM_CREATED',
                roomId: data.roomId,
                success: true
              })
            );
          }
        } else if (data.type === 'GET_STATE') {
          recalculateScores(currentRoom.state);
          ws.send(
            JSON.stringify({
              channel: 'attack25-sync-v3',
              type: 'state',
              roomId: currentRoom.roomId,
              state: currentRoom.state,
              questions: currentRoom.questions
            })
          );
        } else if (data.type === 'SYNC_STATE' || data.type === 'state') {
          if (data.state) {
            currentRoom.state = data.state;
            recalculateScores(currentRoom.state);
            if (data.action === 'buzzer_armed' || data.action === 'arm') {
              currentRoom.buzzerArmTime = Date.now();
            }
          }
          broadcastToRoom(
            currentRoom.roomId,
            {
              channel: 'attack25-sync-v3',
              type: 'state',
              roomId: currentRoom.roomId,
              action: data.action,
              state: currentRoom.state,
              sound: data.sound,
              msgId: data.msgId || 'srv_state_' + Date.now()
            },
            ws
          );
        } else if (data.type === 'SYNC_QUESTIONS' || data.type === 'questions') {
          if (data.questions) {
            currentRoom.questions = data.questions;
          }
          broadcastToRoom(
            currentRoom.roomId,
            {
              channel: 'attack25-sync-v3',
              type: 'questions',
              roomId: currentRoom.roomId,
              questions: currentRoom.questions,
              msgId: data.msgId || 'srv_q_' + Date.now()
            },
            ws
          );
        } else if (data.type === 'PLAYER_BUZZ' || data.type === 'buzz') {
          const player = data.player;
          if (
            currentRoom.state.buzzer.status === 'armed' &&
            (!currentRoom.state.buzzer.lockedPlayers || !currentRoom.state.buzzer.lockedPlayers.includes(player))
          ) {
            const now = Date.now();
            const elapsed = currentRoom.buzzerArmTime
              ? ((now - currentRoom.buzzerArmTime) / 1000).toFixed(3)
              : '0.150';

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
              if (!currentRoom.state.buzzer.pressOrder.some((p) => p.player === player)) {
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
          broadcastToRoom(
            currentRoom.roomId,
            {
              channel: 'attack25-sync-v3',
              type: 'sound',
              roomId: currentRoom.roomId,
              sound: data.sound,
              msgId: data.msgId || 'srv_snd_' + Date.now()
            },
            ws
          );
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('error', () => {});
  });

  // Serve dist static assets if available (production build)
  const distPath = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Panel Quiz Attack 25 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
});
