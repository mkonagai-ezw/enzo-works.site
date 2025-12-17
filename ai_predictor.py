import os
import json
import yfinance as yf
from openai import OpenAI
from google import genai
from datetime import datetime, timedelta
import re

# --- 環境変数 ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# --- 設定 ---
TARGETS = {
    "USD/JPY": "USDJPY=X",
    "Nikkei 225": "^N225",
    "S&P 500": "^GSPC"
}
PREDICT_DAYS = 5
HISTORY_FILE = "ai_history.json"

def get_market_data(ticker):
    """市場データを取得"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    df = yf.download(ticker, start=start_date, end=end_date, progress=False)
    if df.empty: return None, None
    
    current_price = float(df['Close'].iloc[-1])
    price_str_list = []
    # yfinanceの最新仕様に合わせて型変換
    for date, row in df.tail(30).iterrows():
        try:
            val = float(row['Close'])
            price_str_list.append(f"{date.strftime('%Y-%m-%d')}: {val:.2f}")
        except: continue
    return "\n".join(price_str_list), current_price

def ask_ai_batch(client, model, prompt):
    """一括でAIに予測を依頼し、JSONとして解析する"""
    try:
        if "gpt" in model:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.choices[0].message.content
        elif "gemini" in model:
            response = client.models.generate_content(model=model, contents=prompt)
            content = response.text

        # JSON部分を抽出 (AIが余計な文言を添えても大丈夫なように)
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            return json.loads(match.group())
        return None
    except Exception as e:
        print(f"AI Error ({model}): {e}")
        return None

def main():
    if not OPENAI_API_KEY or not GEMINI_API_KEY:
        print("Error: API Key missing.")
        return

    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

    # 履歴データの読み込み
    history_data = {"records": []}
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            history_data = json.load(f)

    today_str = datetime.now().strftime("%Y-%m-%d")
    target_date = (datetime.now() + timedelta(days=PREDICT_DAYS)).strftime("%Y-%m-%d")

    # 1. 全銘柄のデータを一括で準備
    all_assets_info = ""
    current_prices = {}
    for asset_name, ticker in TARGETS.items():
        hist_str, price = get_market_data(ticker)
        if price:
            current_prices[asset_name] = price
            all_assets_info += f"\n### {asset_name}\n現在値: {price:.2f}\n過去データ:\n{hist_str}\n"

    # 2. 一括プロンプト作成（金融プロ仕様）
    prompt = f"""
    あなたは凄腕の金融アナリストです。以下の3つの銘柄について、{PREDICT_DAYS}日後の終値を論理的に予測してください。
    
    【重要ルール】
    1. 現在の価格と全く同じ数値を答えることは「厳禁」です。必ず市場のボラティリティを考慮した変動を予測してください。
    2. 精度について:
       - USD/JPY: 小数点第3位（0.001円単位）まで予測せよ。
       - Nikkei 225 / S&P 500: 小数点第2位まで予測せよ。
    3. 過去30日のトレンドを分析し、根拠のある数値を算出してください。

    回答は必ず以下のJSON形式のみで出力し、解説は一切不要です。
    {{
        "USD/JPY": 0.000,
        "Nikkei 225": 0.00,
        "S&P 500": 0.00
    }}
    --- 銘柄データ ---
    {all_assets_info}
    """

    # 3. AIに一括依頼 (1回ずつ)
    print("GPTに一括予測を依頼中...")
    gpt_res = ask_ai_batch(openai_client, "gpt-3.5-turbo", prompt)
    
    print("Geminiに一括予測を依頼中...")
    gem_res = ask_ai_batch(gemini_client, "gemini-1.5-flash", prompt)

    # 4. 結果の整理と保存
    output_data = {"last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "assets": {}}
    
    for asset in TARGETS.keys():
        if asset in current_prices:
            curr = current_prices[asset]
            g_pred = gpt_res.get(asset) if gpt_res else None
            m_pred = gem_res.get(asset) if gem_res else None
            
            output_data["assets"][asset] = {
                "current_price": round(curr, 2),
                "gpt_prediction": round(g_pred, 2) if g_pred else None,
                "gemini_prediction": round(m_pred, 2) if m_pred else None,
                "gpt_change": round(((g_pred - curr)/curr)*100, 2) if g_pred else None,
                "gemini_change": round(((m_pred - curr)/curr)*100, 2) if m_pred else None,
            }

            # 履歴に保存（答え合わせ用）
            for model_name, val in [("GPT-3.5", g_pred), ("Gemini", m_pred)]:
                if val:
                    history_data["records"].append({
                        "date": today_str, "target_date": target_date, "asset_name": asset,
                        "ai_model": model_name, "start_price": curr, "predicted_price": val,
                        "actual_price": None, "result": None, "status": "pending"
                    })

    # 表示用JSON
    with open("ai_predictions.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4, ensure_ascii=False)
    # 履歴用JSON
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=4, ensure_ascii=False)

    print("一括予測が完了しました。")

if __name__ == "__main__":
    main()