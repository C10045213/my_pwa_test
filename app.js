// 模拟获取78张牌 (实际使用中请在 assets/cards/ 放入 0-77.jpg)
const TOTAL_CARDS = 78;
let deckData = Array.from({length: TOTAL_CARDS}, (_, i) => ({
    id: i,
    img: `assets/cards/${i}.jpg`,
    isReversed: false,
    drawTime: null
}));

// --- 音效系统 ---
const sfx = {
    click: new Audio('assets/sounds/click.mp3'),
    warp: new Audio('assets/sounds/warp.mp3'),
    charged: new Audio('assets/sounds/charged.mp3'),
    reinit: new Audio('assets/sounds/reinit.mp3')
}

// --- DOM 元素 ---
const elCrossStar = document.getElementById('cross-star');
const p1 = document.getElementById('cross-star-container');
const p2 = document.getElementById('shuffle-phase');
const p3 = document.getElementById('draw-phase');
const elDeck = document.getElementById('deck');
const elRipple = document.getElementById('ripple');
const elHint = document.getElementById('shuffle-hint');
const carouselArea = document.getElementById('carousel-area');
const selectedArea = document.getElementById('selected-area');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modal-img');

// --- 阶段一：欢迎与穿越 ---
let welcomePhaseState = 0; // 0: 初始状态, 1: 等待穿越
let warpCount = 0;         
let isWarping = false;     

elCrossStar.addEventListener('click', async (e) => {
    if (isWarping) return;

    if (welcomePhaseState === 0) {
        // 第一步：光芒散去，留下镂空轮廓
        elCrossStar.classList.add('hollow-mode');
        welcomePhaseState = 1; 
        sfx.click.play();
        
    } else if (welcomePhaseState === 1) {
        // 第二步：触发基于相对论的单次穿越
        isWarping = true;
        warpCount++;
        
        // 关闭 CSS transition，因为我们将逐帧由 JS 接管控制
        elCrossStar.style.transition = 'none';
        
        // 记录初始中心点
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        // 记录超越瞬间的坐标基准，保证视觉连贯
        let crossPointR = 0; 

        await window.warpEngine.singleWarp((physics) => {
            let scale = 1;
            let opacity = 1;
            let offsetX = 0;
            let offsetY = 0;

            if (physics.z > 0) {
                sfx.warp.currentTime = 0;
                sfx.warp.play();
                // 【接近阶段】
                // 1. 相对论视缩效应 (0.75c 下会缩小到约 37% 大小)
                const relativisticShrink = Math.sqrt((1 - physics.beta) / (1 + physics.beta));
                
                // 2. 距离透视放大
                const distanceFactor = physics.z0 / Math.max(physics.z, physics.z0 * 0.05);
                
                scale = distanceFactor * relativisticShrink;
                
                // 3. 像差聚拢投影到屏幕 (锁定在中心附近)
                const fovFactor = window.innerWidth * 0.5; 
                const r = Math.tan(physics.thetaPrime / 2) * fovFactor;
                crossPointR = r; 
                offsetX = r * 0.707; // 45度角（右下）
                offsetY = r * 0.707;
                
            } else {
                // 【超越阶段】(发生在速度峰值之后)
                const passedDist = Math.abs(physics.z); 
                
                // 脱离像差压制，透视瞬间暴涨
                scale = 2 + (passedDist / 50);
                
                // 顺着最后轨迹急剧飞出屏幕
                offsetX = (crossPointR * 0.707) + (passedDist * 4);
                offsetY = (crossPointR * 0.707) + (passedDist * 4);
                
                opacity = Math.max(0, 1 - (passedDist / 200));
            }

            // 发光与蓝移特效
            // 在 0.75c 时，shift 大约为 2.64，足够亮但不会全屏爆白
            let brightness = Math.min(2.5, physics.shift);
            let blur = 2+ (physics.shift - 1) * 2;
            let filter = `drop-shadow(0 0 ${blur}px rgba(0,170,240, ${Math.min(1, brightness/2.5)})) brightness(${brightness})`;

            elCrossStar.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
            elCrossStar.style.filter = filter;
            elCrossStar.style.opacity = opacity;
        });
        
        // --- 穿越脉冲结束 ---
        if (warpCount < 3) {
            // 准备浮现下一个十字星
            elCrossStar.style.transform = 'scale(0.01)'; // 放到极远处
            elCrossStar.style.opacity = '0';
            elCrossStar.style.filter = 'drop-shadow(0 0 2px rgba(255,255,255,0.4))';
            
            void elCrossStar.offsetWidth; // 强制重排
            
            // 恢复缓慢靠近的动画
            elCrossStar.style.transition = 'transform 1s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 1s ease-out';
            elCrossStar.style.transform = 'translate(0px, 0px) scale(1)';
            elCrossStar.style.opacity = '1';
            
            setTimeout(() => {
                isWarping = false;
            }, 2000);
            
        } else {
            // 完成 3 次穿越，准备进入洗牌阶段
            setTimeout(() => {
                p1.classList.replace('phase-active', 'phase-hidden');
                p2.classList.replace('phase-hidden', 'phase-active');
                elCrossStar.style = '';
                isWarping = false;
                
                // 1. 重置牌组状态，确保它处于极小且透明的“远方”
                elDeck.classList.add('deck-emerge-start');
                elDeck.classList.remove('deck-emerge-end');
                elDeck.style.setProperty('--charge-ratio', '0'); // 重置能量
                
                // 2. 强制浏览器重排，使起始状态生效
                void elDeck.offsetWidth;
                
                // 3. 移除起始类，添加结束类，触发如同穿越十字星一般的浮现靠近动画
                elDeck.classList.remove('deck-emerge-start');
                elDeck.classList.add('deck-emerge-end');
                
            }, 800); // 留一点余韵时间让星空散开
        }
    }
});

// --- 阶段二：充能阶段 ---
let chargeTimer = null;
let decayTimer = null;
let chargeProgress = 0; // 0 到 100
let isCharged = false;

// 定义充能动画循环
function chargeLoop() {
    if (chargeProgress >= 100) {
        isCharged = true;
        
        // --- 全新爆发逻辑 ---
        // 1. 获取需要爆发的元素
        const elCardBg = elDeck.querySelector('.card-back-design');
        const elStarGlow = elDeck.querySelector('.star-glow-layer');
        
        // 2. 添加爆发类名
        elCardBg.classList.add('card-burst-anim');
        elStarGlow.classList.add('star-burst-anim');
        
        // 3. 动画结束后移除类名（1秒后）
        setTimeout(() => {
            elCardBg.classList.remove('card-burst-anim');
            elStarGlow.classList.remove('star-burst-anim');
        }, 1000);
        
        // 锁定满值
        chargeProgress = 100;
        elDeck.style.setProperty('--charge-ratio', '1');
        sfx.charged.play();
        return;
    }
    
    // 匀速充能：每次调用增加固定进度，约 5 秒充满 (60fps * 5s = 300帧)
    chargeProgress += 100 / 300; 
    if (chargeProgress > 100) chargeProgress = 100;
    
    // 注入 CSS 变量
    elDeck.style.setProperty('--charge-ratio', chargeProgress / 100);
    
    // 循环下一帧
    chargeTimer = requestAnimationFrame(chargeLoop);
}

// 触摸按下：开始充能
elDeck.addEventListener('pointerdown', (e) => {
    if(isCharged) return;
    
    // 关键修复：清除可能正在运行的衰减定时器，防止冲突闪烁
    if (decayTimer) {
        clearInterval(decayTimer);
        decayTimer = null;
    }
    
    // 启动充能循环前，确保初始状态为当前进度，无跳跃
    elDeck.style.setProperty('--charge-ratio', chargeProgress / 100);
    
    chargeTimer = requestAnimationFrame(chargeLoop);
});

// 触摸抬起/离开：能量衰减
function stopCharging() {
    if(isCharged) return;
    
    // 停止充能循环
    if (chargeTimer) {
        cancelAnimationFrame(chargeTimer);
        chargeTimer = null;
    }
    
    // 关键修复：清除旧的衰减器，开启新的平滑衰减
    if (decayTimer) clearInterval(decayTimer);
    
    decayTimer = setInterval(() => {
        if(chargeProgress > 0) {
            // 衰减速度比充能快一点
            chargeProgress -= 1.5; 
            if (chargeProgress < 0) chargeProgress = 0;
            
            elDeck.style.setProperty('--charge-ratio', chargeProgress / 100);
        } else {
            // 彻底归零
            clearInterval(decayTimer);
            decayTimer = null;
            chargeProgress = 0;
            elDeck.style.setProperty('--charge-ratio', '0');
        }
    }, 16); // 16ms 约等于一帧
}

// 绑定抬起和离开卡牌区域的事件，防止手指滑出卡牌导致卡死
elDeck.addEventListener('pointerup', stopCharging);
elDeck.addEventListener('pointerleave', stopCharging);

// 充满后点击抽牌
elDeck.addEventListener('click', () => {
    if(isCharged) {
        p2.classList.replace('phase-active', 'phase-hidden');
        p3.classList.replace('phase-hidden', 'phase-active');
        initDrawPhase();
    }
});

// --- 阶段三：抽牌圆环高级物理引擎 ---
let cardsDOM = [];

const CARD_WIDTH_VW = 20;
let RADIUS = 0; 

let globalAngle = 0;           
let angularVelocity = 0;       
const BASE_VELOCITY = 0.0008;  

let layoutAngleOffset = 0;    

let expandProgress = 0;        
let isDragging = false;
let startX = 0, startY = 0;    // 记录全局按下的起始点
let lastX = 0;                 // 用于计算滑动角速度
let lastTime = 0;
let isSwipeDown = false;       // 是否确认为下滑退出手势
let physicsAnimationId = null;
let expandStartTime = 0;

function initDrawPhase() {
    if (physicsAnimationId) {
        cancelAnimationFrame(physicsAnimationId);
        physicsAnimationId = null;
    }
    const pxPerVw = window.innerWidth / 100;
    const cardWidthPx = CARD_WIDTH_VW * pxPerVw;
    const CIRCUMFERENCE = TOTAL_CARDS * (cardWidthPx + 6); 
    RADIUS = CIRCUMFERENCE / (2 * Math.PI); 
    carouselArea.style.top = `calc(50vh + ${RADIUS}px)`;
    
    expandStartTime = Date.now();
    deckData.sort(() => Math.random() - 0.5);
    deckData.forEach(c => c.isReversed = Math.random() > 0.5);
    
    carouselArea.innerHTML = '';
    cardsDOM = [];
    selectedCards = []; 
    
    selectedArea.innerHTML = ''; // 清空可能残留的卡牌
    selectedArea.style.transform = 'translateY(0)'; // 重置位置到顶部
    
    // 创建一个专门用来排版的 Grid 容器
    let gridEl = document.createElement('div');
    gridEl.id = 'selected-grid';
    selectedArea.appendChild(gridEl);
    
    deckData.forEach((card, i) => {
        let cardEl = document.createElement('div');
        cardEl.className = 'draw-card';
        cardEl.innerHTML = `
            <div class="card-inner">
                <div class="card-back card-back-design">
                    <svg viewBox="0 0 100 100" class="deck-star-svg" style="--charge-ratio: 1; filter: drop-shadow(0 0 15px rgba(0,170,240,0.6)); color: var(--theme-blue);">
                        <g class="star-base-layer">
                            <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M 50 15 Q 50 50 78 50 Q 50 50 50 85 Q 50 50 22 50 Q 50 50 50 15 Z" fill="currentColor"/>
                        </g>
                        <g class="star-glow-layer">
                            <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M 50 15 Q 50 50 78 50 Q 50 50 50 85 Q 50 50 22 50 Q 50 50 50 15 Z" fill="currentColor"/>
                        </g>
                    </svg>
                </div>
                <div class="card-front" style="background-image: url('${card.img}')"></div>
            </div>`;
        
        if(card.isReversed) cardEl.classList.add('reversed');
        
        cardEl.dataset.currentAngleOffset = 0; 
        
        cardEl.addEventListener('click', (e) => {
            if(expandProgress < 1 || isDragging || isSwipeDown) return; 
            if(Math.abs(angularVelocity) < 0.005) {
                selectCard(cardEl, card);
            }
            e.stopPropagation(); 
        });

        carouselArea.appendChild(cardEl);
        cardsDOM.push(cardEl);
    });
    
    globalAngle = 0;
    angularVelocity = 0;
    layoutAngleOffset = 0; // 重置补偿角
    expandProgress = 0;
    
    physicsAnimationId = requestAnimationFrame(carouselPhysicsLoop);
}

// --- 全局滑动：左/右拨盘 与 下滑退出 ---
p3.addEventListener('pointerdown', (e) => { 
    if(expandProgress < 1) return; 
    isDragging = true; 
    isSwipeDown = false; // 初始重置
    startX = lastX = e.clientX; 
    startY = e.clientY;  // 记录纵向起点
    lastTime = Date.now();
});

window.addEventListener('pointermove', (e) => {
    if(!isDragging) return;
    
    let dx = e.clientX - lastX;
    let totalDx = e.clientX - startX;
    let totalDy = e.clientY - startY; // 从按下到现在的总纵向位移
    
    // 1. 意图判断：是否是刻意的下滑退出？
    if (!isSwipeDown) {
        // 如果向下移动超过 30px，并且垂直移动距离大于水平移动距离，锁定为下滑手势
        if (totalDy > 30 && totalDy > Math.abs(totalDx)) {
            isSwipeDown = true;
        }
    }
    
    // 2. 如果锁定了下滑意图，检测是否达到退出阈值
    if (isSwipeDown) {
        if (totalDy > 100) {
            stopDrawing();
            isDragging = false; // 立即结束拖拽状态
            isSwipeDown = false;
        }
        return; // 下滑意图确认后，绝对不执行左右转盘逻辑
    }
    
    // 3. 正常的左右拨盘动能累加 (只有没被判定为下滑时才执行)
    const now = Date.now();
    const dt = Math.max(1, now - lastTime); 
    
    const instantaneousVelocity = (dx / window.innerWidth) * 0.05 * (16 / dt); 
    angularVelocity += instantaneousVelocity * 0.8; 
    
    const MAX_VELOCITY = 0.15;
    if (angularVelocity > MAX_VELOCITY) angularVelocity = MAX_VELOCITY;
    if (angularVelocity < -MAX_VELOCITY) angularVelocity = -MAX_VELOCITY;
    
    lastX = e.clientX;
    lastTime = now;
});

// 为了兼容点击(click)，当拖拽距离极小时，我们在 pointerup 时把 isDragging 设回 false
window.addEventListener('pointerup', (e) => { 
    // 如果手指只是点了一下（位移小于 10px），解除 dragging 状态让 click 事件能够顺利触发
    if (Math.abs(e.clientX - startX) < 10 && Math.abs(e.clientY - startY) < 10) {
        isDragging = false; 
    } else {
        // 否则延迟一点点解除，防止快速滑动后松手的瞬间触发卡牌的 click
        setTimeout(() => { isDragging = false; }, 50);
    }
    isSwipeDown = false;
});

window.addEventListener('pointercancel', () => { 
    isDragging = false; 
    isSwipeDown = false;
});

// --- 核心：高级物理阻尼与极坐标渲染引擎 ---
function carouselPhysicsLoop() {
    const total = cardsDOM.length;
    if (total === 0) return;
    
    // 1. 裂变插值
    if (expandProgress < 1) {
        expandProgress += 0.008; 
        if (expandProgress > 1) expandProgress = 1;
    }
    
    // 2. 动能衰减
    if (expandProgress === 1) {
        if (!isDragging) {
            const friction = 0.015; 
            angularVelocity += (BASE_VELOCITY - angularVelocity) * friction;
        } else {
            angularVelocity *= 0.95; 
        }
    } else {
        angularVelocity = 0; 
    }
    
    globalAngle += angularVelocity;

    const step = (Math.PI * 2) / total;
    const easeExp = expandProgress < 1 ? (1 - Math.pow(1 - expandProgress, 4)) : 1;

    cardsDOM.forEach((el, i) => {
        // 1. 获取带有引力补偿的绝对目标角度！
        // 因为有了 layoutAngleOffset，第 0 张牌不再死板地钉在 0 度了。
        let rawTargetAngle = (i * step) + layoutAngleOffset;
        
        // 2. 将角度完美归一化到 [-PI, PI] 之间，保证圆环背面的牌能抄近道
        let normalizedTarget = rawTargetAngle % (Math.PI * 2);
        if (normalizedTarget > Math.PI) normalizedTarget -= Math.PI * 2;
        if (normalizedTarget < -Math.PI) normalizedTarget += Math.PI * 2;
        
        // 应用展开缓动
        let targetAngle = normalizedTarget * easeExp;
        
        // 3. 提取上一帧位置
        let currentOffset = parseFloat(el.dataset.currentAngleOffset);
        // 第一帧初始化，保证从顶点完美展开
        if (isNaN(currentOffset)) currentOffset = 0; 
        
        // 4. 最短路径自愈插值 (Math.atan2 永远滴神)
        let diff = targetAngle - currentOffset;
        let shortestDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
        
        currentOffset += shortestDiff * 0.08;
        el.dataset.currentAngleOffset = currentOffset;
        
        // 5. 渲染
        let finalAngle = currentOffset + globalAngle;
        el.style.transform = `rotate(${finalAngle}rad) translateY(${-RADIUS}px)`;
    });

    physicsAnimationId = requestAnimationFrame(carouselPhysicsLoop);
}

// --- 执行抽牌：点击单卡 ---
function selectCard(el, cardData) {
    if(el.parentElement !== carouselArea) return;
    cardData.drawTime = Date.now();
    const timeDelta = drawTime - expandStartTime;
    const chaosEntropy = Math.abs(Math.floor(timeDelta * 13 + globalAngle * 10000));
    const availableCards = deckData.filter(c => !c.drawTime);
    const trueCardIndex = chaosEntropy % availableCards.length;
    const trueCardData = availableCards[trueCardIndex];
    trueCardData.drawTime = drawTime;
    trueCardData.isReversed = (timeDelta % 2) === 0;
    
    let idx = cardsDOM.indexOf(el);
    if(idx > -1) {
        // ==========================================
        // 【绝对物理魔法：缺口中心引力偏移算法】
        // ==========================================
        const N = cardsDOM.length;
        const Sold = (Math.PI * 2) / N;       // 抽牌前的卡牌间距
        const Snew = (Math.PI * 2) / (N - 1); // 抽牌后的卡牌新间距
        
        // 我们计算出：为了让缺口左右两边的牌以同样的距离向中心靠拢，
        // 整个圆环的排布基准线需要顺时针/逆时针转动多少度。
        // 公式：旧缺口位置 - 新布局下缺口原本应该在的位置
        let deltaOffset = idx * Sold - (idx - 0.5) * Snew;
        
        // 将这个偏移量永久累加到布局基准中
        layoutAngleOffset += deltaOffset;
        
        // 剥离卡牌，进入自愈动画
        cardsDOM.splice(idx, 1); 
        // ==========================================
    }
      
    carouselArea.removeChild(el);
    
    let newSelectedEl = document.createElement('div');
    newSelectedEl.className = 'selected-card';
    newSelectedEl.innerHTML = `
        <div class="card-inner">
            <div class="card-back card-back-design">
                <svg viewBox="0 0 100 100" class="deck-star-svg" style="--charge-ratio: 1; filter: drop-shadow(0 0 15px rgba(140,200,255,0.6)); color: var(--theme-blue);">
                    <g class="star-base-layer"><circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M 50 15 Q 50 50 78 50 Q 50 50 50 85 Q 50 50 22 50 Q 50 50 50 15 Z" fill="currentColor"/></g>
                    <g class="star-glow-layer"><circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M 50 15 Q 50 50 78 50 Q 50 50 50 85 Q 50 50 22 50 Q 50 50 50 15 Z" fill="currentColor"/></g>
                </svg>
            </div>
            <!-- 替换为重铸后的真实牌面 -->
            <div class="card-front" style="background-image: url('${trueCardData.img}')"></div>
        </div>`;
    if(trueCardData.isReversed) {
        newSelectedEl.classList.add('reversed');
    } else {
        newSelectedEl.classList.remove('reversed');
    }    

    const gridEl = document.getElementById('selected-grid');
    gridEl.appendChild(newSelectedEl);
    selectedCards.push({el: newSelectedEl, data: trueCardData, flipped: false});
    
    const count = selectedCards.length;
    let columns = 4; // 默认最多 4 列
    let scale = 1.0; // 默认不缩放
    
    if (count <= 4) {
        columns = count; // 不满 4 张时，抽几张就几列，保证绝对居中
        scale = 1.0;
    } else if (count <= 8) {
        columns = 4;     // 两行 4 列
        scale = 0.85;    // 稍微缩小，防止垂直方向超高
    } else {
        columns = 5;     // 超过 8 张时，变成每行 5 列
        scale = 0.7;     // 进一步缩小卡牌
    }
    
    // 注入动态网格属性和缩放变量
    gridEl.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    gridEl.style.setProperty('--card-scale', scale);
    
    // 绑定已选卡牌的翻转与大图事件
    newSelectedEl.addEventListener('click', (e) => {
        e.stopPropagation();
        let state = selectedCards.find(c => c.el === newSelectedEl);
        if(!state.flipped) {
            newSelectedEl.classList.add('flipped');
            state.flipped = true;
        } else {
            modalImg.src = cardData.img;
            if(cardData.isReversed) modalImg.style.transform = 'rotate(180deg)';
            else modalImg.style.transform = 'none';
            modal.classList.remove('hidden');
        }
    });
}

// --- 停止抽牌：下滑长距离 ---
function stopDrawing() {
    // 1. 隐藏巨大圆环 (轰然坠落)
    carouselArea.style.transition = 'transform 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s';
    carouselArea.style.transform = `translateY(100vh) translateY(${-RADIUS}px)`; // 补偿初始半径
    carouselArea.style.opacity = '0';
    
    // 2. 完美零跳闪的整体居中下沉
    // 我们的 selectedArea 高度是 45vh，顶部距离是 5vh。
    // 要让它整个框的垂直中心与屏幕中心 (50vh) 对齐：
    // 当前框的中心 = top(5vh) + height/2(22.5vh) = 27.5vh
    // 目标中心 = 50vh。 所以只需要向下 translateY(22.5vh) 即可完美居中！
    
    // 稍微延迟 100ms，等圆盘开始下落后再执行，视觉更震撼
    setTimeout(() => {
        selectedArea.style.transform = 'translateY(22.5vh)';
    }, 100);
}

// 关闭 Modal
modal.addEventListener('click', () => { modal.classList.add('hidden'); });


// --- 阶段四：终局 - 二指捏合返回与重置 ---
let initialPinchDistance = null;
let isPinching = false;
let isResetting = false;

window.addEventListener('touchstart', (e) => {
    // 确保只有在阶段三且未在重置中才响应捏合
    if(e.touches.length === 2 && !p3.classList.contains('phase-hidden') && !isResetting) {
        isPinching = true;
        initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
});

window.addEventListener('touchmove', (e) => {
    if(isPinching && e.touches.length === 2 && initialPinchDistance && !isResetting) {
        let currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        
        if(initialPinchDistance - currentDistance > 80) { 
            isResetting = true;
            executeResetSequence();
        }
    }
});

window.addEventListener('touchend', () => { 
    initialPinchDistance = null; 
    isPinching = false;
});

// --- 绝对优雅且安全的软重置序列 (二周目终极修复版) ---
async function executeResetSequence() {
    isResetting = true;
    sfx.reinit.play();

    // 1. 同步淡出视野中的所有 UI
    if (modal && !modal.classList.contains('hidden')) {
        modal.classList.add('fade-out');
    }
    if (selectedArea) {
        selectedArea.classList.add('fade-out-anim');
    }
    if (carouselArea) {
        carouselArea.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s';
        carouselArea.style.transform = `translateY(100vh) translateY(${-RADIUS}px)`;
        carouselArea.style.opacity = '0';
    }

    // 2. 等待 600ms 淡出动画彻底结束
    setTimeout(() => {
        try {
            // ==========================================
            // A. 深度清理 DOM 与内存
            // ==========================================
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('fade-out');
            }
            if (modalImg) modalImg.src = '';

            if (carouselArea) carouselArea.innerHTML = '';
            if (selectedArea) selectedArea.innerHTML = '';
            cardsDOM = [];
            selectedCards = [];

            deckData.forEach(card => card.drawTime = null);

            // ==========================================
            // B. 状态机全局彻底归零与物理引擎斩杀
            // ==========================================
            // 【核心修复 1】：杀死上一个周目残留的物理循环！
            if (physicsAnimationId) {
                cancelAnimationFrame(physicsAnimationId);
                physicsAnimationId = null;
            }

            globalAngle = 0;
            angularVelocity = 0;
            layoutAngleOffset = 0;
            expandProgress = 0;
            chargeProgress = 0;
            isCharged = false;
            warpCount = 0;
            welcomePhaseState = 0; 
            isWarping = false;
            isDragging = false;
            isSwipeDown = false;

            // ==========================================
            // C. UI 容器的野蛮清洗 (根除残留状态)
            // ==========================================
            // 【核心修复 2】：拔除第一周目退出时留下的 inline styles (极其重要！)
            // 否则 carouselArea 永远在屏幕外面并且 opacity 是 0！
            if (carouselArea) {
                carouselArea.removeAttribute('style'); 
            }
            if (selectedArea) {
                selectedArea.classList.remove('fade-out-anim');
                selectedArea.removeAttribute('style'); 
            }
            
            if (elDeck) {
                // 彻底拔除卡牌缩小动画的残留
                elDeck.classList.remove('deck-shrink');
                elDeck.className = 'deck-emerge-start'; 
                elDeck.style.setProperty('--charge-ratio', '0');
            }
            if (elHint) elHint.innerText = "长按注入能量";
            
            // ==========================================
            // D. 强制容器可见性切换 (Phase 3 -> Phase 1)
            // ==========================================
            p3.classList.replace('phase-active', 'phase-hidden');
            p2.classList.replace('phase-active', 'phase-hidden');
            p1.classList.replace('phase-hidden', 'phase-active');

            // ==========================================
            // E. 第一阶段十字星彻底洗白与强制显形
            // ==========================================
            elCrossStar.className = ''; 
            elCrossStar.style.cssText = ''; // 清空上一周目单次穿越的所有变换
            void elCrossStar.offsetWidth; // 触发重排

            // ==========================================
            // F. 触发重现动画与底层蓝移
            // ==========================================
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    elCrossStar.classList.add('re-emerge-anim');
                    
                    if (window.warpEngine && window.warpEngine.singleWarp) {
                        window.warpEngine.singleWarp(() => {});
                    }
                });
            });

            // G. 动画落幕解锁
            setTimeout(() => {
                elCrossStar.classList.remove('re-emerge-anim');
                elCrossStar.removeAttribute('style'); 
                isResetting = false;
            }, 2000);

        } catch (error) {
            console.warn("Soft reset failed, executing instant hard reset:", error);
            window.location.reload();
        }
    }, 600); 
}
