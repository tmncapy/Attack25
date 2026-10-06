<?php
/**
 * Panel Quiz Attack 25 - Universal PHP Backend Fallback
 * Works seamlessly on Apache / LiteSpeed / Nginx / DirectAdmin / cPanel / XAMPP / Laragon
 */

// Enable CORS and disable caching
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dataDir = __DIR__ . '/uploads';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0777, true);
}

function getInitialGameState() {
    $panels = [];
    for ($i = 1; $i <= 25; $i++) {
        $panels[] = [
            'number' => $i,
            'used' => false,
            'color' => null
        ];
    }

    return [
        'panels' => $panels,
        'selectedPanel' => null,
        'currentQuestionIndex' => 0,
        'buzzer' => [
            'status' => 'locked',
            'winner' => null,
            'buzzTime' => null,
            'lockedPlayers' => [],
            'pressOrder' => [],
            'armTime' => null
        ],
        'players' => [
            'red' => ['name' => 'PLAYER 1', 'score' => 0],
            'green' => ['name' => 'PLAYER 2', 'score' => 0],
            'white' => ['name' => 'PLAYER 3', 'score' => 0],
            'blue' => ['name' => 'PLAYER 4', 'score' => 0]
        ],
        'hiddenColors' => ['red' => false, 'green' => false, 'white' => false, 'blue' => false],
        'video' => [
            'active' => false,
            'title' => '',
            'url' => '',
            'type' => 'intro',
            'playing' => false,
            'currentTime' => 0,
            'token' => 0
        ],
        'questionMedia' => [
            'type' => 'none',
            'url' => '',
            'images' => [],
            'totalDuration' => 20,
            'questionText' => '',
            'questionStt' => 1,
            'answer' => '',
            'playing' => true,
            'playToken' => 0
        ],
        'soundVolume' => 100
    ];
}

$defaultQuestions = [
    ['stt' => 1, 'question' => 'Năm 2026 là năm con gì theo can chi?', 'answer' => 'Bính Ngọ (Con Ngựa)'],
    ['stt' => 2, 'question' => 'Đỉnh núi cao nhất Việt Nam là đỉnh núi nào?', 'answer' => 'Fansipan (3.143m)'],
    ['stt' => 3, 'question' => 'Hành tinh nào gần Mặt Trời nhất trong Hệ Mặt Trời?', 'answer' => 'Sao Thủy (Mercury)'],
    ['stt' => 4, 'question' => "Bức họa nổi tiếng 'Mona Lisa' là tác phẩm của danh họa nào?", 'answer' => 'Leonardo da Vinci'],
    ['stt' => 5, 'question' => 'Kim loại nào dẫn điện tốt nhất ở điều kiện tiêu chuẩn?', 'answer' => 'Bạc (Ag)']
];

function getRoomFile($roomId) {
    global $dataDir;
    $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $roomId ?: '123456');
    return $dataDir . '/room_state_' . $safeId . '.json';
}

function loadRoom($roomId) {
    global $defaultQuestions;
    $file = getRoomFile($roomId);
    if (file_exists($file)) {
        $content = @file_get_contents($file);
        $data = json_decode($content, true);
        if (is_array($data)) {
            return $data;
        }
    }

    $initial = [
        'roomId' => $roomId ?: '123456',
        'passwords' => [
            'host' => '1234',
            'red' => '1111',
            'green' => '2222',
            'white' => '3333',
            'blue' => '4444'
        ],
        'state' => getInitialGameState(),
        'questions' => $defaultQuestions,
        'buzzerArmTime' => null
    ];
    @file_put_contents($file, json_encode($initial, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    return $initial;
}

function saveRoom($roomId, $data) {
    $file = getRoomFile($roomId);
    @file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function recalculateScores(&$state) {
    if (isset($state['panels']) && is_array($state['panels']) && isset($state['players'])) {
        foreach (['red', 'green', 'white', 'blue'] as $color) {
            $count = 0;
            foreach ($state['panels'] as $p) {
                if (isset($p['color']) && $p['color'] === $color) {
                    $count++;
                }
            }
            if (isset($state['players'][$color])) {
                $state['players'][$color]['score'] = $count;
            }
        }
    }
}

// Route handling
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: [];

$action = $_GET['action'] ?? $body['action'] ?? $body['type'] ?? '';
$action = strtolower(trim($action));

$roomId = $_GET['roomid'] ?? $_GET['roomId'] ?? $_GET['room'] ?? $body['roomId'] ?? $body['roomid'] ?? '123456';
$roomId = trim($roomId);
if (!$roomId) $roomId = '123456';

$room = loadRoom($roomId);

if ($action === 'health' || $action === 'status') {
    echo json_encode([
        'status' => 'ok',
        'backend' => 'php',
        'roomId' => $roomId,
        'time' => time()
    ]);
    exit();
}

if ($action === 'verify-room' || $action === 'verify') {
    $auth = $_GET['auth'] ?? $body['auth'] ?? '';
    $role = $_GET['role'] ?? $body['role'] ?? '';
    $role = strtolower(trim($role));
    if ($role === 'player1' || $role === 'p1') $role = 'red';
    if ($role === 'player2' || $role === 'p2') $role = 'green';
    if ($role === 'player3' || $role === 'p3') $role = 'white';
    if ($role === 'player4' || $role === 'p4') $role = 'blue';

    if ($role === 'projector' || $role === 'preview' || $auth === '1234' || (isset($room['passwords'][$role]) && $room['passwords'][$role] === $auth)) {
        echo json_encode([
            'success' => true,
            'roomId' => $roomId,
            'role' => $role,
            'passwords' => $room['passwords']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Mật khẩu không đúng!'
        ]);
    }
    exit();
}

if ($action === 'create-room' || $action === 'createroom') {
    $newRoomId = $body['roomId'] ?? $body['roomid'] ?? $_GET['roomId'] ?? $_GET['roomid'] ?? $roomId;
    $newPasswords = $body['passwords'] ?? [];
    if (!empty($newPasswords) && is_array($newPasswords)) {
        $room['passwords'] = array_merge($room['passwords'], $newPasswords);
        saveRoom($roomId, $room);
    }
    echo json_encode([
        'success' => true,
        'roomId' => $roomId,
        'passwords' => $room['passwords']
    ]);
    exit();
}

if ($action === 'upload-media' || $action === 'uploadmedia') {
    $fileName = $body['fileName'] ?? '';
    $dataUrl = $body['dataUrl'] ?? '';
    if ($fileName && $dataUrl && preg_match('/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/', $dataUrl, $matches)) {
        $bin = base64_decode($matches[2]);
        $ext = pathinfo($fileName, PATHINFO_EXTENSION) ?: 'bin';
        $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($fileName, PATHINFO_FILENAME)) . '.' . $ext;
        @file_put_contents($dataDir . '/' . $safeName, $bin);
        echo json_encode([
            'success' => true,
            'url' => 'uploads/' . $safeName,
            'fileName' => $fileName
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid dataUrl or fileName']);
    }
    exit();
}

if ($action === 'events') {
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');
    recalculateScores($room['state']);
    echo "data: " . json_encode([
        'channel' => 'attack25-sync-v3',
        'type' => 'state',
        'state' => $room['state'],
        'questions' => $room['questions'],
        'roomId' => $room['roomId']
    ], JSON_UNESCAPED_UNICODE) . "\n\n";
    @ob_flush();
    flush();
    exit();
}

if ($action === 'state' || $action === 'get_state' || $_SERVER['REQUEST_METHOD'] === 'GET') {
    recalculateScores($room['state']);
    echo json_encode([
        'state' => $room['state'],
        'questions' => $room['questions'],
        'roomId' => $room['roomId']
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

// POST sync action
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $type = $body['type'] ?? '';

    if ($type === 'state' || $type === 'SYNC_STATE' || isset($body['state'])) {
        $incomingState = $body['state'] ?? [];
        $subAction = $body['action'] ?? '';

        if (!empty($incomingState)) {
            if ($subAction === 'resetGame' || $subAction === 'reset_game') {
                $room['state'] = getInitialGameState();
            } else {
                if (isset($incomingState['panels']) && is_array($incomingState['panels'])) {
                    $room['state']['panels'] = $incomingState['panels'];
                }
                if (isset($incomingState['selectedPanel'])) {
                    $room['state']['selectedPanel'] = $incomingState['selectedPanel'];
                }
                if (isset($incomingState['currentQuestionIndex'])) {
                    $room['state']['currentQuestionIndex'] = $incomingState['currentQuestionIndex'];
                }
                if (isset($incomingState['buzzer'])) {
                    $room['state']['buzzer'] = array_merge($room['state']['buzzer'], $incomingState['buzzer']);
                }
                if (isset($incomingState['players'])) {
                    foreach ($incomingState['players'] as $k => $v) {
                        if (isset($v['name']) && trim($v['name']) !== '') {
                            $room['state']['players'][$k]['name'] = trim($v['name']);
                        }
                    }
                }
                if (isset($incomingState['video'])) {
                    $room['state']['video'] = array_merge($room['state']['video'], $incomingState['video']);
                }
                if (isset($incomingState['questionMedia'])) {
                    $room['state']['questionMedia'] = array_merge($room['state']['questionMedia'], $incomingState['questionMedia']);
                }
                if (isset($incomingState['hiddenColors'])) {
                    $room['state']['hiddenColors'] = $incomingState['hiddenColors'];
                }
                if (isset($incomingState['soundVolume'])) {
                    $room['state']['soundVolume'] = $incomingState['soundVolume'];
                }
            }

            if ($subAction === 'buzzer_armed' || $subAction === 'arm' || (isset($incomingState['buzzer']['status']) && $incomingState['buzzer']['status'] === 'armed')) {
                $room['buzzerArmTime'] = microtime(true);
            }

            recalculateScores($room['state']);
            saveRoom($roomId, $room);
        }

        echo json_encode([
            'success' => true,
            'state' => $room['state'],
            'questions' => $room['questions']
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($type === 'buzz' || $type === 'PLAYER_BUZZ' || $type === 'buzz_attempt') {
        $player = $body['player'] ?? '';
        $buzzer = &$room['state']['buzzer'];

        if ($buzzer['status'] === 'armed' && (!isset($buzzer['lockedPlayers']) || !in_array($player, $buzzer['lockedPlayers']))) {
            $now = microtime(true);
            $elapsed = $room['buzzerArmTime'] ? number_format($now - $room['buzzerArmTime'], 3) : '0.150';

            if (empty($buzzer['winner'])) {
                $buzzer['status'] = 'buzzed';
                $buzzer['winner'] = $player;
                $buzzer['buzzTime'] = $elapsed;
                $buzzer['pressOrder'] = [['player' => $player, 'time' => $elapsed]];
                saveRoom($roomId, $room);
            }
        }

        echo json_encode([
            'success' => true,
            'state' => $room['state']
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($type === 'questions' || $type === 'SYNC_QUESTIONS') {
        if (isset($body['questions']) && is_array($body['questions'])) {
            $room['questions'] = $body['questions'];
            saveRoom($roomId, $room);
        }
        echo json_encode([
            'success' => true,
            'questions' => $room['questions']
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    echo json_encode([
        'success' => true,
        'state' => $room['state']
    ], JSON_UNESCAPED_UNICODE);
    exit();
}
