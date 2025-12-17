/**
 * ENZO WORKS - AI Sandbox Battle (Final Version)
 * 「過去の答え合わせ」と「未来の予測」をダブルで表示します。
 */
async function loadAIBattle() {
    const grid = document.getElementById('ai-grid');
    try {
        const res = await fetch('./ai_predictions.json?t=' + new Date().getTime());
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();

        // 1. メタ情報の更新
        document.getElementById('update-time').innerText = data.metadata.last_updated;
        document.getElementById('target-date').innerText = data.metadata.target_date;

        // 2. 累計戦績（方向性的中率）の更新
        const stats = data.overall_stats;
        document.getElementById('gpt-win-rate').innerText = stats["GPT-3.5"].win_rate;
        document.getElementById('gpt-avg-error').innerText = stats["GPT-3.5"].avg_error;
        document.getElementById('gemini-win-rate').innerText = stats["Gemini"].win_rate;
        document.getElementById('gemini-avg-error').innerText = stats["Gemini"].avg_error;

        // 3. メイングリッドの生成
        grid.innerHTML = '';

        const currentPrices = data.latest_forecast.current_prices;
        const gptForecast = data.latest_forecast.GPT;
        const geminiForecast = data.latest_forecast.Gemini;
        const judgments = data.today_judgement || [];

        for (const [asset, current] of Object.entries(currentPrices)) {
            const unit = asset === "S&P 500" ? "$" : "¥";
            const fractionDigits = asset === "USD/JPY" ? 3 : 2;

            const card = document.createElement('div');
            card.className = 'asset-card';
            
            // --- セクション1: 本日の決着 (判定があれば表示) ---
            let judgeHTML = `<div class="judge-section empty">決着判定：データ蓄積中</div>`;
            const myJudge = judgments.find(j => j.asset === asset);
            if (myJudge) {
                judgeHTML = `
                    <div class="judge-section">
                        <div class="judge-title">🏆 5日前からの予言・本日の結果</div>
                        <div class="judge-result">
                            <span>GPT: ${myJudge.gpt_result}</span> / <span>Gemini: ${myJudge.gemini_result}</span>
                        </div>
                    </div>`;
            }

            // --- セクション2: 最新予測 (未来) ---
            const getTrendIcon = (pred, cur) => pred > cur ? '<span class="plus">▲ 上昇予想</span>' : '<span class="minus">▼ 下落予想</span>';

            card.innerHTML = `
                <div class="asset-header">
                    <span class="asset-name">${asset}</span>
                    <span class="current-price">現在値: ${unit}${current.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                </div>
                
                ${judgeHTML}

                <div class="prediction-box">
                    <div class="target-label-main">${data.metadata.target_date} の終値予言</div>
                    
                    <div class="prediction-row gpt-row">
                        <div class="ai-label"><i class="fa-solid fa-robot"></i> GPT-3.5</div>
                        <div class="pred-data">
                            <span class="pred-val">${unit}${gptForecast[asset].toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                            <div class="trend-indicator">${getTrendIcon(gptForecast[asset], current)}</div>
                        </div>
                    </div>
                    
                    <div class="prediction-row gemini-row">
                        <div class="ai-label"><i class="fa-solid fa-star"></i> Gemini</div>
                        <div class="pred-data">
                            <span class="pred-val">${unit}${geminiForecast[asset].toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                            <div class="trend-indicator">${getTrendIcon(geminiForecast[asset], current)}</div>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        }
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<p class="loading-msg">データ同期中...</p>';
    }
}

document.addEventListener('DOMContentLoaded', loadAIBattle);