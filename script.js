/**
 * ENZO WORKS - AI Sandbox Battle (Refined Version)
 */
async function loadAIBattle() {
    const grid = document.getElementById('ai-grid');
    try {
        const res = await fetch('./ai_predictions.json?t=' + new Date().getTime());
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();

        // 1. 全体の更新情報（ここだけに集約）
        const lastUpdated = document.getElementById('update-time');
        if (lastUpdated) lastUpdated.innerText = data.metadata.last_updated;

        // 2. 的中率の反映
        const stats = data.overall_stats;
        document.getElementById('gpt-win-rate').innerText = stats["GPT-3.5"].win_rate;
        document.getElementById('gemini-win-rate').innerText = stats["Gemini"].win_rate;

        // 3. バトルカード生成
        grid.innerHTML = '';
        const currentPrices = data.latest_forecast.current_prices;
        const gptForecast = data.latest_forecast.GPT;
        const geminiForecast = data.latest_forecast.Gemini;
        const judgments = data.today_judgement || [];

        for (const [asset, current] of Object.entries(currentPrices)) {
            const unit = asset === "S&P 500" ? "$" : "¥";
            const fractionDigits = asset === "USD/JPY" ? 3 : 2;
            const myJudge = judgments.find(j => j.asset === asset);

            const card = document.createElement('div');
            card.className = 'asset-card';
            
            // --- 過去：本日の決着判定 ---
            let judgeHTML = `<div class="judge-section empty">本日決着：データ蓄積中</div>`;
            if (myJudge) {
                judgeHTML = `
                    <div class="judge-section">
                        <div class="judge-title">⚔️ 5日前AI予想 vs 本日価格</div>
                        <div class="judge-result">
                            <span>GPT: ${myJudge.gpt_result}</span> / <span>Gemini: ${myJudge.gemini_result}</span>
                        </div>
                    </div>`;
            }

            // --- 未来：最新AI予想 ---
            const trend = (val) => {
                const diffRate = ((val - current) / current) * 100;
                const isUp = diffRate > 0;
                const sign = isUp ? 'plus' : (diffRate < 0 ? 'minus' : 'flat');
                const arrowText = isUp ? '▲ 上昇' : (diffRate < 0 ? '▼ 下落' : '― 横ばい');
                const rateText = `${diffRate >= 0 ? '+' : ''}${diffRate.toFixed(2)}%`;
                return `<span class="${sign}">${arrowText} (${rateText})</span>`;
            };

            card.innerHTML = `
                <div class="asset-header">
                    <span class="asset-name">${asset}</span>
                    <span class="current-price">現在値: ${unit}${current.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
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
                            <span class="pred-val">${unit}${geminiForecast[asset].toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                            <div class="trend-indicator">${trend(geminiForecast[asset])}</div>
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