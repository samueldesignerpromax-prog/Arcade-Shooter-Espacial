/**
 * Space Shooter - Arcade Espacial
 * 
 * Controles:
 * - WASD ou Setas: Movimento da nave
 * - Mouse / Clique: Atirar
 * - Espaço ou E: Laser especial
 * 
 * Características:
 * - Inimigos com IA de perseguição
 * - Sistema de laser com recarga
 * - Power-ups (escudo, aumento de dano, recarga)
 * - Onda de inimigos crescente
 */

// ==================== CONFIGURAÇÕES ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WIDTH = 900;
const HEIGHT = 650;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// Cursor personalizado (esconder)
canvas.style.cursor = 'none';

// ==================== ESTADO DO JOGO ====================
let gameRunning = true;
let score = 0;
let highScore = localStorage.getItem('spaceHighScore') || 0;
let lives = 3;
let wave = 1;
let enemiesKilled = 0;
let invincibleTimer = 0;

// ==================== JOGADOR ====================
const player = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    radius: 14,
    angle: -Math.PI / 2, // Aponta para cima
    speed: 0,
    vx: 0,
    vy: 0,
    acceleration: 0.3,
    maxSpeed: 6,
    friction: 0.98,
    rotationSpeed: 0.1,
    invincibleTimer: 0,
    shield: false,
    shieldTimer: 0,
    damageBoost: false,
    damageBoostTimer: 0
};

// ==================== TIROS ====================
let bullets = [];
let lasers = [];
let enemies = [];
let explosions = [];
let powerups = [];

let shootCooldown = 0;
let laserCooldown = 0;
let laserEnergy = 100;
let laserMaxEnergy = 100;
let laserRechargeRate = 15; // por segundo

// ==================== PARÂMETROS DE JOGO ====================
let enemySpawnCounter = 0;
let enemySpawnDelay = 60; // frames
let mouseX = WIDTH / 2;
let mouseY = HEIGHT / 2;
let mousePressed = false;
let spacePressed = false;

// ==================== CLASSES ====================

// Classe de Partícula de Explosão
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 0.5,
                size: 2 + Math.random() * 3
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
            ctx.fillStyle = `hsl(${30 + Math.random() * 30}, 100%, 60%)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

// Classe do Inimigo Base
class Enemy {
    constructor(x, y, type = 'normal') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 12;
        this.health = this.getHealth();
        this.speed = this.getSpeed();
        this.angle = Math.atan2(player.y - y, player.x - x);
        this.shootCooldown = 0;
        this.color = this.getColor();
    }
    
    getHealth() {
        switch(this.type) {
            case 'normal': return 1;
            case 'fast': return 1;
            case 'heavy': return 3;
            case 'shooter': return 2;
            default: return 1;
        }
    }
    
    getSpeed() {
        switch(this.type) {
            case 'normal': return 1.5;
            case 'fast': return 3;
            case 'heavy': return 0.8;
            case 'shooter': return 1.2;
            default: return 1.5;
        }
    }
    
    getColor() {
        switch(this.type) {
            case 'normal': return '#ff3366';
            case 'fast': return '#ff9933';
            case 'heavy': return '#9933ff';
            case 'shooter': return '#33ff66';
            default: return '#ff3366';
        }
    }
    
    update(deltaTime) {
        // Perseguir jogador
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01) {
            this.angle = Math.atan2(dy, dx);
            this.x += Math.cos(this.angle) * this.speed * deltaTime * 60;
            this.y += Math.sin(this.angle) * this.speed * deltaTime * 60;
        }
        
        // Atirar (apenas shooter)
        if (this.type === 'shooter') {
            if (this.shootCooldown <= 0 && dist < 400) {
                this.shootCooldown = 45;
                const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
                enemyBullets.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angleToPlayer) * 4,
                    vy: Math.sin(angleToPlayer) * 4,
                    radius: 4
                });
            } else {
                this.shootCooldown -= deltaTime * 60;
            }
        }
        
        return this.x > -50 && this.x < WIDTH + 50 && this.y > -50 && this.y < HEIGHT + 50;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Desenhar nave inimiga
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-8, -8);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fill();
        
        // Detalhes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(5, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Barra de vida para heavy
        if (this.type === 'heavy') {
            ctx.fillStyle = '#333';
            ctx.fillRect(-10, -15, 20, 4);
            ctx.fillStyle = '#ff3366';
            ctx.fillRect(-10, -15, 20 * (this.health / 3), 4);
        }
        
        ctx.restore();
    }
    
    takeDamage(amount) {
        this.health -= amount;
        return this.health <= 0;
    }
}

// Classe Power-up
class Powerup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'shield', 'damage', 'laser'
        this.radius = 10;
        this.life = 8; // segundos para desaparecer
    }
    
    update(deltaTime) {
        this.life -= deltaTime;
        return this.life > 0;
    }
    
    draw() {
        ctx.save();
        ctx.shadowBlur = 8;
        
        switch(this.type) {
            case 'shield':
                ctx.fillStyle = '#00ffff';
                ctx.shadowColor = '#00ffff';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = '16px Arial';
                ctx.fillText('🛡️', this.x - 8, this.y + 6);
                break;
            case 'damage':
                ctx.fillStyle = '#ff6600';
                ctx.shadowColor = '#ff6600';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = '16px Arial';
                ctx.fillText('⚔️', this.x - 8, this.y + 6);
                break;
            case 'laser':
                ctx.fillStyle = '#ffcc00';
                ctx.shadowColor = '#ffcc00';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = '16px Arial';
                ctx.fillText('⚡', this.x - 8, this.y + 6);
                break;
        }
        ctx.restore();
    }
    
    apply() {
        switch(this.type) {
            case 'shield':
                player.shield = true;
                player.shieldTimer = 8;
                break;
            case 'damage':
                player.damageBoost = true;
                player.damageBoostTimer = 10;
                break;
            case 'laser':
                laserEnergy = Math.min(laserMaxEnergy, laserEnergy + 50);
                updateUI();
                break;
        }
    }
}

// Array de balas inimigas
let enemyBullets = [];

// ==================== FUNÇÕES DO JOGADOR ====================
function movePlayer(deltaTime) {
    // Movimento com teclas
    if (keys.ArrowLeft || keys.KeyA) player.angle -= player.rotationSpeed * deltaTime * 60;
    if (keys.ArrowRight || keys.KeyD) player.angle += player.rotationSpeed * deltaTime * 60;
    if (keys.ArrowUp || keys.KeyW) {
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
    
    // Atualizar posição
    player.x += player.vx * deltaTime * 60;
    player.y += player.vy * deltaTime * 60;
    
    // Teleporte nas bordas
    if (player.x < -30) player.x = WIDTH + 30;
    if (player.x > WIDTH + 30) player.x = -30;
    if (player.y < -30) player.y = HEIGHT + 30;
    if (player.y > HEIGHT + 30) player.y = -30;
    
    // Timers de power-ups
    if (player.shieldTimer > 0) {
        player.shieldTimer -= deltaTime;
        if (player.shieldTimer <= 0) player.shield = false;
    }
    if (player.damageBoostTimer > 0) {
        player.damageBoostTimer -= deltaTime;
        if (player.damageBoostTimer <= 0) player.damageBoost = false;
    }
    if (player.invincibleTimer > 0) {
        player.invincibleTimer -= deltaTime;
    }
}

function shoot() {
    if (!gameRunning) return;
    if (shootCooldown <= 0) {
        const damage = player.damageBoost ? 2 : 1;
        bullets.push({
            x: player.x + Math.cos(player.angle) * 20,
            y: player.y + Math.sin(player.angle) * 20,
            vx: Math.cos(player.angle) * 8,
            vy: Math.sin(player.angle) * 8,
            radius: 4,
            damage: damage
        });
        shootCooldown = 8;
        playSound(880, 0.05);
    }
}

function shootLaser() {
    if (!gameRunning) return;
    if (laserEnergy >= 20 && laserCooldown <= 0) {
        laserEnergy -= 20;
        const damage = (player.damageBoost ? 3 : 2);
        lasers.push({
            x: player.x + Math.cos(player.angle) * 25,
            y: player.y + Math.sin(player.angle) * 25,
            vx: Math.cos(player.angle) * 14,
            vy: Math.sin(player.angle) * 14,
            radius: 6,
            damage: damage,
            life: 1.5
        });
        laserCooldown = 10;
        playSound(1318, 0.1);
        updateUI();
    }
}

// ==================== ATUALIZAÇÃO DOS TIROS ====================
function updateBullets(deltaTime) {
    for (let i = 0; i < bullets.length; i++) {
        bullets[i].x += bullets[i].vx * deltaTime * 60;
        bullets[i].y += bullets[i].vy * deltaTime * 60;
        
        if (bullets[i].x < -50 || bullets[i].x > WIDTH + 50 || 
            bullets[i].y < -50 || bullets[i].y > HEIGHT + 50) {
            bullets.splice(i, 1);
            i--;
        }
    }
    
    for (let i = 0; i < lasers.length; i++) {
        lasers[i].x += lasers[i].vx * deltaTime * 60;
        lasers[i].y += lasers[i].vy * deltaTime * 60;
        lasers[i].life -= deltaTime;
        
        if (lasers[i].life <= 0 || lasers[i].x < -100 || lasers[i].x > WIDTH + 100 || 
            lasers[i].y < -100 || lasers[i].y > HEIGHT + 100) {
            lasers.splice(i, 1);
            i--;
        }
    }
    
    // Atualizar balas inimigas
    for (let i = 0; i < enemyBullets.length; i++) {
        enemyBullets[i].x += enemyBullets[i].vx * deltaTime * 60;
        enemyBullets[i].y += enemyBullets[i].vy * deltaTime * 60;
        
        if (enemyBullets[i].x < -50 || enemyBullets[i].x > WIDTH + 50 || 
            enemyBullets[i].y < -50 || enemyBullets[i].y > HEIGHT + 50) {
            enemyBullets.splice(i, 1);
            i--;
        }
    }
}

// ==================== COLISÕES ====================
function checkCollisions() {
    // Colisão balas com inimigos
    for (let i = 0; i < bullets.length; i++) {
        for (let j = 0; j < enemies.length; j++) {
            const dist = Math.hypot(bullets[i].x - enemies[j].x, bullets[i].y - enemies[j].y);
            if (dist < 15) {
                const destroyed = enemies[j].takeDamage(bullets[i].damage);
                bullets.splice(i, 1);
                i--;
                if (destroyed) {
                    // Criar explosão
                    explosions.push(new Explosion(enemies[j].x, enemies[j].y));
                    enemies.splice(j, 1);
                    j--;
                    score += 10 * wave;
                    enemiesKilled++;
                    updateUI();
                    
                    // Chance de drop de power-up (15%)
                    if (Math.random() < 0.15) {
                        const types = ['shield', 'damage', 'laser'];
                        const type = types[Math.floor(Math.random() * types.length)];
                        powerups.push(new Powerup(enemies[j]?.x || 0, enemies[j]?.y || 0, type));
                    }
                }
                break;
            }
        }
    }
    
    // Colisão lasers com inimigos (penetrantes)
    for (let i = 0; i < lasers.length; i++) {
        for (let j = 0; j < enemies.length; j++) {
            const dist = Math.hypot(lasers[i].x - enemies[j].x, lasers[i].y - enemies[j].y);
            if (dist < 20) {
                const destroyed = enemies[j].takeDamage(lasers[i].damage);
                if (destroyed) {
                    explosions.push(new Explosion(enemies[j].x, enemies[j].y));
                    enemies.splice(j, 1);
                    j--;
                    score += 10 * wave;
                    enemiesKilled++;
                    updateUI();
                }
                // Laser continua (penetra)
            }
        }
    }
    
    // Colisão jogador com inimigos
    for (let i = 0; i < enemies.length; i++) {
        const dist = Math.hypot(player.x - enemies[i].x, player.y - enemies[i].y);
        if (dist < player.radius + enemies[i].radius) {
            if (player.invincibleTimer <= 0 && !player.shield) {
                lives--;
                player.invincibleTimer = 1.5;
                updateUI();
                playSound(220, 0.15);
                
                if (lives <= 0) {
                    gameRunning = false;
                    gameOver();
                }
                explosions.push(new Explosion(player.x, player.y));
            }
            enemies.splice(i, 1);
            i--;
        }
    }
    
    // Colisão jogador com balas inimigas
    for (let i = 0; i < enemyBullets.length; i++) {
        const dist = Math.hypot(player.x - enemyBullets[i].x, player.y - enemyBullets[i].y);
        if (dist < player.radius + enemyBullets[i].radius) {
            if (player.invincibleTimer <= 0 && !player.shield) {
                lives--;
                player.invincibleTimer = 1.5;
                updateUI();
                playSound(220, 0.15);
                
                if (lives <= 0) {
                    gameRunning = false;
                    gameOver();
                }
            }
            enemyBullets.splice(i, 1);
            i--;
        }
    }
    
    // Coletar power-ups
    for (let i = 0; i < powerups.length; i++) {
        const dist = Math.hypot(player.x - powerups[i].x, player.y - powerups[i].y);
        if (dist < player.radius + powerups[i].radius) {
            powerups[i].apply();
            powerups.splice(i, 1);
            i--;
            playSound(1046, 0.08);
        }
    }
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
    
    // Determinar tipo baseado na onda
    let type = 'normal';
    const rand = Math.random();
    if (wave >= 3 && rand < 0.25) type = 'shooter';
    else if (wave >= 2 && rand < 0.3) type = 'fast';
    else if (wave >= 4 && rand < 0.2) type = 'heavy';
    
    enemies.push(new Enemy(x, y, type));
}

function updateEnemies(deltaTime) {
    // Spawn de inimigos
    if (enemySpawnCounter <= 0) {
        const spawnCount = Math.min(2 + Math.floor(wave / 3), 5);
        for (let i = 0; i < spawnCount; i++) {
            spawnEnemy();
        }
        enemySpawnCounter = Math.max(40, enemySpawnDelay - Math.floor(wave * 2));
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
    
    // Atualizar power-ups
    for (let i = 0; i < powerups.length; i++) {
        const active = powerups[i].update(deltaTime);
        if (!active) {
            powerups.splice(i, 1);
            i--;
        }
    }
    
    // Atualizar explosões
    for (let i = 0; i < explosions.length; i++) {
        const active = explosions[i].update(deltaTime);
        if (!active) {
            explosions.splice(i, 1);
            i--;
        }
    }
    
    // Aumentar onda a cada 10 inimigos derrotados
    const newWave = Math.floor(enemiesKilled / 10) + 1;
    if (newWave > wave) {
        wave = newWave;
        updateUI();
        playSound(523, 0.1);
    }
}

// ==================== RENDERIZAÇÃO ====================
function drawStars() {
    for (let i = 0; i < 200; i++) {
        if (!window.stars) {
            window.stars = [];
            for (let j = 0; j < 200; j++) {
                window.stars.push({
                    x: Math.random() * WIDTH,
                    y: Math.random() * HEIGHT,
                    size: 1 + Math.random() * 2,
                    alpha: 0.5 + Math.random() * 0.5
                });
            }
        }
        const star = window.stars[i];
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    
    // Efeito de invencibilidade (piscar)
    if (player.invincibleTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    
    // Escudo
    if (player.shield) {
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffff33';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Nave do jogador
    ctx.fillStyle = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    
    // Detalhes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Rastro de partículas
    if (keys.ArrowUp || keys.KeyW) {
        for (let i = 0; i < 2; i++) {
            ctx.fillStyle = `rgba(0, 255, 255, ${0.5 - i * 0.2})`;
            ctx.beginPath();
            ctx.ellipse(-15, (i - 0.5) * 5, 5, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    ctx.restore();
}

function drawBullets() {
    for (let b of bullets) {
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    for (let l of lasers) {
        ctx.fillStyle = '#ff00ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.radius - 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    for (let eb of enemyBullets) {
        ctx.fillStyle = '#ff6600';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(eb.x, eb.y, eb.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.shadowBlur = 0;
}

function drawPowerups() {
    for (let p of powerups) {
        p.draw();
    }
}

function drawUI() {
    // Power-ups ativos
    if (player.shield && player.shieldTimer > 0) {
        const powerupDiv = document.getElementById('powerupsUI');
        powerupDiv.innerHTML = '<div class="powerup-icon">🛡️ ESCUDO ' + player.shieldTimer.toFixed(1) + 's</div>';
    } else if (player.damageBoost && player.damageBoostTimer > 0) {
        const powerupDiv = document.getElementById('powerupsUI');
        powerupDiv.innerHTML = '<div class="powerup-icon">⚔️ ATAQUE+ ' + player.damageBoostTimer.toFixed(1) + 's</div>';
    } else {
        document.getElementById('powerupsUI').innerHTML = '';
    }
}

// ==================== UI ====================
function updateUI() {
    document.getElementById('livesValue').textContent = lives;
    document.getElementById('scoreValue').textContent = Math.floor(score);
    document.getElementById('enemiesValue').textContent = enemies.length;
    document.getElementById('waveValue').textContent = wave;
    document.getElementById('highScoreValue').textContent = highScore;
    
    const laserPercent = (laserEnergy / laserMaxEnergy) * 100;
    document.getElementById('laserBarFill').style.width = `${laserPercent}%`;
}

function gameOver() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('spaceHighScore', highScore);
    }
    document.getElementById('finalScore').textContent = Math.floor(score);
    document.getElementById('finalKills').textContent = enemiesKilled;
    document.getElementById('finalWave').textContent = wave;
    document.getElementById('gameOverlay').classList.remove('hidden');
}

function restartGame() {
    gameRunning = true;
    score = 0;
    lives = 3;
    wave = 1;
    enemiesKilled = 0;
    laserEnergy = laserMaxEnergy;
    player.x = WIDTH / 2;
    player.y = HEIGHT / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.shield = false;
    player.damageBoost = false;
    player.invincibleTimer = 0;
    bullets = [];
    lasers = [];
    enemies = [];
    explosions = [];
    powerups = [];
    enemyBullets = [];
    shootCooldown = 0;
    laserCooldown = 0;
    enemySpawnCounter = 0;
    
    updateUI();
    document.getElementById('gameOverlay').classList.add('hidden');
}

// ==================== SONS ====================
let audioContext = null;

function playSound(frequency, volume) {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = frequency;
        gain.gain.value = volume;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.15);
        osc.stop(audioContext.currentTime + 0.15);
    } catch(e) {}
}

// ==================== CONTROLES ====================
const keys = {};

document.addEventListener('keydown', (e) => {
    const code = e.code;
    keys[code] = true;
    
    if (code === 'Space' || code === 'KeyE') {
        shootLaser();
        e.preventDefault();
    }
    if (code === 'KeyQ') {
        // Atirar com Q (alternativo)
        shoot();
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Mouse controle
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
    
    // Apontar para o mouse
    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
});

canvas.addEventListener('mousedown', (e) => {
    mousePressed = true;
    shoot();
});

canvas.addEventListener('mouseup', () => {
    mousePressed = false;
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

// Atirar continuamente com mouse pressionado
let lastShootFrame = 0;
function handleMouseShoot() {
    if (mousePressed && gameRunning) {
        if (shootCooldown <= 0) {
            shoot();
        }
    }
}

// Mobile controls
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnShoot = document.getElementById('btnShoot');
const btnLaser = document.getElementById('btnLaser');

let mobileUp = false, mobileDown = false, mobileLeft = false, mobileRight = false;

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
    
    btnShoot.addEventListener('click', () => shoot());
    btnLaser.addEventListener('click', () => shootLaser());
}

function handleMobileMovement() {
    if (mobileUp) {
        player.vx += Math.cos(player.angle) * player.acceleration;
        player.vy += Math.sin(player.angle) * player.acceleration;
    }
    if (mobileLeft) player.angle -= player.rotationSpeed;
    if (mobileRight) player.angle += player.rotationSpeed;
}

// ==================== LOOP PRINCIPAL ====================
let lastTimestamp = 0;
let lastFrameTime = 0;

function gameLoop(timestamp) {
    let deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000);
    if (deltaTime < 0.01) deltaTime = 0.016;
    
    if (gameRunning) {
        // Atualizações
        movePlayer(deltaTime);
        handleMouseShoot();
        handleMobileMovement();
        
        // Recarga do laser
        if (laserEnergy < laserMaxEnergy) {
            laserEnergy += laserRechargeRate * deltaTime;
            if (laserEnergy > laserMaxEnergy) laserEnergy = laserMaxEnergy;
            updateUI();
        }
        if (shootCooldown > 0) shootCooldown -= deltaTime * 60;
        if (laserCooldown > 0) laserCooldown -= deltaTime * 60;
        
        updateBullets(deltaTime);
        updateEnemies(deltaTime);
        checkCollisions();
        
        // Atualizar UI de power-ups
        drawUI();
    }
    
    // Renderização
    drawStars();
    drawPowerups();
    drawBullets();
    for (let e of enemies) e.draw();
    drawPlayer();
    for (let ex of explosions) ex.draw();
    
    lastTimestamp = timestamp;
    requestAnimationFrame(gameLoop);
}

// ==================== INICIALIZAÇÃO ====================
function init() {
    updateUI();
    gameLoop(0);
    
    // Iniciar áudio
    canvas.addEventListener('click', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    });
    
    // Botão reiniciar
    document.getElementById('restartButton').addEventListener('click', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        restartGame();
    });
    
    // Mostrar controles mobile
    if ('ontouchstart' in window) {
        document.getElementById('mobileControls').style.display = 'flex';
    }
}

init();
