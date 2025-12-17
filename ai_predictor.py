import os
import json
import time
import re
import yfinance as yf
import requests
from openai import OpenAI
from datetime import datetime, timedelta

# --- 環境変数 ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

# --- 設定 ---
TARGETS = {
    "USD/JPY": "USDJPY=X",
    "Nikkei 225": "^N225",
    "S&P 500": "^GSPC"
}
HISTORY_FILE = "ai_history.json"
OUTPUT_FILE = "ai_predictions.json"

# --- 営業日計算関数 ---
def get_target_date(start_date, business_days=5):
    """単純な5日後ではなく、土日を考慮した5営業日後(来週の同じ曜日)を計算"""
    # 実際には祝日の考慮を厳密に行うのは大変なため、週を跨ぐ「+7日」を基本とします
    target = start_date + timedelta(days=7)
    # ターゲットが土日になった場合の補正
    if target.weekday() == 5: target += timedelta(days=2) # 土->月
    elif target.weekday() == 6: target += timedelta(days=1) # 日->月
    return target

# --- 市場データ・AI通信関数 ---
def get_market_data(ticker):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    df = yf.download(ticker, start=start_date, end=end_date, progress=False)
    if df.empty: return None, None
    current_price = float(df['Close'].iloc[-1])
    price_str_list = [f"{d.strftime('%Y-%m-%d')}: {float(r['Close']):.3f}" for d, r in df.tail(30).iterrows()]
    return "\n".join(price_str_list), current_price

def ask_gpt(client, prompt):
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        return parse_json_response(response.choices[0].message.content, "GPT-3.5")
    except Exception as e:
        print(f"GPT Error: {e}")
        return None

def ask_gemini(prompt):
    if not GEMINI_API_KEY: return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
    try:
        response = requests.post(url, headers={'Content-Type': 'application/json'}, 
                                 json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=30)
        if response.status_code != 200: return None
        res_json = response.json()
        return parse_json_response(res_json['candidates'][0]['content']['parts'][0]['text'], "Gemini")
    except: return None

def parse_json_response(content, model_name):
    print(f"--- DEBUG [{model_name}] Raw Response ---\n{content}\n---")
    try:
        clean_content = re.sub(r'```json|```', '', content).strip()
        match = re.search(r'(\{.*\})', clean_content, re.DOTALL)
        return json.loads(match.group(1)) if match else None
    except: return None

# --- 答え合わせ・統計ロジック ---
def update_history_with_actuals(history):
    """過去の未確定予測を今日の価格で答え合わせ"""
    today_str = datetime.now().strftime("%Y-%m-%d")
    for record in history.get("records", []):
        if record["status"] == "pending" and record["target_date"] <= today_str:
            ticker = TARGETS.get(record["asset_name"])
            _, actual_price = get_market_data(ticker)
            if actual_price:
                record["actual_price"] = actual_price
                # 方向性判定
                pred_up = record["predicted_price"] > record["start_price"]
                actual_up = actual_price > record["start_price"]
                record["direction_correct"] = (pred_up == actual_up)
                # 乖離率
                record["error_rate"] = round(abs((record["predicted_price"] - actual_price) / actual_price) * 100, 3)
                record["status"] = "settled"

def calculate_stats(history):
    stats = {}
    for model in ["GPT-3.5", "Gemini"]:
        recs = [r for r in history.get("records", []) if r["ai_model"] == model and r["status"] == "settled"]
        if not recs:
            stats[model] = {"win_rate": 0, "avg_error": 0, "count": 0}
            continue
        wins = sum(1 for r in recs if r.get("direction_correct"))
        avg_err = sum(r.get("error_rate", 0) for r in recs) / len(recs)
        stats[model] = {"win_rate": round(wins/len(recs)*100, 1), "avg_error": round(avg_err, 2), "count": len(recs)}
    return stats

# --- メイン処理 ---
def main():
    if not OPENAI_API_KEY or not GEMINI_API_KEY: return
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

    # 履歴読み込み
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f: history = json.load(f)
    else: history = {"records": []}

    # 1. 答え合わせ実行
    print("Settling past predictions...")
    update_history_with_actuals(history)

    # 2. 最新データの準備
    today_dt = datetime.now()
    target_dt = get_target_date(today_dt)
    
    all_assets_info = ""
    current_prices = {}
    for asset, ticker in TARGETS.items():
        hist, price = get_market_data(ticker)
        if price:
            current_prices[asset] = price
            all_assets_info += f"\n### {asset}\nNow: {price}\nHistory:\n{hist}\n"

    # 3. AI予測
    prompt = f"Date: {today_dt.strftime('%Y-%m-%d')}. Predict prices for {target_dt.strftime('%Y-%m-%d')} (5 business days later). Output ONLY JSON: {{\"USD/JPY\":0.000, \"Nikkei 225\":0.00, \"S&P 500\":0.00}}\nData:\n{all_assets_info}"
    
    gpt_res = ask_gpt(openai_client, prompt)
    gem_res = ask_gemini(prompt)

    # 4. 履歴への追加
    for asset, curr in current_prices.items():
        for model, res in [("GPT-3.5", gpt_res), ("Gemini", gem_res)]:
            if res and asset in res:
                history["records"].append({
                    "date": today_dt.strftime("%Y-%m-%d"),
                    "target_date": target_dt.strftime("%Y-%m-%d"),
                    "asset_name": asset,
                    "ai_model": model,
                    "start_price": curr,
                    "predicted_price": float(res[asset]),
                    "status": "pending"
                })

    # 5. フロントエンド用JSONの作成
    stats = calculate_stats(history)
    
    # 今日の答え合わせ用（5営業日前に予測され、今日がターゲットのものを抽出）
    today_check = [r for r in history["records"] if r["target_date"] == today_dt.strftime("%Y-%m-%d")]

    output_data = {
        "metadata": {
            "last_updated": today_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "target_date": target_dt.strftime("%Y-%m-%d")
        },
        "overall_stats": stats,
        "latest_forecast": {
            "GPT": gpt_res,
            "Gemini": gem_res,
            "current_prices": current_prices
        },
        "today_judgement": today_check
    }

    # 保存
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f: json.dump(output_data, f, indent=4, ensure_ascii=False)
    with open(HISTORY_FILE, "w", encoding="utf-8") as f: json.dump(history, f, indent=4, ensure_ascii=False)
    print("Success! Data Updated.")

if __name__ == "__main__":
    main()