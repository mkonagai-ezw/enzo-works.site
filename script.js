/**
 * ENZO WORKS - AI Sandbox Battle (Refined Version)
 */
async function loadAIBattle() {
    const grid = document.getElementById('ai-grid');
    if (!grid) {
        console.error('ai-grid element not found');
        return;
    }

    try {
        const res = await fetch('./ai_predictions.json?t=' + new Date().getTime());
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();

        // データ構造の検証
        if (!data.latest_forecast || !data.latest_forecast.current_prices || !data.latest_forecast.GPT) {
            throw new Error('Invalid data structure: missing required fields');
        }

        // 1. 全体の更新情報（ここだけに集約）
        const lastUpdated = document.getElementById('update-time');
        if (lastUpdated && data.metadata) {
            lastUpdated.innerText = data.metadata.last_updated;
        }

        // 2. 的中率の反映
        const stats = data.overall_stats;
        if (stats && stats["GPT-3.5"]) {
            const gptWinRateEl = document.getElementById('gpt-win-rate');
            if (gptWinRateEl) gptWinRateEl.innerText = stats["GPT-3.5"].win_rate;
            const gptAvgErrorEl = document.getElementById('gpt-avg-error');
            if (gptAvgErrorEl) gptAvgErrorEl.innerText = stats["GPT-3.5"].avg_error;
            const gptCountEl = document.getElementById('gpt-count');
            if (gptCountEl) gptCountEl.innerText = stats["GPT-3.5"].count;
        }
        if (stats && stats["Gemini"]) {
            const geminiWinRateEl = document.getElementById('gemini-win-rate');
            if (geminiWinRateEl) geminiWinRateEl.innerText = stats["Gemini"].win_rate;
            const geminiAvgErrorEl = document.getElementById('gemini-avg-error');
            if (geminiAvgErrorEl) geminiAvgErrorEl.innerText = stats["Gemini"].avg_error;
            const geminiCountEl = document.getElementById('gemini-count');
            if (geminiCountEl) geminiCountEl.innerText = stats["Gemini"].count;
        }

        // 3. バトルカード生成
        grid.innerHTML = '';
        const currentPrices = data.latest_forecast.current_prices;
        const gptForecast = data.latest_forecast.GPT;
        const geminiForecast = data.latest_forecast.Gemini;
        const judgments = data.today_judgement || [];

        // 市場状況を取得
        const marketStatus = data.market_status || {};

        for (const [asset, current] of Object.entries(currentPrices)) {
            const unit = asset === "S&P 500" ? "$" : "¥";
            const fractionDigits = asset === "USD/JPY" ? 3 : 2;
            
            // 市場状況を取得
            const status = marketStatus[asset] || { is_open: true, message: "市場は開いています" };
            const marketStatusHTML = status.is_open 
                ? `<span class="market-status open">🟢 ${status.message}</span>`
                : `<span class="market-status closed">🔴 ${status.message}</span>`;
            
            // 決着判定の検索（asset_nameを使用）
            const todayJudgments = judgments.filter(j => j.asset_name === asset && j.status === 'settled');
            
            // --- 過去：本日の決着判定 ---
            let judgeHTML = `<div class="judge-section empty">本日決着：データ蓄積中</div>`;
            if (todayJudgments.length > 0) {
                // GPTとGeminiの結果を分けて取得
                const gptJudge = todayJudgments.find(j => j.ai_model === "GPT-3.5");
                const geminiJudge = todayJudgments.find(j => j.ai_model === "Gemini");
                
                if (gptJudge || geminiJudge) {
                    // GPTの結果と誤差を計算
                    let gptResultText = 'データなし';
                    if (gptJudge) {
                        const resultIcon = gptJudge.direction_correct ? '✓ 的中' : '✗ 外れ';
                        const errorRate = gptJudge.error_rate !== undefined ? gptJudge.error_rate.toFixed(2) : 'N/A';
                        const predictedPrice = gptJudge.predicted_price !== undefined 
                            ? gptJudge.predicted_price.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
                            : 'N/A';
                        const actualPrice = gptJudge.actual_price !== undefined 
                            ? gptJudge.actual_price.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
                            : 'N/A';
                        gptResultText = `${resultIcon} | 誤差: ${errorRate}% | 予測: ${unit}${predictedPrice} → 実際: ${unit}${actualPrice}`;
                    }
                    
                    // Geminiの結果と誤差を計算
                    let geminiResultText = 'データなし';
                    if (geminiJudge) {
                        const resultIcon = geminiJudge.direction_correct ? '✓ 的中' : '✗ 外れ';
                        const errorRate = geminiJudge.error_rate !== undefined ? geminiJudge.error_rate.toFixed(2) : 'N/A';
                        const predictedPrice = geminiJudge.predicted_price !== undefined 
                            ? geminiJudge.predicted_price.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
                            : 'N/A';
                        const actualPrice = geminiJudge.actual_price !== undefined 
                            ? geminiJudge.actual_price.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
                            : 'N/A';
                        geminiResultText = `${resultIcon} | 誤差: ${errorRate}% | 予測: ${unit}${predictedPrice} → 実際: ${unit}${actualPrice}`;
                    }
                    
                    judgeHTML = `
                        <div class="judge-section">
                            <div class="judge-title">⚔️ 5日前AI予想 vs 本日価格</div>
                            <div class="judge-result">
                                <div class="judge-item">
                                    <span class="judge-label">GPT-3.5:</span>
                                    <span class="judge-detail">${gptResultText}</span>
                                </div>
                                <div class="judge-item">
                                    <span class="judge-label">Gemini:</span>
                                    <span class="judge-detail">${geminiResultText}</span>
                                </div>
                            </div>
                        </div>`;
                }
            }

            // --- 未来：最新AI予想 ---
            const trend = (val) => {
                if (val === null || val === undefined) return '<span class="flat">― データなし</span>';
                const diffRate = ((val - current) / current) * 100;
                const isUp = diffRate > 0;
                const sign = isUp ? 'plus' : (diffRate < 0 ? 'minus' : 'flat');
                const arrowText = isUp ? '▲ 上昇' : (diffRate < 0 ? '▼ 下落' : '― 横ばい');
                const rateText = `${diffRate >= 0 ? '+' : ''}${diffRate.toFixed(2)}%`;
                return `<span class="${sign}">${arrowText} (${rateText})</span>`;
            };

            const card = document.createElement('div');
            card.className = 'asset-card';

            card.innerHTML = `
                <div class="asset-header">
                    <span class="asset-name">${asset}</span>
                    <span class="current-price">現在値: ${unit}${current.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                </div>
                <div class="market-status-container">
                    ${marketStatusHTML}
                </div>
                
                ${judgeHTML}

                <div class="prediction-box">
                    <div class="target-label-main">🤖 最新AI予想（5営業日後の終値）</div>
                    
                    <div class="prediction-row gpt-row">
                        <div class="ai-label">GPT-3.5</div>
                        <div class="pred-data">
                            <span class="pred-val">${unit}${gptForecast[asset].toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                            <div class="trend-indicator">${trend(gptForecast[asset])}</div>
                        </div>
                    </div>
                    
                    <div class="prediction-row gemini-row">
                        <div class="ai-label">Gemini</div>
                        <div class="pred-data">
                            <span class="pred-val">${geminiForecast && geminiForecast[asset] !== null && geminiForecast[asset] !== undefined 
                                ? unit + geminiForecast[asset].toLocaleString(undefined, { minimumFractionDigits: fractionDigits })
                                : 'データなし'}</span>
                            <div class="trend-indicator">${trend(geminiForecast && geminiForecast[asset] ? geminiForecast[asset] : null)}</div>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        }
    } catch (e) {
        console.error('AI Battle data loading error:', e);
        grid.innerHTML = `<p class="loading-msg">データ読み込みエラー: ${e.message}<br>ページを再読み込みしてください。</p>`;
    }
}

// --- Sandbox アコーディオン制御 ---
// script.js の initSandboxAccordion 関数を以下に書き換え
function initSandboxAccordion() {
    const headers = document.querySelectorAll('.sandbox-accordion-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const body = header.nextElementSibling;
            const isOpen = header.classList.contains('is-open');

            // 他を閉じる処理
            headers.forEach(h => {
                if (h !== header) {
                    h.classList.remove('is-open');
                    const b = h.nextElementSibling;
                    if (b) b.style.display = 'none';
                }
            });

            if (!isOpen) {
                header.classList.add('is-open');
                if (body) body.style.display = 'block';

                // アコーディオンが開いた時にデータを再読み込み
                loadAIBattle();

                // ★GA4 イベント送信: アコーディオンが開いた時
                if (typeof gtag === 'function') {
                    gtag('event', 'ai_battle_open', {
                        'event_category': 'engagement',
                        'event_label': 'AI Market Prediction Battle'
                    });
                }
            } else {
                header.classList.remove('is-open');
                if (body) body.style.display = 'none';
            }
        });
    });
}
// DOM準備完了後に一括初期化
document.addEventListener('DOMContentLoaded', () => {
    loadAIBattle();
    initSandboxAccordion();
});
        
        // ゲーム状態
        this.score = 0;
        this.lives = 3;
        this.gameRunning = false;
        this.keys = {};
        this.touchControls = {
            left: false,
            right: false,
            jump: false
        };
        
        // プレイヤー（スケール適用）
        this.player = {
            x: 50 * this.scale,
            y: 0, // 後で地面に合わせて設定
            width: 40 * this.scale,
            height: 40 * this.scale,
            velocityX: 0,
            velocityY: 0,
            speed: 5 * this.scale,
            jumpPower: 15 * this.scale,
            onGround: false,
            color: '#FF0000'
        };
        
        // 地面（キャンバスの高さに応じて動的に設定）
        this.ground = {
            y: this.height - 60,
            height: 60
        };
        
        // プレイヤーの初期位置を地面に合わせて調整
        this.player.y = this.ground.y - this.player.height;
        
        // プラットフォーム（スケール適用）
        const platformScale = this.scale;
        const baseGroundY = 340; // 基準の地面のY座標
        this.platforms = [
            { x: 200 * platformScale, y: (250 / baseGroundY) * this.ground.y, width: 100 * platformScale, height: 20 * platformScale },
            { x: 400 * platformScale, y: (200 / baseGroundY) * this.ground.y, width: 100 * platformScale, height: 20 * platformScale },
            { x: 600 * platformScale, y: (150 / baseGroundY) * this.ground.y, width: 100 * platformScale, height: 20 * platformScale }
        ];
        
        // コイン（スケール適用）
        this.coins = [
            { x: 250 * platformScale, y: (220 / baseGroundY) * this.ground.y, width: 20 * platformScale, height: 20 * platformScale, collected: false },
            { x: 450 * platformScale, y: (170 / baseGroundY) * this.ground.y, width: 20 * platformScale, height: 20 * platformScale, collected: false },
            { x: 650 * platformScale, y: (120 / baseGroundY) * this.ground.y, width: 20 * platformScale, height: 20 * platformScale, collected: false }
        ];
        
        // 5種類の敵（地面に合わせて配置）
        const enemyY = this.ground.y - 30 * platformScale;
        this.enemies = [
            // 種類1: 通常の敵（左右に移動）
            { 
                x: 300 * platformScale, y: enemyY, width: 30 * platformScale, height: 30 * platformScale, 
                velocityX: -2 * platformScale, velocityY: 0,
                color: '#FF00FF', 
                type: 'normal', 
                health: 1 
            },
            // 種類2: 高速の敵（速く移動）
            { 
                x: 500 * platformScale, y: enemyY, width: 30 * platformScale, height: 30 * platformScale, 
                velocityX: -4 * platformScale, velocityY: 0,
                color: '#FF0000', 
                type: 'fast', 
                health: 1 
            },
            // 種類3: 大型の敵（大きい、遅い）
            { 
                x: 700 * platformScale, y: this.ground.y - 50 * platformScale, width: 50 * platformScale, height: 50 * platformScale, 
                velocityX: -1 * platformScale, velocityY: 0,
                color: '#8B0000', 
                type: 'big', 
                health: 2 
            },
            // 種類4: ジャンプする敵
            { 
                x: 400 * platformScale, y: enemyY, width: 30 * platformScale, height: 30 * platformScale, 
                velocityX: -2 * platformScale, velocityY: 0,
                color: '#00FF00', 
                type: 'jumper', 
                health: 1, 
                jumpTimer: 0 
            },
            // 種類5: 追跡する敵（プレイヤーを追いかける）
            { 
                x: 600 * platformScale, y: enemyY, width: 30 * platformScale, height: 30 * platformScale, 
                velocityX: 0, velocityY: 0,
                color: '#FFA500', 
                type: 'chaser', 
                health: 1, 
                speed: 2 * platformScale 
            }
        ];
        
        this.init();
    }
    
    setupCanvas() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            const maxWidth = window.innerWidth - 40;
            this.canvas.width = Math.min(800, maxWidth);
            this.canvas.height = (this.canvas.width / 800) * 400;
        } else {
            this.canvas.width = 800;
            this.canvas.height = 400;
        }
        
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.scale = this.width / 800;
        
        // 地面の位置を再計算
        if (this.ground) {
            this.ground.y = this.height - 60 * this.scale;
            this.ground.height = 60 * this.scale;
        }
    }
    
    init() {
        // キーボードイベント
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') {
                e.preventDefault();
                this.jump();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // タッチ操作ボタン
        this.initTouchControls();
        
        // キャンバスタッチイベント
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTouch(e);
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchControls.left = false;
            this.touchControls.right = false;
            this.touchControls.jump = false;
        }, { passive: false });
        
        this.gameLoop();
    }
    
    initTouchControls() {
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnJump = document.getElementById('btn-jump');
        
        const setupButton = (btn, control, action) => {
            if (!btn) return;
            
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.touchControls[control] = true;
                if (action) action();
            }, { passive: false });
            
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.touchControls[control] = false;
            }, { passive: false });
            
            btn.addEventListener('mousedown', () => {
                this.touchControls[control] = true;
                if (action) action();
            });
            
            btn.addEventListener('mouseup', () => {
                this.touchControls[control] = false;
            });
        };
        
        setupButton(btnLeft, 'left');
        setupButton(btnRight, 'right');
        setupButton(btnJump, 'jump', () => this.jump());
    }
    
    handleTouch(e) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        if (x < this.width / 2) {
            this.touchControls.left = true;
            this.touchControls.right = false;
        } else {
            this.touchControls.right = true;
            this.touchControls.left = false;
        }
        
        if (y < this.height / 3) {
            this.jump();
        }
    }
    
    jump() {
        if (this.player.onGround && this.gameRunning) {
            this.player.velocityY = -this.player.jumpPower;
            this.player.onGround = false;
        }
    }
    
    update() {
        if (!this.gameRunning) return;
        
        // プレイヤーの移動
        if (this.keys['ArrowLeft'] || this.touchControls.left) {
            this.player.velocityX = -this.player.speed;
        } else if (this.keys['ArrowRight'] || this.touchControls.right) {
            this.player.velocityX = this.player.speed;
        } else {
            this.player.velocityX *= 0.8;
        }
        
        // 重力
        this.player.velocityY += 0.8 * this.scale;
        
        // 位置更新
        this.player.x += this.player.velocityX;
        this.player.y += this.player.velocityY;
        
        // 地面との衝突判定
        if (this.player.y + this.player.height >= this.ground.y) {
            this.player.y = this.ground.y - this.player.height;
            this.player.velocityY = 0;
            this.player.onGround = true;
        }
        
        // プラットフォームとの衝突判定
        this.player.onGround = false;
        for (let platform of this.platforms) {
            if (this.player.x < platform.x + platform.width &&
                this.player.x + this.player.width > platform.x &&
                this.player.y < platform.y + platform.height &&
                this.player.y + this.player.height > platform.y) {
                
                if (this.player.velocityY > 0) {
                    this.player.y = platform.y - this.player.height;
                    this.player.velocityY = 0;
                    this.player.onGround = true;
                }
            }
        }
        
        // 画面外に出ないように
        if (this.player.x < 0) this.player.x = 0;
        if (this.player.x + this.player.width > this.width) {
            this.player.x = this.width - this.player.width;
        }
        
        // コイン収集判定
        this.coins.forEach(coin => {
            if (!coin.collected &&
                this.player.x < coin.x + coin.width &&
                this.player.x + this.player.width > coin.x &&
                this.player.y < coin.y + coin.height &&
                this.player.y + this.player.height > coin.y) {
                coin.collected = true;
                this.score += 100;
                this.updateScore();
            }
        });
        
        // 敵の移動（種類ごとに異なる動作）
        this.enemies.forEach((enemy, index) => {
            switch(enemy.type) {
                case 'normal':
                case 'fast':
                    // 通常の左右移動
                    enemy.x += enemy.velocityX;
                    if (enemy.x < 0 || enemy.x + enemy.width > this.width) {
                        enemy.velocityX *= -1;
                    }
                    break;
                    
                case 'big':
                    // 大型敵：遅い移動
                    enemy.x += enemy.velocityX;
                    if (enemy.x < 0 || enemy.x + enemy.width > this.width) {
                        enemy.velocityX *= -1;
                    }
                    break;
                    
                case 'jumper':
                    // ジャンプする敵
                    enemy.jumpTimer++;
                    if (enemy.jumpTimer > 60) {
                        enemy.velocityY = -10 * this.scale;
                        enemy.jumpTimer = 0;
                    }
                    enemy.velocityY += 0.5 * this.scale;
                    enemy.y += enemy.velocityY;
                    enemy.x += enemy.velocityX;
                    
                    if (enemy.y + enemy.height >= this.ground.y) {
                        enemy.y = this.ground.y - enemy.height;
                        enemy.velocityY = 0;
                    }
                    
                    if (enemy.x < 0 || enemy.x + enemy.width > this.width) {
                        enemy.velocityX *= -1;
                    }
                    break;
                    
                case 'chaser':
                    // プレイヤーを追跡
                    const dx = this.player.x - enemy.x;
                    if (Math.abs(dx) > 5 * this.scale) {
                        enemy.velocityX = dx > 0 ? enemy.speed : -enemy.speed;
                    } else {
                        enemy.velocityX = 0;
                    }
                    enemy.x += enemy.velocityX;
                    break;
            }
            
            // プレイヤーとの衝突判定
            if (this.player.x < enemy.x + enemy.width &&
                this.player.x + this.player.width > enemy.x &&
                this.player.y < enemy.y + enemy.height &&
                this.player.y + this.player.height > enemy.y) {
                
                // プレイヤーが敵の上から踏んだ場合
                if (this.player.velocityY > 0 && 
                    this.player.y < enemy.y &&
                    this.player.y + this.player.height < enemy.y + enemy.height / 2) {
                    // 敵を倒す
                    enemy.health--;
                    if (enemy.health <= 0) {
                        this.enemies.splice(index, 1);
                        this.score += 200;
                        this.updateScore();
                    } else {
                        // バウンス
                        this.player.velocityY = -10 * this.scale;
                    }
                } else {
                    // 敵に当たった
                    this.hitEnemy();
                }
            }
        });
        
        // ゲームクリア判定
        if (this.coins.every(coin => coin.collected)) {
            this.gameWin();
        }
    }
    
    hitEnemy() {
        this.lives--;
        this.updateLives();
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            // リスポーン
            this.player.x = 50 * this.scale;
            this.player.y = this.ground.y - this.player.height;
            this.player.velocityX = 0;
            this.player.velocityY = 0;
        }
    }
    
    updateScore() {
        const scoreEl = document.getElementById('game-score');
        if (scoreEl) scoreEl.textContent = this.score;
    }
    
    updateLives() {
        const livesEl = document.getElementById('game-lives');
        if (livesEl) livesEl.textContent = this.lives;
    }
    
    gameOver() {
        this.gameRunning = false;
        alert('ゲームオーバー！スコア: ' + this.score);
        const resetBtn = document.getElementById('game-reset-btn');
        if (resetBtn) resetBtn.style.display = 'inline-block';
    }
    
    gameWin() {
        this.gameRunning = false;
        alert('クリア！スコア: ' + this.score);
        const resetBtn = document.getElementById('game-reset-btn');
        if (resetBtn) resetBtn.style.display = 'inline-block';
    }
    
    draw() {
        // 背景をクリア
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 地面を描画
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(0, this.ground.y, this.width, this.ground.height);
        this.ctx.fillStyle = '#228B22';
        this.ctx.fillRect(0, this.ground.y, this.width, 10);
        
        // プラットフォームを描画
        this.ctx.fillStyle = '#8B4513';
        this.platforms.forEach(platform => {
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        });
        
        // コインを描画
        this.ctx.fillStyle = '#FFD700';
        this.coins.forEach(coin => {
            if (!coin.collected) {
                this.ctx.beginPath();
                this.ctx.arc(coin.x + coin.width/2, coin.y + coin.height/2, coin.width/2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
        
        // 敵を描画（種類ごとに異なる見た目）
        this.enemies.forEach(enemy => {
            this.ctx.fillStyle = enemy.color;
            this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            
            // 種類ごとの装飾
            switch(enemy.type) {
                case 'normal':
                    // 通常敵：目を描画
                    this.ctx.fillStyle = '#000';
                    this.ctx.fillRect(enemy.x + 8, enemy.y + 8, 4, 4);
                    this.ctx.fillRect(enemy.x + 18, enemy.y + 8, 4, 4);
                    break;
                    
                case 'fast':
                    // 高速敵：矢印を描画
                    this.ctx.fillStyle = '#000';
                    this.ctx.beginPath();
                    this.ctx.moveTo(enemy.x + enemy.width/2, enemy.y + 5);
                    this.ctx.lineTo(enemy.x + enemy.width/2 - 5, enemy.y + 15);
                    this.ctx.lineTo(enemy.x + enemy.width/2 + 5, enemy.y + 15);
                    this.ctx.closePath();
                    this.ctx.fill();
                    break;
                    
                case 'big':
                    // 大型敵：目を描画
                    this.ctx.fillStyle = '#000';
                    this.ctx.fillRect(enemy.x + 10, enemy.y + 10, 8, 8);
                    this.ctx.fillRect(enemy.x + 32, enemy.y + 10, 8, 8);
                    // 口を描画
                    this.ctx.fillRect(enemy.x + 15, enemy.y + 25, 20, 5);
                    break;
                    
                case 'jumper':
                    // ジャンプ敵：矢印を描画
                    this.ctx.fillStyle = '#000';
                    this.ctx.beginPath();
                    this.ctx.moveTo(enemy.x + enemy.width/2, enemy.y);
                    this.ctx.lineTo(enemy.x + enemy.width/2 - 5, enemy.y + 10);
                    this.ctx.lineTo(enemy.x + enemy.width/2 + 5, enemy.y + 10);
                    this.ctx.closePath();
                    this.ctx.fill();
                    break;
                    
                case 'chaser':
                    // 追跡敵：目を描画
                    this.ctx.fillStyle = '#FF0000';
                    this.ctx.fillRect(enemy.x + 5, enemy.y + 5, 6, 6);
                    this.ctx.fillRect(enemy.x + 19, enemy.y + 5, 6, 6);
                    break;
            }
        });
        
        // プレイヤーを描画
        this.ctx.fillStyle = this.player.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // 目を描画（マリオ風）
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(this.player.x + 10, this.player.y + 10, 5, 5);
        this.ctx.fillRect(this.player.x + 25, this.player.y + 10, 5, 5);
    }
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    start() {
        this.gameRunning = true;
        this.score = 0;
        this.lives = 3;
        this.updateScore();
        this.updateLives();
        const startBtn = document.getElementById('game-start-btn');
        const resetBtn = document.getElementById('game-reset-btn');
        if (startBtn) startBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
        
        // リセット
        this.player.x = 50 * this.scale;
        this.player.y = this.ground.y - this.player.height;
        this.player.velocityX = 0;
        this.player.velocityY = 0;
        
        this.coins.forEach(coin => coin.collected = false);
        
        // 敵をリセット
        const enemyY = this.ground.y - 30 * this.scale;
        this.enemies = [
            { x: 300 * this.scale, y: enemyY, width: 30 * this.scale, height: 30 * this.scale, velocityX: -2 * this.scale, velocityY: 0, color: '#FF00FF', type: 'normal', health: 1 },
            { x: 500 * this.scale, y: enemyY, width: 30 * this.scale, height: 30 * this.scale, velocityX: -4 * this.scale, velocityY: 0, color: '#FF0000', type: 'fast', health: 1 },
            { x: 700 * this.scale, y: this.ground.y - 50 * this.scale, width: 50 * this.scale, height: 50 * this.scale, velocityX: -1 * this.scale, velocityY: 0, color: '#8B0000', type: 'big', health: 2 },
            { x: 400 * this.scale, y: enemyY, width: 30 * this.scale, height: 30 * this.scale, velocityX: -2 * this.scale, velocityY: 0, color: '#00FF00', type: 'jumper', health: 1, jumpTimer: 0 },
            { x: 600 * this.scale, y: enemyY, width: 30 * this.scale, height: 30 * this.scale, velocityX: 0, velocityY: 0, color: '#FFA500', type: 'chaser', health: 1, speed: 2 * this.scale }
        ];
    }
    
    reset() {
        this.start();
    }
}

// ゲーム初期化
let marioGame = null;

function initMarioGameHandlers() {
    const startBtn = document.getElementById('game-start-btn');
    const resetBtn = document.getElementById('game-reset-btn');
    
    console.log('initMarioGameHandlers called, startBtn:', startBtn, 'resetBtn:', resetBtn);
    
    // 既存のイベントリスナーを削除するために、ボタンをクローンして置き換え
    if (startBtn) {
        // 既存のイベントリスナーを削除
        const newStartBtn = startBtn.cloneNode(true);
        startBtn.parentNode.replaceChild(newStartBtn, startBtn);
        
        newStartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('ゲーム開始ボタンがクリックされました');
            
            const canvas = document.getElementById('game-canvas');
            if (!canvas) {
                console.error('キャンバスが見つかりません');
                return;
            }
            
            if (!marioGame) {
                console.log('ゲームを初期化します');
                marioGame = new MarioGame('game-canvas');
                if (!marioGame || !marioGame.canvas) {
                    console.error('ゲームの初期化に失敗しました');
                    return;
                }
            }
            console.log('ゲームを開始します');
            marioGame.start();
        });
        
        // マウスイベントも追加（PC用）
        newStartBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('ゲーム開始ボタンがマウスダウンされました');
        });
    } else {
        console.error('game-start-btn が見つかりません');
    }
    
    if (resetBtn) {
        const newResetBtn = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
        
        newResetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (marioGame) marioGame.reset();
        });
    }
    
    // 画面リサイズ対応（一度だけ登録）
    if (!window.marioGameResizeHandler) {
        window.marioGameResizeHandler = () => {
            if (marioGame) {
                marioGame.setupCanvas();
            }
        };
        window.addEventListener('resize', window.marioGameResizeHandler);
    }
    
    if (!window.marioGameOrientationHandler) {
        window.marioGameOrientationHandler = () => {
            setTimeout(() => {
                if (marioGame) {
                    marioGame.setupCanvas();
                }
            }, 100);
        };
        window.addEventListener('orientationchange', window.marioGameOrientationHandler);
    }
}