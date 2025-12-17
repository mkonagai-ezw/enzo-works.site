/**
 * AI Price Battle - Sandbox Module
 * データを取得し、Sandbox領域内のUIを更新します。
 */
const AISandbox = {
    async init() {
        try {
            const response = await fetch('ai_predictions.json');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            this.render(data);
        } catch (error) {
            console.error('Failed to load AI predictions:', error);
            const container = document.getElementById('battle-container');
            if (container) container.innerHTML = '<p style="color:gray;">Prediction data unavailable.</p>';
        }
    },

    render(data) {
        // メタ情報の更新
        const lastUpdated = document.getElementById('last-updated');
        const targetDate = document.getElementById('target-date');
        
        if (lastUpdated) lastUpda/**
 * ENZO WORKS - AI Sandbox Script
 * 最新の予測データと戦績を表示します。
 */
async function loadAI() {
    try {
        // キャッシュ回避のためにタイムスタンプを付与
        const res = await fetch('./ai_predictions.json?t=' + new Date().getTime());
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();

        // 1. メタ情報の表示
        document.getElementById('update-time').innerText = data.metadata.last_updated;
        document.getElementById('target-date').innerText = data.metadata.target_date;

        // 2. 累計戦績の反映
        const stats = data.overall_stats;
        document.getElementById('gpt-win-rate').innerText = stats["GPT-3.5"].win_rate;
        document.getElementById('gpt-avg-error').innerText = stats["GPT-3.5"].avg_error;
        document.getElementById('gemini-win-rate').innerText = stats["Gemini"].win_rate;
        document.getElementById('gemini-avg-error').innerText = stats["Gemini"].avg_error;

        // 3. 予測カードの生成
        const grid = document.getElementById('ai-grid');
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
            
            // トレンド判定（現在値より上か下か）
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
        document.getElementById('ai-grid').innerHTML = '<p class="loading-msg" style="color:#ff4d4d">Data Syncing... Please wait for the next update.</p>';
    }
}

// ページロード時に実行
document.addEventListener('DOMContentLoaded', loadAI);ted.textContent = data.metadata.last_updated;
        if (targetDate) targetDate.textContent = data.metadata.target_date;

        // 統計情報の更新 (勝率など)
        this.updateStats('gpt', data.overall_stats["GPT-3.5"]);
        this.updateStats('gemini', data.overall_stats["Gemini"]);

        // バトルカードの生成
        const container = document.getElementById('battle-container');
        if (!container) return;
        
        container.innerHTML = ''; // ローディング表示をクリア

        const assets = data.latest_forecast.current_prices;
        for (const [name, current] of Object.entries(assets)) {
            const gptPred = data.latest_forecast.GPT[name];
            const geminiPred = data.latest_forecast.Gemini[name];
            
            const card = this.createCard(name, current, gptPred, geminiPred);
            container.appendChild(card);
        }
    },

    updateStats(prefix, stats) {
        const winRateEl = document.getElementById(`${prefix}-win-rate`);
        const errorEl = document.getElementById(`${prefix}-avg-error`);
        if (winRateEl) winRateEl.textContent = `${stats.win_rate}%`;
        if (errorEl) errorEl.textContent = `${stats.avg_error}%`;
    },

    createCard(name, current, gpt, gemini) {
        const card = document.createElement('div');
        card.className = 'sandbox-card';
        
        // 騰落予想の判定
        const gptTrend = gpt > current ? 'up' : 'down';
        const geminiTrend = gemini > current ? 'up' : 'down';

        card.innerHTML = `
            <div class="asset-info">
                <span class="asset-name">${name}</span>
                <span class="current-val">Now: ${current.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div class="battle-grid">
                <div class="pred-item ${gptTrend}">
                    <small>GPT</small>
                    <div>${gpt.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                <div class="vs-divider">VS</div>
                <div class="pred-item ${geminiTrend}">
                    <small>Gemini</small>
                    <div>${gemini.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
            </div>
        `;
        return card;
    }
};

// ページ読み込み完了時に実行
document.addEventListener('DOMContentLoaded', () => AISandbox.init());