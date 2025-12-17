/**
 * ENZO WORKS - AI Sandbox Battle Dashboard
 * 最新の予測データと累計戦績を表示します。
 */
async function loadAIBattle() {
    const grid = document.getElementById('ai-grid');
    try {
        // キャッシュ回避のためにタイムスタンプを付与
        const res = await fetch('./ai_predictions.json?t=' + new Date().getTime());
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();

        // 1. メタ情報の表示
        const lastUpdated = document.getElementById('update-time');
        const targetDate = document.getElementById('target-date');
        if (lastUpdated) lastUpdated.innerText = data.metadata.last_updated;
        if (targetDate) targetDate.innerText = data.metadata.target_date;

        // 2. 累計戦績の表示 (overall_stats)
        const stats = data.overall_stats;
        document.getElementById('gpt-win-rate').innerText = stats["GPT-3.5"].win_rate;
        document.getElementById('gpt-avg-error').innerText = stats["GPT-3.5"].avg_error;
        document.getElementById('gemini-win-rate').innerText = stats["Gemini"].win_rate;
        document.getElementById('gemini-avg-error').innerText = stats["Gemini"].avg_error;

        // 3. 予測カードの生成 (latest_forecast)
        grid.innerHTML = '';
        const currentPrices = data.latest_forecast.current_prices;
        const gptForecast = data.latest_forecast.GPT;
        const geminiForecast = data.latest_forecast.Gemini;

        for (const [asset, current] of Object.entries(currentPrices)) {
            const gptVal = gptForecast[asset];
            const geminiVal = geminiForecast[asset];
            
            // 銘柄ごとの単位と桁数設定
            const unit = asset === "S&P 500" ? "$" : "¥";
            const fractionDigits = asset === "USD/JPY" ? 3 : 2;

            const card = document.createElement('div');
            card.className = 'asset-card';
            
            // トレンド判定クラス（現在値より上か下か）
            const getTrendClass = (pred, cur) => pred > cur ? 'plus' : 'minus';
            const getTrendIcon = (pred, cur) => pred > cur ? '▲' : '▼';

            card.innerHTML = `
                <div class="asset-header">
                    <span class="asset-name">${asset}</span>
                    <span class="current-price">NOW: ${unit}${current.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                </div>
                <div class="prediction-row gpt-row">
                    <div class="ai-label"><i class="fa-solid fa-robot"></i> GPT-3.5</div>
                    <div class="pred-data">
                        <span class="pred-val">${unit}${gptVal.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                        <span class="trend-icon ${getTrendClass(gptVal, current)}">${getTrendIcon(gptVal, current)}</span>
                    </div>
                </div>
                <div class="prediction-row gemini-row">
                    <div class="ai-label"><i class="fa-solid fa-star"></i> Gemini</div>
                    <div class="pred-data">
                        <span class="pred-val">${unit}${geminiVal.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                        <span class="trend-icon ${getTrendClass(geminiVal, current)}">${getTrendIcon(geminiVal, current)}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        }
    } catch (e) {
        console.error("AI Data Load Error:", e);
        if (grid) grid.innerHTML = '<p class="loading-msg" style="color:#ff4d4d">Data Syncing... Please wait for the next update.</p>';
    }
}

// DOM読み込み完了時に実行
document.addEventListener('DOMContentLoaded', loadAIBattle);