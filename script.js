// 游戏核心逻辑
class BubbleGame {
    constructor() {
        // 游戏状态
        this.gameRunning = false;
        this.score = 0;
        this.timeLeft = 120; // 2分钟
        this.bubbleCount = 0;
        this.bubbles = [];
        this.gameTimer = null;
        this.bubbleGenerator = null;
        
        // 游戏配置
        this.bubbleTypes = [
            { color: 'blue', duration: 1500, score: 10, class: 'bubble-blue' },
            { color: 'cyan', duration: 1200, score: 20, class: 'bubble-cyan' },
            { color: 'green', duration: 1000, score: 30, class: 'bubble-green' },
            { color: 'orange', duration: 500, score: 40, class: 'bubble-orange' },
            { color: 'purple', duration: 300, score: 50, class: 'bubble-purple' },
            { color: 'red', duration: 200, score: 60, class: 'bubble-red' }
        ];
        
        // 概率权重（与bubbleTypes顺序对应）
        // 数值越大，出现概率越高
        this.bubbleTypeWeights = [40, 25, 15, 10, 7, 3];  // 可根据需要修改
        
        // DOM 元素
        this.screens = {
            start: document.getElementById('start-screen'),
            game: document.getElementById('game-screen'),
            end: document.getElementById('end-screen'),
            pause: document.getElementById('pause-screen'),
            help: document.getElementById('help-screen')
        };
        
        this.gameArea = document.getElementById('game-area');
        this.scoreElement = document.getElementById('current-score');
        this.timeElement = document.getElementById('time-left');
        this.finalScoreElement = document.getElementById('final-score');
        
        // 按钮事件监听
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('pause-btn').addEventListener('click', () => this.pauseGame());
        document.getElementById('resume-btn').addEventListener('click', () => this.resumeGame());
        document.getElementById('restart-from-pause-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('back-to-menu-btn').addEventListener('click', () => this.backToMenu());
        document.getElementById('help-btn').addEventListener('click', () => this.showHelp());
        document.getElementById('back-from-help-btn').addEventListener('click', () => this.hideHelp());
        
        // 初始化游戏
        this.init();
    }
    
    // 初始化游戏
    init() {
        // 显示开始屏幕
        this.showScreen('start');
        
        // 预加载音效
        this.sounds = {
            pop: null,
            error: null
        };
        
        // 创建音频上下文（延迟创建以解决浏览器策略限制）
        document.addEventListener('click', () => {
            if (!this.sounds.pop) {
                this.sounds.pop = this.createAudioContext();
                this.sounds.error = this.createAudioContext();
            }
        }, { once: true });
        
        // 添加ESC键暂停功能
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.gameRunning) {
                this.pauseGame();
            }
        });
    }
    
    // 根据权重随机获取泡泡类型
    getRandomBubbleType() {
        // 计算权重总和
        const totalWeight = this.bubbleTypeWeights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < this.bubbleTypes.length; i++) {
            if (random < this.bubbleTypeWeights[i]) {
                return this.bubbleTypes[i];
            }
            random -= this.bubbleTypeWeights[i];
        }
        return this.bubbleTypes[0]; // fallback
    }
    
    // 创建音频上下文（Web Audio API）
    createAudioContext() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            return audioContext;
        } catch (e) {
            console.warn('Web Audio API not supported');
            return null;
        }
    }
    
    // 播放音效
    playSound(type) {
        // 如果音频上下文不存在，尝试创建
        if (!this.sounds[type]) {
            this.sounds[type] = this.createAudioContext();
            if (!this.sounds[type]) return; // 如果创建失败，直接返回
        }
        
        try {
            const audioContext = this.sounds[type];
            
            // 如果音频上下文被挂起，恢复它
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            
            // 创建新的振荡器和增益节点（每次播放都创建新的，避免音效消失问题）
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 设置不同音效的参数
            if (type === 'pop') {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
            } else if (type === 'error') {
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.2);
            }
        } catch (e) {
            console.warn('Error playing sound:', e);
            // 如果播放失败，尝试重新创建音频上下文
            this.sounds[type] = this.createAudioContext();
        }
    }
    
    // 显示指定屏幕
    showScreen(screenName) {
        // 隐藏所有屏幕
        Object.values(this.screens).forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // 显示指定屏幕
        this.screens[screenName].classList.remove('hidden');
    }
    
    // 开始游戏
    startGame() {
        // 重置游戏状态
        this.score = 0;
        this.timeLeft = 120;
        this.bubbleCount = 0;
        this.bubbles = [];
        
        // 更新UI
        this.updateScore();
        this.updateTime();
        
        // 显示游戏屏幕
        this.showScreen('game');
        
        // 开始游戏循环
        this.gameRunning = true;
        this.startGameTimer();
        this.startBubbleGenerator();
        
        // 添加键盘事件监听
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // 添加点击事件监听（移动端支持）
        this.gameArea.addEventListener('click', this.handleClick.bind(this));
    }
    
    // 结束游戏
    endGame() {
        // 停止游戏循环
        this.gameRunning = false;
        clearInterval(this.gameTimer);
        clearTimeout(this.bubbleGenerator);
        
        // 清除所有泡泡
        this.clearAllBubbles();
        
        // 更新最终得分
        this.finalScoreElement.textContent = this.score;
        
        // 显示结束屏幕
        this.showScreen('end');
        
        // 移除事件监听
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        this.gameArea.removeEventListener('click', this.handleClick.bind(this));
    }
    
    // 暂停游戏
    pauseGame() {
        if (!this.gameRunning) return;
        
        // 暂停游戏状态
        this.gameRunning = false;
        
        // 暂停计时器
        clearInterval(this.gameTimer);
        clearTimeout(this.bubbleGenerator);
        
        // 暂停所有泡泡的计时器
        this.bubbles.forEach(bubble => {
            clearTimeout(bubble.timer);
        });
        
        // 显示暂停屏幕
        this.showScreen('pause');
    }
    
    // 继续游戏
    resumeGame() {
        // 恢复游戏状态
        this.gameRunning = true;
        
        // 重新开始计时器
        this.startGameTimer();
        
        // 重新开始泡泡生成器
        this.startBubbleGenerator();
        
        // 恢复所有泡泡的计时器，考虑暂停期间已经过去的时间
        const now = Date.now();
        this.bubbles.forEach(bubble => {
            // 计算泡泡剩余的生命周期
            const elapsed = now - bubble.createdAt;
            const remaining = Math.max(0, bubble.type.duration - elapsed);
            
            bubble.timer = setTimeout(() => {
                this.removeBubble(bubble, true);
            }, remaining);
        });
        
        // 显示游戏屏幕
        this.showScreen('game');
    }
    
    // 返回主菜单
    backToMenu() {
        // 停止游戏循环
        this.gameRunning = false;
        clearInterval(this.gameTimer);
        clearTimeout(this.bubbleGenerator);
        
        // 清除所有泡泡
        this.clearAllBubbles();
        
        // 显示开始屏幕
        this.showScreen('start');
    }
    
    // 显示帮助
    showHelp() {
        this.showScreen('help');
    }
    
    // 隐藏帮助
    hideHelp() {
        this.showScreen('start');
    }
    
    // 重新开始游戏
    restartGame() {
        this.endGame();
        this.startGame();
    }
    
    // 开始游戏计时器
    startGameTimer() {
        // 清除可能存在的旧计时器
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        this.gameTimer = setInterval(() => {
            this.timeLeft--;
            this.updateTime();
            
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }
    
    // 开始泡泡生成器
    startBubbleGenerator() {
        // 清除可能存在的旧生成器
        if (this.bubbleGenerator) {
            clearTimeout(this.bubbleGenerator);
        }
        
        const generateBubble = () => {
            if (!this.gameRunning) return;
            
            this.createBubble();
            this.bubbleCount++;
            
            // 根据泡泡数量调整生成间隔
            let interval;
            if (this.bubbleCount <= 10) {
                interval = 2000; // 前10个泡泡，每2秒一个
            } else if (this.bubbleCount <= 20) {
                interval = 1500; // 11-20个泡泡，每1.5秒一个
            } else if (this.bubbleCount <= 30) {
                interval = 1000; // 21-30个泡泡，每1秒一个
            } else {
                interval = 500; // 31个及以后，每0.5秒一个
            }
            
            // 设置下一个泡泡生成时间
            this.bubbleGenerator = setTimeout(generateBubble, interval);
        };
        
        // 只有在游戏刚开始时才立即生成第一个泡泡
        // 暂停后恢复时，不立即生成新泡泡，而是等待原有间隔
        if (this.bubbles.length === 0) {
            generateBubble();
        } else {
            // 计算距离下一个泡泡生成的时间
            const lastBubbleTime = this.lastBubbleTime || Date.now();
            const elapsed = Date.now() - lastBubbleTime;
            let interval;
            
            // 根据当前泡泡数量确定间隔
            if (this.bubbleCount <= 10) {
                interval = 2000;
            } else if (this.bubbleCount <= 20) {
                interval = 1500;
            } else if (this.bubbleCount <= 30) {
                interval = 1000;
            } else {
                interval = 500;
            }
            
            // 计算剩余等待时间
            const remainingTime = Math.max(0, interval - elapsed);
            this.bubbleGenerator = setTimeout(generateBubble, remainingTime);
        }
        
        // 记录最后一个泡泡生成的时间
        this.lastBubbleTime = Date.now();
    }
    
    // 创建泡泡（使用加权随机）
    createBubble() {
        // 使用权重随机选择泡泡类型
        const bubbleType = this.getRandomBubbleType();
        
        // 创建泡泡元素
        const bubble = document.createElement('div');
        bubble.className = `bubble ${bubbleType.class}`;
        
        // 随机生成字母（A-Z）
        const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        bubble.textContent = letter;
        
        // 随机位置
        const gameAreaRect = this.gameArea.getBoundingClientRect();
        const bubbleSize = 60; // 泡泡大小
        
        // 确保泡泡完全在游戏区域内
        const maxX = gameAreaRect.width - bubbleSize;
        const maxY = gameAreaRect.height - bubbleSize;
        
        const x = Math.floor(Math.random() * maxX);
        const y = Math.floor(Math.random() * maxY);
        
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
        bubble.style.width = `${bubbleSize}px`;
        bubble.style.height = `${bubbleSize}px`;
        
        // 存储泡泡信息
        const bubbleInfo = {
            element: bubble,
            letter: letter,
            type: bubbleType,
            createdAt: Date.now(), // 记录创建时间，用于暂停/恢复功能
            timer: setTimeout(() => {
                this.removeBubble(bubbleInfo, true);
            }, bubbleType.duration)
        };
        
        // 添加到泡泡列表
        this.bubbles.push(bubbleInfo);
        
        // 添加到游戏区域
        this.gameArea.appendChild(bubble);
        
        // 更新最后一个泡泡生成的时间
        this.lastBubbleTime = Date.now();
    }
    
    // 移除泡泡
    removeBubble(bubbleInfo, timeout = false) {
        // 清除泡泡的定时器
        clearTimeout(bubbleInfo.timer);
        
        // 从列表中移除
        const index = this.bubbles.indexOf(bubbleInfo);
        if (index !== -1) {
            this.bubbles.splice(index, 1);
        }
        
        // 如果是超时消失，扣分
        if (timeout) {
            const penalty = this.getPenaltyScore(bubbleInfo.type);
            this.updateScore(-penalty);
            this.showScorePopup(bubbleInfo.element, -penalty, true);
        }
        
        // 添加破裂动画
        bubbleInfo.element.classList.add('pop');
        
        // 动画结束后移除元素
        setTimeout(() => {
            if (bubbleInfo.element.parentNode) {
                this.gameArea.removeChild(bubbleInfo.element);
            }
        }, 300);
    }
    
    // 清除所有泡泡
    clearAllBubbles() {
        this.bubbles.forEach(bubble => {
            clearTimeout(bubble.timer);
            if (bubble.element.parentNode) {
                this.gameArea.removeChild(bubble.element);
            }
        });
        this.bubbles = [];
    }
    
    // 处理键盘按下事件
    handleKeyDown(event) {
        if (!this.gameRunning) return;
        
        const key = event.key.toUpperCase();
        
        // 查找匹配的泡泡
        const bubbleIndex = this.bubbles.findIndex(bubble => bubble.letter === key);
        
        if (bubbleIndex !== -1) {
            // 找到匹配的泡泡
            const bubble = this.bubbles[bubbleIndex];
            
            // 播放破裂音效
            this.playSound('pop');
            
            // 更新分数
            this.updateScore(bubble.type.score);
            
            // 显示分数弹出
            this.showScorePopup(bubble.element, bubble.type.score);
            
            // 移除泡泡
            this.removeBubble(bubble);
        } else {
            // 按错键，扣分
            this.playSound('error');
            this.updateScore(-5);
            this.showScorePopup(null, -5, true);
        }
    }
    
    // 处理点击事件（移动端支持）
    handleClick(event) {
        if (!this.gameRunning) return;
        
        const target = event.target;
        
        // 检查是否点击了泡泡
        if (target.classList.contains('bubble')) {
            const letter = target.textContent;
            
            // 查找匹配的泡泡
            const bubbleIndex = this.bubbles.findIndex(bubble => bubble.element === target);
            
            if (bubbleIndex !== -1) {
                const bubble = this.bubbles[bubbleIndex];
                
                // 播放破裂音效
                this.playSound('pop');
                
                // 更新分数
                this.updateScore(bubble.type.score);
                
                // 显示分数弹出
                this.showScorePopup(bubble.element, bubble.type.score);
                
                // 移除泡泡
                this.removeBubble(bubble);
            }
        } else {
            // 点击空白处，扣分
            this.playSound('error');
            this.updateScore(-5);
            this.showScorePopup(event.target, -5, true);
        }
    }
    
    // 更新分数
    updateScore(points = 0) {
        this.score += points;
        // 支持负数分数
        this.scoreElement.textContent = this.score;
    }
    
    // 更新时间显示
    updateTime() {
        this.timeElement.textContent = this.timeLeft;
    }
    
    // 获取超时扣分
    getPenaltyScore(bubbleType) {
        // 所有泡泡超时扣分统一为5分
        return 5;
    }
    
    // 显示分数弹出
    showScorePopup(element, points, isNegative = false) {
        const popup = document.createElement('div');
        popup.className = `score-popup ${isNegative ? 'score-negative' : 'score-positive'}`;
        popup.textContent = `${isNegative ? '-' : '+'}${Math.abs(points)}`;
        
        // 如果有元素，在元素位置显示；否则在随机位置显示
        if (element) {
            const rect = element.getBoundingClientRect();
            const gameRect = this.gameArea.getBoundingClientRect();
            
            popup.style.left = `${rect.left + rect.width / 2 - gameRect.left}px`;
            popup.style.top = `${rect.top + rect.height / 2 - gameRect.top}px`;
        } else {
            // 随机位置
            const x = Math.floor(Math.random() * (this.gameArea.offsetWidth - 50));
            const y = Math.floor(Math.random() * (this.gameArea.offsetHeight - 50));
            
            popup.style.left = `${x}px`;
            popup.style.top = `${y}px`;
        }
        
        this.gameArea.appendChild(popup);
        
        // 动画结束后移除
        setTimeout(() => {
            if (popup.parentNode) {
                this.gameArea.removeChild(popup);
            }
        }, 1000);
    }
}

// 当页面加载完成时初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    new BubbleGame();
});
