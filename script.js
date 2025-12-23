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
        }
        if (stats && stats["Gemini"]) {
            const geminiWinRateEl = document.getElementById('gemini-win-rate');
            if (geminiWinRateEl) geminiWinRateEl.innerText = stats["Gemini"].win_rate;
            const geminiAvgErrorEl = document.getElementById('gemini-avg-error');
            if (geminiAvgErrorEl) geminiAvgErrorEl.innerText = stats["Gemini"].avg_error;
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
                    const gptResult = gptJudge ? (gptJudge.direction_correct ? '✓ 的中' : '✗ 外れ') : 'データなし';
                    const geminiResult = geminiJudge ? (geminiJudge.direction_correct ? '✓ 的中' : '✗ 外れ') : 'データなし';
                    
                    judgeHTML = `
                        <div class="judge-section">
                            <div class="judge-title">⚔️ 5日前AI予想 vs 本日価格</div>
                            <div class="judge-result">
                                <span>GPT: ${gptResult}</span> / <span>Gemini: ${geminiResult}</span>
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