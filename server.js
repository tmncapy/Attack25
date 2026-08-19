import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

// Explicit named routes (case-insensitive and alias friendly)
app.get(['/host', '/host.html', '/Host.html', '/Host'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Host.html'));
});

app.get(['/projector', '/projector.html', '/Projector.html', '/Projector'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Projector.html'));
});

app.get(['/controller', '/controller.html', '/Controller.html', '/Controller', '/admin'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Controller.html'));
});

app.get(['/player1', '/player1.html', '/p1', '/red'], (req, res) => {
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

// Server Authoritative State
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
    status: 'locked',
    winner: null,
    buzzTime: null,
    pressOrder: [],
    lockedPlayers: []
  }
};

let questionsList = [
  { stt: 1, question: "Năm 2026 là năm con gì theo can chi?", answer: "Bính Ngọ (Con Ngựa)" },
  { stt: 2, question: "Đỉnh núi cao nhất Việt Nam là đỉnh núi nào?", answer: "Fansipan (3.143m)" },
  { stt: 3, question: "Hành tinh nào gần Mặt Trời nhất trong Hệ Mặt Trời?", answer: "Sao Thủy (Mercury)" },
  { stt: 4, question: "Bức họa nổi tiếng 'Mona Lisa' là tác phẩm của danh họa nào?", answer: "Leonardo da Vinci" },
  { stt: 5, question: "Kim loại nào dẫn điện tốt nhất ở điều kiện tiêu chuẩn?", answer: "Bạc (Ag)" }
];

let buzzerArmTime = null;

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Attack25',
    connections: wss ? wss.clients.size : 0,
    timestamp: Date.now()
  });
});

app.get('/api/state', (req, res) => {
  res.json({ state: gameState, questions: questionsList });
});

// Default route sends Controller.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Controller.html'));
});

// Fallback to Controller.html if route not found
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'Controller.html'));
});

// Create HTTP and WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(data, excludeWs = null) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
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

wss.on('connection', (ws) => {
  // Send current authoritative state on connection
  try {
    recalculateScores(gameState);
    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      state: gameState,
      questions: questionsList
    }));
  } catch (e) {}

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'GET_STATE') {
        recalculateScores(gameState);
        ws.send(JSON.stringify({
          type: 'INIT_STATE',
          state: gameState,
          questions: questionsList
        }));
      } else if (data.type === 'SYNC_STATE') {
        if (data.state) {
          gameState = data.state;
          recalculateScores(gameState);
          if (data.action === 'buzzer_armed') {
            buzzerArmTime = Date.now();
          }
        }
        // Broadcast to all other clients
        broadcast({
          type: 'SYNC_STATE',
          action: data.action,
          state: gameState,
          sound: data.sound
        }, ws);
      } else if (data.type === 'SYNC_QUESTIONS') {
        if (data.questions) {
          questionsList = data.questions;
        }
        broadcast({
          type: 'SYNC_QUESTIONS',
          questions: questionsList
        }, ws);
      } else if (data.type === 'PLAYER_BUZZ') {
        const player = data.player;
        if (gameState.buzzer.status === 'armed' && (!gameState.buzzer.lockedPlayers || !gameState.buzzer.lockedPlayers.includes(player))) {
          const now = Date.now();
          const elapsed = buzzerArmTime ? ((now - buzzerArmTime) / 1000).toFixed(3) : "0.150";

          if (!gameState.buzzer.winner) {
            gameState.buzzer.status = 'buzzed';
            gameState.buzzer.winner = player;
            gameState.buzzer.buzzTime = elapsed;
            gameState.buzzer.pressOrder = [{ player: player, time: elapsed }];

            // Broadcast winner buzz immediately to EVERYONE including sender with color sound
            broadcast({
              type: 'SYNC_STATE',
              action: 'buzzer_hit',
              state: gameState,
              sound: `buzzer_${player}`
            });
          } else {
            // Already someone buzzed, add to press order if not there
            if (!gameState.buzzer.pressOrder.some(p => p.player === player)) {
              gameState.buzzer.pressOrder.push({ player: player, time: elapsed });
              broadcast({
                type: 'SYNC_STATE',
                action: 'buzzer_order_update',
                state: gameState
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('error', () => {});
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Attack 25 synchronized server running on http://0.0.0.0:${PORT}`);
});
