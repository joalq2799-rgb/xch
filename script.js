// 游戏常量
const GAME_DURATION = 120; // 游戏时长（秒）
const BUBBLE_TYPES = [
    { duration: 1500, color: '#87ceeb', score: 10, penalty: 50, probability: 0.35 },   // 浅天蓝色
    { duration: 1200, color: '#20b2aa', score: 30, penalty: 40, probability: 0.25 },   // 淡青色
    { duration: 1000, color: '#98fb98', score: 50, penalty: 30, probability: 0.20 },   // 嫩绿色
    { duration: 500, color: '#ffa500', score: 70, penalty: 20, probability: 0.15 },    // 暖橙色
    { duration: 300, color: '#9370db', score: 90, penalty: 10, probability: 0.04 },    // 亮紫色
    { duration: 200, color: '#ff6b6b', score: 100, penalty: 5, probability: 0.01 }     // 正红色
];

// 生成间隔配置
const GENERATION_INTERVALS = [
    { count: 10, interval: 2000 },  // 第1-10个，间隔2秒
    { count: 20, interval: 1500 },  // 第11-20个，间隔1.5秒
    { count: 30, interval: 1000 },  // 第21-30个，间隔1秒
    { count: Infinity, interval: 500 } // 第31个及以后，间隔0.5秒
];

// 游戏状态
let canvas, ctx;
let bubbles = [];
let score = 0;
let timeRemaining = GAME_DURATION;
let bubbleCount = 0;
let poppedBubbles = 0;
let timeoutBubbles = 0;
let errorActions = 0;
let gameInterval;
let bubbleGenerationInterval;
let countdownInterval;
let isGameRunning = false;
let isGamePaused = false;
let isSoundEnabled = true;
let keysPressed = new Set();

// 音效（使用Web Audio API模拟）
let audioContext;
let popSounds = [];
let errorSounds = [];
let scoreSounds = [];
let currentPopIndex = 0;
let currentErrorIndex = 0;
let currentScoreIndex = 0;

// 初始化游戏
function initGame() {
    // 获取Canvas元素
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // 设置Canvas尺寸
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 初始化音频
    initAudio();
    
    // 添加事件监听器
    addEventListeners();
    
    // 显示开始界面
    showStartScreen();
}

// 调整Canvas尺寸
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// 初始化音频
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 预创建多个音频源以避免冲突
        popSounds = [];
        errorSounds = [];
        scoreSounds = [];
        
        // 创建多个音频源实例
        for (let i = 0; i < 3; i++) {
            popSounds.push(createTone(1200, 0.15, 'square', 0.2));
            errorSounds.push(createTone(200, 0.2, 'sawtooth', 0.05));
            scoreSounds.push(createTone(800, 0.2, 'sine', 0.2));
        }
        
        // 当前使用的索引
        currentPopIndex = 0;
        currentErrorIndex = 0;
        currentScoreIndex = 0;
    } catch (e) {
        console.warn('Web Audio API not supported, sounds disabled');
        isSoundEnabled = false;
    }
}

// 创建音调
function createTone(frequency, duration, type, volume = 0.2) {
    return function() {
        if (!isSoundEnabled || !audioContext) return;
        
        try {
            // 如果音频上下文被挂起，恢复它
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            
            // 设置音量和包络
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        } catch (e) {
            console.warn('Error playing sound:', e);
        }
    };
}

// 添加事件监听器
function addEventListeners() {
    // 键盘事件
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('keyup', handleKeyRelease);
    
    // 按钮事件
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('backToStartBtn').addEventListener('click', backToStart);
    document.getElementById('soundToggle').addEventListener('click', toggleSound);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('resumeBtn').addEventListener('click', resumeGame);
    document.getElementById('pauseHomeBtn').addEventListener('click', pauseToHome);
    document.getElementById('homeBtn').addEventListener('click', pauseToHome);
    
    // 点击事件（用于错误扣分）
    canvas.addEventListener('click', handleCanvasClick);
}

// 处理键盘按下
function handleKeyPress(event) {
    const key = event.key.toLowerCase();
    
    // 如果游戏未运行，忽略
    if (!isGameRunning) return;
    
    // 防止重复按键
    if (keysPressed.has(key)) return;
    keysPressed.add(key);
    
    // 检查是否击中泡泡
    const hitBubble = checkBubbleHit(key);
    
    if (!hitBubble) {
        // 按错键，扣分
        handleErrorAction();
    }
}

// 处理键盘释放
function handleKeyRelease(event) {
    const key = event.key.toLowerCase();
    keysPressed.delete(key);
}

// 处理画布点击
function handleCanvasClick(event) {
    if (!isGameRunning) return;
    
    // 点击空白处扣分
    handleErrorAction();
}

// 检查是否击中泡泡
function checkBubbleHit(key) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        if (bubble.letter.toLowerCase() === key) {
            // 击中泡泡
            popBubble(i);
            return true;
        }
    }
    return false;
}

// 击破泡泡
function popBubble(index) {
    const bubble = bubbles[index];
    
    // 播放音效
    if (bubble.score >= 90) {
        // 高分泡泡使用特殊音效
        playScoreSound();
    } else {
        playPopSound();
    }
    
    // 增加分数
    score += bubble.score;
    poppedBubbles++;
    
    // 显示分数动画
    showScoreAnimation(bubble.x, bubble.y, bubble.score, 'positive');
    
    // 更新UI
    updateUI();
    
    // 移除泡泡
    bubbles.splice(index, 1);
}

// 处理错误操作
function handleErrorAction() {
    errorActions++;
    score = Math.max(0, score - 5); // 扣分但不低于0
    
    // 播放错误音效
    playErrorSound();
    
    // 显示扣分动画
    showScoreAnimation(canvas.width / 2, canvas.height / 2, -5, 'negative');
    
    // 更新UI
    updateUI();
}

// 生成泡泡
function generateBubble() {
    if (!isGameRunning) return;
    
    bubbleCount++;
    
    // 根据概率选择泡泡类型
    const bubbleType = selectBubbleType();
    
    // 随机位置（全屏随机生成）
    const margin = 80;
    const x = Math.random() * (canvas.width - margin * 2) + margin;
    const y = Math.random() * (canvas.height - margin * 2) + margin;
    
    // 随机字母
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const letter = letters[Math.floor(Math.random() * letters.length)];
    
    // 创建泡泡对象
    const bubble = {
        x: x,
        y: y,
        letter: letter,
        type: bubbleType,
        size: 60 + Math.random() * 20, // 随机大小
        speed: 1 + Math.random() * 2, // 随机速度
        rotation: 0, // 不旋转
        rotationSpeed: 0, // 不旋转
        createdAt: Date.now(),
        lifeLeft: bubbleType.duration,
        alpha: 1,
        particles: [] // 用于爆炸效果
    };
    
    bubbles.push(bubble);
    

}

// 选择泡泡类型
function selectBubbleType() {
    const rand = Math.random();
    let cumulativeProbability = 0;
    
    for (const type of BUBBLE_TYPES) {
        cumulativeProbability += type.probability;
        if (rand <= cumulativeProbability) {
            return type;
        }
    }
    
    return BUBBLE_TYPES[0]; // 默认返回第一种类型
}

// 获取当前生成间隔
function getCurrentGenerationInterval() {
    for (const interval of GENERATION_INTERVALS) {
        if (bubbleCount <= interval.count) {
            return interval.interval;
        }
    }
    return 500; // 默认0.5秒
}

// 更新泡泡
function updateBubbles() {
    const currentTime = Date.now();
    
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        
        // 轻微浮动效果（不再向上移动）
        bubble.y += Math.sin(Date.now() * 0.001 + bubble.x) * 0.5;
        bubble.rotation += bubble.rotationSpeed;
        
        // 更新生命周期
        bubble.lifeLeft = bubble.type.duration - (currentTime - bubble.createdAt);
        
        // 检查是否超时
        if (bubble.lifeLeft <= 0) {
            // 泡泡超时，扣分
            score = Math.max(0, score - bubble.type.penalty);
            timeoutBubbles++;
            
            // 显示扣分动画
            showScoreAnimation(bubble.x, bubble.y, -bubble.type.penalty, 'negative');
            
            // 更新UI
            updateUI();
            
            // 移除泡泡
            bubbles.splice(i, 1);
            continue;
        }
        
        // 更新透明度（生命周期最后20%时开始淡出）
        if (bubble.lifeLeft < bubble.type.duration * 0.2) {
            bubble.alpha = bubble.lifeLeft / (bubble.type.duration * 0.2);
        }
        
        // 移除超出屏幕的泡泡
        if (bubble.x < -100 || bubble.x > canvas.width + 100 ||
            bubble.y < -100 || bubble.y > canvas.height + 100) {
            bubbles.splice(i, 1);
        }
    }
}

// 绘制游戏
function drawGame() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制背景效果
    drawBackground();
    
    // 绘制泡泡
    drawBubbles();
    
    // 绘制粒子效果
    drawParticles();
}

// 绘制背景
function drawBackground() {
    // 绘制渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(102, 126, 234, 0.1)');
    gradient.addColorStop(1, 'rgba(118, 75, 162, 0.1)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制星星效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 2;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 绘制泡泡
function drawBubbles() {
    bubbles.forEach(bubble => {
        ctx.save();
        
        // 设置透明度
        ctx.globalAlpha = bubble.alpha;
        
        // 移动到泡泡中心
        ctx.translate(bubble.x, bubble.y);
        ctx.rotate(bubble.rotation);
        
        // 绘制泡泡阴影
        ctx.shadowColor = bubble.type.color;
        ctx.shadowBlur = 20;
        
        // 绘制泡泡外圈
        const gradient = ctx.createRadialGradient(
            -bubble.size * 0.2, -bubble.size * 0.2, 0,
            0, 0, bubble.size
        );
        gradient.addColorStop(0, bubble.type.color);
        gradient.addColorStop(1, bubble.type.color + '40');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, bubble.size, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(-bubble.size * 0.3, -bubble.size * 0.3, bubble.size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // 特殊效果
        if (bubble.type.score === 90) {
            // 紫色泡泡的微光效果
            ctx.shadowColor = bubble.type.color;
            ctx.shadowBlur = 30;
        } else if (bubble.type.score === 100) {
            // 红色泡泡的闪烁效果
            const flash = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
            ctx.globalAlpha *= (flash * 0.5 + 0.5);
        }
        
        // 绘制字母
        ctx.fillStyle = 'white';
        ctx.font = `bold ${bubble.size * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bubble.letter.toUpperCase(), 0, 0);
        
        ctx.restore();
    });
}

// 绘制粒子效果
function drawParticles() {
    // 这里可以添加粒子系统
}

// 显示分数动画
function showScoreAnimation(x, y, points, type) {
    const scoreElement = document.createElement('div');
    scoreElement.className = 'score-animation';
    scoreElement.textContent = points > 0 ? `+${points}` : points;
    scoreElement.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        color: ${type === 'positive' ? '#48bb78' : '#e53e3e'};
        font-size: 1.5rem;
        font-weight: bold;
        pointer-events: none;
        z-index: 1000;
        animation: scorePopup 1s ease-out forwards;
    `;
    
    document.body.appendChild(scoreElement);
    
    // 动画结束后移除
    setTimeout(() => {
        if (scoreElement.parentNode) {
            scoreElement.parentNode.removeChild(scoreElement);
        }
    }, 1000);
}



// 更新UI
function updateUI() {
    // 确保元素存在后再更新
    const scoreElement = document.getElementById('currentScore');
    const timeElement = document.getElementById('timeRemaining');
    const bubblesElement = document.getElementById('bubblesCount');
    
    if (scoreElement) {
        scoreElement.textContent = score;
    } else {
        console.warn('Score element not found');
    }
    
    if (timeElement) {
        timeElement.textContent = timeRemaining;
    } else {
        console.warn('Time element not found');
    }
    
    if (bubblesElement) {
        bubblesElement.textContent = poppedBubbles;
    } else {
        console.warn('Bubbles element not found');
    }
}

// 游戏主循环
function gameLoop() {
    if (!isGameRunning || isGamePaused) return;
    
    // 更新泡泡
    updateBubbles();
    
    // 绘制游戏
    drawGame();
    
    // 实时更新UI
    updateUI();
    
    // 检查游戏是否结束
    if (timeRemaining <= 0) {
        gameOver();
    }
}

// 倒计时更新
function updateCountdown() {
    if (!isGameRunning || isGamePaused) return;
    
    timeRemaining--;
    updateUI();
    
    // 最后10秒显示警告
    if (timeRemaining <= 10) {
        const timeElement = document.getElementById('timeRemaining');
        timeElement.style.color = '#e53e3e';
        timeElement.style.animation = 'blink 0.5s ease-in-out infinite';
    }
}

// 开始游戏
function startGame() {
    // 隐藏开始界面
    document.getElementById('startScreen').classList.add('hidden');
    
    // 重置游戏状态
    resetGameState();
    
    // 开始游戏
    isGameRunning = true;
    
    // 启动游戏循环
    gameInterval = setInterval(gameLoop, 16); // 60 FPS
    
    // 启动倒计时
    setInterval(updateCountdown, 1000);
    
    // 开始生成泡泡
    startBubbleGeneration();
    
    // 如果音频上下文被挂起，恢复它
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// 重置游戏状态
function resetGameState() {
    bubbles = [];
    score = 0;
    timeRemaining = GAME_DURATION;
    bubbleCount = 0;
    poppedBubbles = 0;
    timeoutBubbles = 0;
    errorActions = 0;
    keysPressed.clear();
    
    // 重置UI
    document.getElementById('currentScore').textContent = '0';
    document.getElementById('timeRemaining').textContent = GAME_DURATION;
    document.getElementById('bubblesCount').textContent = '0';
    document.getElementById('timeRemaining').style.color = '#4299e1';
    document.getElementById('timeRemaining').style.animation = '';
}

// 开始生成泡泡
function startBubbleGeneration() {
    generateBubble(); // 立即生成第一个泡泡
    
    bubbleGenerationInterval = setInterval(() => {
        if (isGameRunning) {
            generateBubble();
            
            // 动态调整生成间隔
            const newInterval = getCurrentGenerationInterval();
            clearInterval(bubbleGenerationInterval);
            bubbleGenerationInterval = setInterval(() => {
                if (isGameRunning) {
                    generateBubble();
                }
            }, newInterval);
        }
    }, getCurrentGenerationInterval());
}

// 游戏结束
function gameOver() {
    isGameRunning = false;
    
    // 清除定时器
    clearInterval(gameInterval);
    clearInterval(bubbleGenerationInterval);
    
    // 更新结束界面
    document.getElementById('finalScore').textContent = score;
    document.getElementById('poppedBubbles').textContent = poppedBubbles;
    document.getElementById('timeoutBubbles').textContent = timeoutBubbles;
    document.getElementById('errorActions').textContent = errorActions;
    
    // 显示结束界面
    document.getElementById('endScreen').classList.remove('hidden');
}

// 重新开始游戏
function restartGame() {
    document.getElementById('endScreen').classList.add('hidden');
    startGame();
}

// 返回开始界面
function backToStart() {
    document.getElementById('endScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
}

// 切换音效
function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    const button = document.getElementById('soundToggle');
    const icon = button.querySelector('.sound-icon');
    
    if (isSoundEnabled) {
        icon.textContent = '🔊';
        button.classList.remove('muted');
    } else {
        icon.textContent = '🔇';
        button.classList.add('muted');
    }
}

// 切换暂停状态
function togglePause() {
    if (!isGameRunning) return;
    
    if (isGamePaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

// 暂停游戏
function pauseGame() {
    isGamePaused = true;
    
    // 更新暂停界面信息
    document.getElementById('pauseScore').textContent = score;
    document.getElementById('pauseTime').textContent = timeRemaining;
    document.getElementById('pauseBubbles').textContent = poppedBubbles;
    
    // 显示暂停界面
    document.getElementById('pauseScreen').classList.remove('hidden');
    
    // 更新暂停按钮图标
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseIcon = pauseBtn.querySelector('.control-icon');
    pauseIcon.textContent = '▶️';
}

// 恢复游戏
function resumeGame() {
    isGamePaused = false;
    
    // 隐藏暂停界面
    document.getElementById('pauseScreen').classList.add('hidden');
    
    // 更新暂停按钮图标
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseIcon = pauseBtn.querySelector('.control-icon');
    pauseIcon.textContent = '⏸️';
}

// 从暂停界面返回主界面
function pauseToHome() {
    isGamePaused = false;
    isGameRunning = false;
    
    // 清除定时器
    clearInterval(gameInterval);
    clearInterval(bubbleGenerationInterval);
    clearInterval(countdownInterval);
    
    // 隐藏暂停界面
    document.getElementById('pauseScreen').classList.add('hidden');
    
    // 显示开始界面
    document.getElementById('startScreen').classList.remove('hidden');
    
    // 重置暂停按钮图标
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseIcon = pauseBtn.querySelector('.control-icon');
    pauseIcon.textContent = '⏸️';
}

// 播放音效
function playPopSound() {
    if (popSounds.length > 0) {
        try {
            popSounds[currentPopIndex]();
            currentPopIndex = (currentPopIndex + 1) % popSounds.length;
        } catch (e) {
            console.warn('Error playing pop sound:', e);
        }
    }
}

function playErrorSound() {
    if (errorSounds.length > 0) {
        try {
            errorSounds[currentErrorIndex]();
            currentErrorIndex = (currentErrorIndex + 1) % errorSounds.length;
        } catch (e) {
            console.warn('Error playing error sound:', e);
        }
    }
}

function playScoreSound() {
    if (scoreSounds.length > 0) {
        try {
            scoreSounds[currentScoreIndex]();
            currentScoreIndex = (currentScoreIndex + 1) % scoreSounds.length;
        } catch (e) {
            console.warn('Error playing score sound:', e);
        }
    }
}

// 显示开始界面
function showStartScreen() {
    document.getElementById('startScreen').classList.remove('hidden');
    document.getElementById('endScreen').classList.add('hidden');
}

// 页面加载完成后初始化游戏
window.addEventListener('DOMContentLoaded', initGame);

// 添加CSS动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes scorePopup {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        20% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -50%) translateY(-30px) scale(0.8); opacity: 0; }
    }
`;
document.head.appendChild(style);