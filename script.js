/**
 * Space Shooter - Arena Triangular
 * 
 * Controles:
 * - Teclado: WASD ou Setas para mover | ESPAÇO para atirar
 * - Mobile: Botões na tela
 * - Mouse/Toque: Atirar
 * 
 * Inimigos: Velocidade aumenta gradualmente com o tempo
 */

// ==================== CONFIGURAÇÕES ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WIDTH = 800;
const HEIGHT = 600;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// ==================== ESTADO DO JOGO ====================
let gameRunning = false;
let gameStarted = false;
let score = 0;
let kills = 0;
let lives = 3;
let gameTime = 0; // Tempo de jogo para aumentar dificuldade

// ==================== JOGADOR ====================
const player = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    radius: 12,
    angle: -Math.PI / 2,
    speed: 0,
    vx: 0,
    vy: 0,
    acceleration: 0.45,
    maxSpeed: 5.5,
    friction: 0.98,
    rotationSpeed: 0.12,
    invincibleTimer: 0
};

// ==================== TIROS ====================
let bullets = [];
let shootCooldown = 0;

// ==================== INIMIGOS ====================
let enemies = [];
let explosions = [];
let enemySpawnCounter = 0;
let enemyBaseSpeed = 0.8; // Velocidade base mais lenta

// ==================== MOBILE CONTROLS ====================
let mobileUp = false, mobileDown = false, mobileLeft = false, mobileRight = false;

// ==================== TECLAS ====================
const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    KeyW: false, KeyS: false, KeyA: false, KeyD: false,
    Space: false
};

// ==================== CLASSE DE EXPLOSÃO ====================
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 7,
                vy: (Math.random() - 0.5) * 7,
                life: 0.5,
                size: 2 + Math.random() * 4
            });
        }
        this.life = 0.5;
    }
    
    update(deltaTime) {
        this.life -= deltaTime;
        for (let p of this.particles) {
            p.x += p.vx * deltaTime * 60;
            p.y += p.vy * deltaTime * 60;
            p.life -= deltaTime;
        }
        return this.life > 0;
    }
    
    draw() {
        for (let p of this.particles) {
            ctx.globalAlpha = Math.min(1, p.life * 2);
            ctx.fillStyle = `hsl(${20 + Math.random() * 40}, 100%, 55%)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

// ==================== INIMIGO ====================
class Enemy {
    constructor(x, y, speedMultiplier = 1) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        // Velocidade base + aumento gradual baseado no tempo de jogo
        const currentSpeed = enemyBaseSpeed + (gameTime / 30);
        this.speed = Math.min(currentSpeed, 3.5) * speedMultiplier;
        this.angle = Math.atan2(player.y - y, player.x - x);
    }
    
    update(deltaTime) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        if (Math.hypot(dx, dy) > 0.01) {
            this.angle = Math.atan2(dy, dx);
            this.x += Math.cos(this.angle) * this.speed * deltaTime * 60;
            this.y += Math.sin(this.angle) * this.speed * deltaTime * 60;
        }
        return this.x > -50 && this.x < WIDTH + 50 && this.y > -50 && this.y < HEIGHT + 50;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Cor muda conforme a velocidade (quanto mais rápido, mais claro)
        const speedPercent = Math.min(1, (this.speed - 0.8) / 3);
        const r = 255;
        const g = 51 + Math.floor(204 * speedPercent);
        const b = 51 + Math.floor(100 * speedPercent);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ff3366';
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

// ==================== FUNÇÕES DO JOGADOR ====================
function updatePlayer(deltaTime) {
    // Teclado
    if (keys.ArrowLeft || keys.KeyA) player.angle -= player.rotationSpeed * deltaTime * 60;
    if (keys.ArrowRight || keys.KeyD) player.angle += player.rotationSpeed * deltaTime * 60;
    if (keys.ArrowUp || keys.KeyW) {
        player.vx += Math.cos(player.angle) * player.acceleration * deltaTime * 60;
        player.vy += Math.sin(player.angle) * player.acceleration * deltaTime * 60;
    }
    
    // Mobile
    if (mobileLeft) player.angle -= player.rotationSpeed * deltaTime * 60;
    if (mobileRight) player.angle += player.rotationSpeed * deltaTime * 60;
    if (mobileUp) {
        player.vx += Math.cos(player.angle) * player.acceleration * deltaTime * 60;
        player.vy += Math.sin(player.angle) * player.acceleration * deltaTime * 60;
    }
    
    // Atrito
    player.vx *= player.friction;
    player.vy *= player.friction;
    
    // Limitar velocidade
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > player.maxSpeed) {
        player.vx = (player.vx / speed) * player.maxSpeed;
        player.vy = (player.vy / speed) * player.maxSpeed;
    }
    
    // Posição
    player.x += player.vx * deltaTime * 60;
    player.y += player.vy * deltaTime * 60;
    
    // Teleporte nas bordas
    if (player.x < -30) player.x = WIDTH + 30;
    if (player.x > WIDTH + 30) player.x = -30;
    if (player.y < -30) player.y = HEIGHT + 30;
    if (player.y > HEIGHT + 30) player.y = -30;
    
    // Invencibilidade
    if (player.invincibleTimer > 0) {
        player.invincibleTimer -= deltaTime;
    }
    
    // Tecla Espaço para atirar
    if (keys.Space && gameRunning) {
        shoot();
    }
}

// ==================== TIROS ====================
function shoot() {
    if (!gameRunning) return;
    if (shootCooldown <= 0) {
        bullets.push({
            x: player.x + Math.cos(player.angle) * 18,
            y: player.y + Math.sin(player.angle) * 18,
            vx: Math.cos(player.angle) * 10,
            vy: Math.sin(player.angle) * 10,
            radius: 5,
            life: 1.5
        });
        shootCooldown = 10;
        playSound();
    }
}

function updateBullets(deltaTime) {
    for (let i = 0; i < bullets.length; i++) {
        bullets[i].x += bullets[i].vx * deltaTime * 60;
        bullets[i].y += bullets[i].vy * deltaTime * 60;
        bullets[i].life -= deltaTime;
        
        if (bullets[i].x < -50 || bullets[i].x > WIDTH + 50 || 
            bullets[i].y < -50 || bullets[i].y > HEIGHT + 50 ||
            bullets[i].life <= 0) {
            bullets.splice(i, 1);
            i--;
        }
    }
    
    if (shootCooldown > 0) shootCooldown -= deltaTime * 60;
}

// ==================== INIMIGOS ====================
function spawnEnemy() {
    let x, y;
    const side = Math.floor(Math.random() * 4);
    switch(side) {
        case 0: x = Math.random() * WIDTH; y = -30; break;
        case 1: x = WIDTH + 30; y = Math.random() * HEIGHT; break;
        case 2: x = Math.random() * WIDTH; y = HEIGHT + 30; break;
        default: x = -30; y = Math.random() * HEIGHT;
    }
    // Multiplicador de velocidade baseado no kills (quanto mais mata, mais rápido)
    const speedMultiplier = 1 + (kills / 100);
    enemies.push(new Enemy(x, y, speedMultiplier));
}

function updateEnemies(deltaTime) {
    // Spawn - fica mais frequente com o tempo
    let spawnDelay = Math.max(25, 50 - Math.floor(gameTime / 8) - Math.floor(kills / 15));
    if (enemySpawnCounter <= 0) {
        const spawnCount = Math.min(2 + Math.floor(kills / 25), 4);
        for (let i = 0; i < spawnCount; i++) {
            spawnEnemy();
        }
        enemySpawnCounter = spawnDelay;
    } else {
        enemySpawnCounter -= deltaTime * 60;
    }
    
    // Atualizar inimigos
    for (let i = 0; i < enemies.length; i++) {
        const active = enemies[i].update(deltaTime);
        if (!active) {
            enemies.splice(i, 1);
            i--;
        }
    }
}

// ==================== COLISÕES ====================
function checkCollisions() {
    // Balas vs Inimigos
    for (let i = 0; i < bullets.length; i++) {
        for (let j = 0; j < enemies.length; j++) {
            const dist = Math.hypot(bullets[i].x - enemies[j].x, bullets[i].y - enemies[j].y);
            if (dist < 12) {
                explosions.push(new Explosion(enemies[j].x, enemies[j].y));
                enemies.splice(j, 1);
                bullets.splice(i, 1);
                score += 10;
                kills++;
                updateUI();
                i--;
                break;
            }
        }
    }
    
    // Jogador vs Inimigos
    for (let i = 0; i < enemies.length; i++) {
        const dist = Math.hypot(player.x - enemies[i].x, player.y - enemies[i].y);
        if (dist < player.radius + enemies[i].radius) {
            if (player.invincibleTimer <= 0) {
                lives--;
                player.invincibleTimer = 1.5;
                explosions.push(new Explosion(player.x, player.y));
                updateUI();
                
                if (lives <= 0) {
                    gameRunning = false;
                    gameOver();
                }
            }
            enemies.splice(i, 1);
            i--;
        }
    }
    
    // Explosões
    for (let i = 0; i < explosions.length; i++) {
        const active = explosions[i].update(0.016);
        if (!active) {
            explosions.splice(i, 1);
            i--;
        }
    }
}

// ==================== RENDERIZAÇÃO ====================
function drawStars() {
    if (!window.stars) {
        window.stars = [];
        for (let i = 0; i < 150; i++) {
            window.stars.push({
                x: Math.random() * WIDTH,
                y: Math.random() * HEIGHT,
                size: 1 + Math.random() * 2,
                alpha: 0.3 + Math.random() * 0.7
            });
        }
    }
    for (let star of window.stars) {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Mostrar dificuldade atual
    if (gameRunning) {
        ctx.font = "12px monospace";
        ctx.fillStyle = "#ffffff88";
        ctx.shadowBlur = 0;
        ctx.fillText(`Velocidade: ${((enemyBaseSpeed + (gameTime / 30)) * (1 + kills/100)).toFixed(1)}`, 10, 50);
    }
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    
    if (player.invincibleTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    
    ctx.fillStyle = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.fill();
    
    // Rastro de propulsão
    if ((keys.ArrowUp || keys.KeyW || mobileUp) && gameRunning) {
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-12, -5);
        ctx.lineTo(-22, 0);
        ctx.lineTo(-12, 5);
        ctx.fill();
    }
    
    ctx.restore();
}

function drawBullets() {
    for (let b of bullets) {
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawEnemies() {
    for (let e of enemies) {
        e.draw();
    }
}

function drawExplosions() {
    for (let ex of explosions) {
        ex.draw();
    }
}

// ==================== UI ====================
function updateUI() {
    document.getElementById('livesValue').textContent = lives;
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('killsValue').textContent = kills;
}

function gameOver() {
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalKills').textContent = kills;
    document.getElementById('gameOverlay').classList.remove('hidden');
}

function restartGame() {
    gameRunning = true;
    gameStarted = true;
    score = 0;
    kills = 0;
    lives = 3;
    gameTime = 0;
    enemyBaseSpeed = 0.8;
    
    player.x = WIDTH / 2;
    player.y = HEIGHT / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.invincibleTimer = 0;
    
    bullets = [];
    enemies = [];
    explosions = [];
    shootCooldown = 0;
    enemySpawnCounter = 0;
    
    document.getElementById('gameUI').classList.remove('hidden');
    document.getElementById('instructions').classList.remove('hidden');
    document.getElementById('gameOverlay').classList.add('hidden');
    updateUI();
}

function startGame() {
    gameRunning = true;
    gameStarted = true;
    score = 0;
    kills = 0;
    lives = 3;
    gameTime = 0;
    enemyBaseSpeed = 0.8;
    
    player.x = WIDTH / 2;
    player.y = HEIGHT / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    
    bullets = [];
    enemies = [];
    explosions = [];
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameUI').classList.remove('hidden');
    document.getElementById('instructions').classList.remove('hidden');
    
    // Mostrar controles mobile se for touch
    if ('ontouchstart' in window) {
        document.getElementById('mobileControls').classList.add('show');
    }
    
    updateUI();
}

// ==================== SONS ====================
let audioCtx = null;

function playSound() {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.06;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
        osc.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
}

// ==================== CONTROLES ====================
// Teclado
document.addEventListener('keydown', (e) => {
    const code = e.code;
    if (keys.hasOwnProperty(code)) {
        keys[code] = true;
        e.preventDefault();
    }
    // Espaço para atirar
    if (code === 'Space') {
        keys.Space = true;
        if (gameRunning) shoot();
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    const code = e.code;
    if (keys.hasOwnProperty(code)) {
        keys[code] = false;
        e.preventDefault();
    }
    if (code === 'Space') {
        keys.Space = false;
        e.preventDefault();
    }
});

// Mouse para mirar
canvas.addEventListener('mousemove', (e) => {
    if (!gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
});

// Clique para atirar (desktop)
canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (gameRunning) {
        shoot();
    }
});

// Toque para atirar (mobile)
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning) {
        shoot();
    }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Controles Mobile (Botões)
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnShoot = document.getElementById('btnShoot');

if (btnUp) {
    btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); mobileUp = true; });
    btnUp.addEventListener('touchend', () => { mobileUp = false; });
    btnUp.addEventListener('mousedown', () => { mobileUp = true; });
    btnUp.addEventListener('mouseup', () => { mobileUp = false; });
    
    btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); mobileDown = true; });
    btnDown.addEventListener('touchend', () => { mobileDown = false; });
    btnDown.addEventListener('mousedown', () => { mobileDown = true; });
    btnDown.addEventListener('mouseup', () => { mobileDown = false; });
    
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); mobileLeft = true; });
    btnLeft.addEventListener('touchend', () => { mobileLeft = false; });
    btnLeft.addEventListener('mousedown', () => { mobileLeft = true; });
    btnLeft.addEventListener('mouseup', () => { mobileLeft = false; });
    
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); mobileRight = true; });
    btnRight.addEventListener('touchend', () => { mobileRight = false; });
    btnRight.addEventListener('mousedown', () => { mobileRight = true; });
    btnRight.addEventListener('mouseup', () => { mobileRight = false; });
    
    btnShoot.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameRunning) shoot();
    });
    btnShoot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning) shoot();
    });
}

// Iniciar áudio
canvas.addEventListener('click', () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
});

// Botões principais
document.getElementById('startButton').addEventListener('click', () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    startGame();
});

document.getElementById('restartButton').addEventListener('click', () => {
    restartGame();
});

// ==================== LOOP PRINCIPAL ====================
let lastTimestamp = 0;

function gameLoop(timestamp) {
    let deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000);
    if (deltaTime < 0.01) deltaTime = 0.016;
    
    // Atualizar tempo de jogo (para dificuldade)
    if (gameRunning && gameStarted) {
        gameTime += deltaTime;
        // Aumenta velocidade base dos inimigos gradualmente
        enemyBaseSpeed = 0.8 + (gameTime / 40);
        if (enemyBaseSpeed > 3.2) enemyBaseSpeed = 3.2;
    }
    
    // Limpar
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    drawStars();
    
    if (gameRunning && gameStarted) {
        updatePlayer(deltaTime);
        updateBullets(deltaTime);
        updateEnemies(deltaTime);
        checkCollisions();
        
        drawBullets();
        drawEnemies();
        drawPlayer();
        drawExplosions();
    } else if (gameStarted && !gameRunning) {
        drawBullets();
        drawEnemies();
        drawPlayer();
        drawExplosions();
    } else if (!gameStarted) {
        drawPlayer();
        if (enemies.length === 0 && Math.random() < 0.02) {
            spawnEnemy();
        }
        drawEnemies();
    }
    
    lastTimestamp = timestamp;
    requestAnimationFrame(gameLoop);
}

gameLoop(0);
