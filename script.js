/**
 * ENZO WORKS - AI Sandbox Battle (Refined Version)
 */
async function loadAIBattle() {
    const grid = document.getElementById('ai-grid');
    if (!grid) return;

    // 既にロード中の場合は処理をスキップ
    if (grid.dataset.loading === 'true') return;
    grid.dataset.loading = 'true';

    grid.innerHTML = '<div class="loading-msg">Initializing Battle Data...</div>';

    try {
        const res = await fetch('ai_predictions.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.latest_forecast || !data.latest_forecast.GPT || !data.latest_forecast.Gemini) {
            throw new Error('Invalid data structure');
        }

        const gptForecast = data.latest_forecast.GPT;
        const geminiForecast = data.latest_forecast.Gemini;
        const currentPrices = data.latest_forecast.current_prices || {};
        const judgments = data.today_judgement || [];

        // 全体統計を表示
        if (data.overall_stats) {
            const stats = data.overall_stats;
            const gptWinRate = document.getElementById('gpt-win-rate');
            const geminiWinRate = document.getElementById('gemini-win-rate');
            const gptAvgError = document.getElementById('gpt-avg-error');
            const geminiAvgError = document.getElementById('gemini-avg-error');
            const gptCount = document.getElementById('gpt-count');
            const geminiCount = document.getElementById('gemini-count');

            if (gptWinRate) gptWinRate.textContent = stats["GPT-3.5"]?.win_rate?.toFixed(1) || '--';
            if (geminiWinRate) geminiWinRate.textContent = stats["Gemini"]?.win_rate?.toFixed(1) || '--';
            if (gptAvgError) gptAvgError.textContent = stats["GPT-3.5"]?.avg_error?.toFixed(2) || '--';
            if (geminiAvgError) geminiAvgError.textContent = stats["Gemini"]?.avg_error?.toFixed(2) || '--';
            if (gptCount) gptCount.textContent = stats["GPT-3.5"]?.count || '--';
            if (geminiCount) geminiCount.textContent = stats["Gemini"]?.count || '--';
        }


        // 市場状況を取得
        const marketStatus = data.market_status || {};

        // グリッドをクリア（重複防止）
        grid.innerHTML = '';

        for (const [asset, current] of Object.entries(currentPrices)) {
            const unit = asset === "S&P 500" ? "$" : "¥";
            const fractionDigits = asset === "USD/JPY" ? 3 : 2;
            
            // 市場状況を取得
            const status = marketStatus[asset] || { is_open: true, message: "市場は開いています" };
            const marketStatusHTML = status.is_open 
                ? `<span class="market-status open">🟢 ${status.message}</span>`
                : `<span class="market-status closed">🔴 ${status.message}</span>`;
            
            // 決着判定の検索（asset_nameを使用）
            // 重複を防ぐため、同じasset_name, ai_model, dateの組み合わせで最新のもののみを表示
            const todayJudgments = judgments
                .filter(j => j.asset_name === asset && j.status === 'settled')
                .reduce((acc, j) => {
                    const key = `${j.asset_name}_${j.ai_model}_${j.date}`;
                    if (!acc[key] || new Date(j.date) > new Date(acc[key].date)) {
                        acc[key] = j;
                    }
                    return acc;
                }, {});
            const uniqueJudgments = Object.values(todayJudgments);
            
            // --- 過去：本日の決着判定 ---
            let judgeHTML = `<div class="judge-section empty">本日決着：データ蓄積中</div>`;
            if (uniqueJudgments.length > 0) {
                judgeHTML = '<div class="judge-section"><div class="judge-title">5日前AI予想 vs 本日価格</div>';
                for (const j of uniqueJudgments) {
                    const isHit = j.direction_correct;
                    const errorRate = j.error_rate?.toFixed(2) || '0.00';
                    const predicted = j.predicted_price?.toFixed(fractionDigits) || '0';
                    const actual = j.actual_price?.toFixed(fractionDigits) || '0';
                    const hitIcon = isHit ? '✓' : '✗';
                    const hitText = isHit ? '的中' : '外れ';
                    const hitClass = isHit ? 'hit' : 'miss';
                    
                    judgeHTML += `
                        <div class="judge-item ${hitClass}">
                            <div class="judge-label">${j.ai_model}:</div>
                            <div class="judge-detail">
                                <span class="judge-result">${hitIcon} ${hitText}</span>
                                <span>誤差: ${errorRate}%</span>
                                <span>予測: ${unit}${predicted}</span>
                                <span>実際: ${unit}${actual}</span>
                            </div>
                        </div>
                    `;
                }
                judgeHTML += '</div>';
            }
            
            // --- 最新予想 ---
            const gptPred = gptForecast[asset];
            const geminiPred = geminiForecast && geminiForecast[asset] ? geminiForecast[asset] : null;
            
            const trend = (val) => {
                if (!val || !current) return '';
                const change = ((val - current) / current) * 100;
                if (change > 0.2) return `<span class="trend-up">▲ 上昇 +${change.toFixed(2)}%</span>`;
                if (change < -0.2) return `<span class="trend-down">▼ 下落 ${change.toFixed(2)}%</span>`;
                return `<span class="trend-neutral">→ 横ばい ${change.toFixed(2)}%</span>`;
            };

            const card = document.createElement('div');
            card.className = 'ai-card';
            card.innerHTML = `
                <div class="card-header">
                    <h3>${asset}</h3>
                    <div class="current-price">現在値: ${unit}${current.toFixed(fractionDigits)}</div>
                    <div class="market-status-container">${marketStatusHTML}</div>
                </div>
                ${judgeHTML}
                <div class="forecast-section">
                    <div class="forecast-title">最新AI予想 (5営業日後の終値)</div>
                    <div class="forecast-items">
                        <div class="forecast-item gpt">
                            <span class="model-label">GPT-3.5:</span>
                            <span class="forecast-value">${gptPred ? unit + gptPred.toFixed(fractionDigits) : 'データなし'}</span>
                            <div class="trend-indicator">${trend(gptPred)}</div>
                        </div>
                        <div class="forecast-item gemini">
                            <span class="model-label">Gemini Flash:</span>
                            <span class="forecast-value">${geminiPred ? unit + geminiPred.toFixed(fractionDigits) 
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
        grid.innerHTML = `<div class="error-msg">データの読み込みに失敗しました: ${e.message}</div>`;
    } finally {
        grid.dataset.loading = 'false';
    }
}

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
