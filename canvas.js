const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');
let width, height, cx, cy, maxRadius;

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    cx = width / 2;
    cy = height / 2;
    // 视场最大投影半径（保证角落也能覆盖到）
    maxRadius = Math.hypot(width, height) / 2;
}
window.addEventListener('resize', resize);
resize();

const numStars = 1500; 
const stars = [];

// 初始化天球上的均匀星空 (包含前后整个球体)
for (let i = 0; i < numStars; i++) {
    const u = Math.random();
    const v = Math.random();
    // theta: 0(正前方) 到 PI(正后方)
    const theta = Math.acos(1 - 2 * u); 
    // phi: 0 到 2PI
    const phi = 2 * Math.PI * v;
    
    // 基础大小和极低的初始亮度
    const baseSize = Math.random() * 0.8 + 0.2; 
    const baseOpacity = Math.random() * 0.4 + 0.1; 
    
    stars.push({ theta, phi, baseSize, baseOpacity });
}

let globalBeta = 0; 

function renderRelativisticStars() {
    // 1. 完全不透明清屏，彻底移除长尾迹！
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5, 5, 10, 1)'; 
    ctx.fillRect(0, 0, width, height);
    
    // 2. 开启加色混合，让星星密集处自然发白发亮
    ctx.globalCompositeOperation = 'lighter';

    const gamma = 1 / Math.sqrt(1 - globalBeta * globalBeta);

    stars.forEach(star => {
        // --- 光行差 (Aberration) ---
        const cosTheta = Math.cos(star.theta);
        const cosThetaPrime = (cosTheta + globalBeta) / (1 + globalBeta * cosTheta);
        const thetaPrime = Math.acos(cosThetaPrime);
        
        // 剔除偏离视场太远的星星 (PI/1.5 = 120度以外不画)
        if (thetaPrime > Math.PI / 1.5) return; 

        // --- 等距立体投影 ---
        const screenR = (thetaPrime / (Math.PI / 2)) * maxRadius;
        const x = cx + screenR * Math.cos(star.phi);
        const y = cy + screenR * Math.sin(star.phi);
        
        // --- 多普勒频移 (Doppler Shift) ---
        // 0.75c 时，正前方(cosTheta=1) doppler ≈ 2.64
        // 侧方(cosTheta=0) doppler = gamma ≈ 1.51
        // 后方(cosTheta=-1) doppler ≈ 0.38
        const doppler = gamma * (1 + globalBeta * cosTheta);
        
        // --- 动态亮度与大小 ---
        // 亮度随多普勒频移呈非线性剧烈增加
        let opacity = star.baseOpacity * Math.pow(doppler, 2.5);
        if (opacity < 0.05) return; // 性能优化
        if (opacity > 1) opacity = 1;

        let size = star.baseSize * Math.pow(doppler, 1.2);
        if (size > 3.5) size = 3.5; 

        // --- 【核心修复：蓝移颜色映射】 ---
        let r = 255, g = 255, b = 255;
        
        if (doppler > 2.0) {
            // 极度蓝移 (2.0 ~ 2.64)：从冰蓝向深紫蓝过渡
            // R通道急剧下降，G通道缓慢下降，B通道保持满值
            r = Math.max(50, 255 - (doppler - 2.0) * 200);
            g = Math.max(100, 255 - (doppler - 2.0) * 150);
            b = 255;
        } else if (doppler > 1.2) {
            // 轻微蓝移 (1.2 ~ 2.0)：从纯白向冰蓝过渡
            // R通道开始下降
            r = Math.max(150, 255 - (doppler - 1.2) * 130);
            g = Math.max(220, 255 - (doppler - 1.2) * 40);
            b = 255;
        } else if (doppler < 0.8) {
            // 红移 (< 0.8)：由于速度增加，视场边缘（后方涌入）的星星会变红暗
            r = 255;
            g = Math.max(50, 255 * (doppler / 0.8));
            b = Math.max(50, 255 * (doppler / 0.8));
        } else {
            // 正常静止状态 (0.8 ~ 1.2)：保持白偏微黄的自然星光
            r = 255;
            g = 250;
            b = 240;
        }

        // --- 绘制星点 ---
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function animateCanvas() {
    renderRelativisticStars();
    requestAnimationFrame(animateCanvas);
}
animateCanvas();

// --- 暴露给外部的控制接口 (包含逆向积分) ---
window.warpEngine = {
    singleWarp: function(onUpdate) {
        return new Promise(resolve => {
            const dt = 0.012;       
            const max_beta = 0.75;  // 最高达到 0.75c
            const mu = 0.4;         
            const sigma = 0.18;     
            const c = 2000;         
            
            // 逆向积分：计算到峰值 mu 时所需穿越的总距离
            let distance_to_peak = 0;
            let pre_t = 0;
            while (pre_t < mu - dt/2) {
                pre_t += dt;
                let b = max_beta * Math.exp(-Math.pow(pre_t - mu, 2) / (2 * Math.pow(sigma, 2)));
                distance_to_peak += b * c;
            }
            
            const z0 = distance_to_peak;
            let z = z0;             
            let t = 0;           
            
            function step() {
                t += dt;      
                if (t > 1) t = 1;
                
                // 钟形曲线瞬时速度
                let beta = max_beta * Math.exp(-Math.pow(t - mu, 2) / (2 * Math.pow(sigma, 2)));
                if (t < 0.01 || t > 0.99) beta = 0;
                
                globalBeta = beta; 
                
                const v = beta * c;
                z -= v;          
                
                // 十字星像差与多普勒
                const starTheta = 0.01; 
                const cosTheta = Math.cos(starTheta);
                const cosThetaPrime = (cosTheta + beta) / (1 + beta * cosTheta);
                const thetaPrime = Math.acos(Math.max(-1, Math.min(1, cosThetaPrime)));
                
                const gamma = 1 / Math.sqrt(1 - beta * beta);
                const shift = gamma * (1 + beta * cosTheta);
                
                if (onUpdate) {
                    onUpdate({
                        beta: beta,
                        z: z,
                        z0: z0,
                        thetaPrime: thetaPrime,
                        shift: shift
                    });
                }

                if (t >= 1) {
                    globalBeta = 0;
                    resolve();
                } else {
                    requestAnimationFrame(step);
                }
            }
            step();
        });
    }
};