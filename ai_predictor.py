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
    """単純な5日後ではなく、土日を考慮した5営業日後を計算"""
    target = start_date + timedelta(days=7)
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

def get_closing_price_for_date(ticker, target_date_str):
    """特定の日付の終値を取得（終値確定後の答え合わせ用）"""
    try:
        target_dt = datetime.strptime(target_date_str, "%Y-%m-%d")
        # 前後1日を含む範囲でデータを取得
        start_date = target_dt - timedelta(days=2)
        end_date = target_dt + timedelta(days=2)
        df = yf.download(ticker, start=start_date, end=end_date, progress=False)
        if df.empty:
            return None
        # target_dateの終値を取得
        target_date_only = target_dt.date()
        for date, row in df.iterrows():
            if date.date() == target_date_only:
                return float(row['Close'])
        return None
    except Exception as e:
        print(f"Error getting closing price for {target_date_str}: {e}")
        return None

def ask_gpt(client, system_msg, user_msg):
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg}
            ],
            temperature=0.7 # 0.7〜0.8で創造性と予測の幅を持たせる
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

# --- 市場状況判定関数 ---
def get_market_status(asset_name):
    """各銘柄の市場が開いているかどうかを判定"""
    now = datetime.now()
    weekday = now.weekday()  # 0=月曜日, 6=日曜日
    hour = now.hour
    
    if asset_name == "USD/JPY":
        # 為替市場: 週末以外は24時間取引
        if weekday >= 5:  # 土日
            return {"is_open": False, "message": "週末のため市場は閉まっています"}
        return {"is_open": True, "message": "市場は開いています"}
    
    elif asset_name == "Nikkei 225":
        # 日本市場: 平日9:00-15:00 JST
        if weekday >= 5:  # 土日
            return {"is_open": False, "message": "週末のため市場は閉まっています"}
        if hour < 9 or hour >= 15:
            return {"is_open": False, "message": "市場は閉まっています（取引時間: 9:00-15:00 JST）"}
        return {"is_open": True, "message": "市場は開いています"}
    
    elif asset_name == "S&P 500":
        # 米国市場: 米国東部時間9:30-16:00（日本時間では22:30-5:00、夏時間は23:30-6:00）
        # 簡易判定: 平日のみ（詳細な時間判定は複雑なため、平日判定のみ）
        if weekday >= 5:  # 土日
            return {"is_open": False, "message": "週末のため市場は閉まっています"}
        # 米国市場の営業時間は日本時間では深夜-朝なので、簡易的に平日は開いていると表示
        # より正確には米国時間での判定が必要だが、簡易実装として平日判定のみ
        return {"is_open": True, "message": "市場は開いています（米国市場時間）"}
    
    return {"is_open": True, "message": "市場は開いています"}

# --- 答え合わせ・統計ロジック ---
def update_history_with_actuals(history):
    """過去の予測を答え合わせ（終値確定後のみ実行）"""
    today_dt = datetime.now()
    today_str = today_dt.strftime("%Y-%m-%d")
    
    for record in history.get("records", []):
        # target_dateの翌日以降に答え合わせ（終値確定後）
        # target_date < today_str により、予測日の翌日以降に答え合わせを実行
        if record["status"] == "pending" and record["target_date"] < today_str:
            ticker = TARGETS.get(record["asset_name"])
            if not ticker:
                continue
            
            # 特定日付の終値を明示的に取得（終値確定後の値を使用）
            actual_price = get_closing_price_for_date(ticker, record["target_date"])
            
            # 特定日付の終値が取得できない場合は、最新の終値を使用（フォールバック）
            if actual_price is None:
                _, actual_price = get_market_data(ticker)
            
            if actual_price:
                record["actual_price"] = actual_price
                pred_up = record["predicted_price"] > record["start_price"]
                actual_up = actual_price > record["start_price"]
                record["direction_correct"] = (pred_up == actual_up)
                record["error_rate"] = round(abs((record["predicted_price"] - actual_price) / actual_price) * 100, 3)
                record["status"] = "settled"
                print(f"Settled: {record['asset_name']} ({record['date']} -> {record['target_date']}) - Predicted: {record['predicted_price']}, Actual: {actual_price}")

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

    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f: history = json.load(f)
    else: history = {"records": []}

    print("Settling past predictions...")
    update_history_with_actuals(history)

    today_dt = datetime.now()
    target_dt = get_target_date(today_dt)
    
    all_assets_info = ""
    current_prices = {}
    for asset, ticker in TARGETS.items():
        hist, price = get_market_data(ticker)
        if price:
            current_prices[asset] = price
            all_assets_info += f"\n### {asset}\nNow: {price}\nHistory:\n{hist}\n"

    # --- プロンプト強化 ---
    system_msg = """あなたは大胆かつ精密な分析を行うプロの市場アナリストです。
現在、あなたは他校のAIと予測精度を競うバトルに参加しています。

【厳守事項】
1. 現在価格と全く同じ値（現状維持）を出力することは禁止です。
2. 必ず直近のボラティリティを考慮し、現在値から「0.2%以上」の変動（上昇または下落）を予測してください。
3. 根拠を内部的にシミュレートし、最も可能性が高いと考える「攻めた」数値を提示してください。
4. 出力は指定されたJSONフォーマットのみとし、解説は不要です。"""

    user_msg = f"""本日({today_dt.strftime('%Y-%m-%d')})のデータを基に、5営業日後({target_dt.strftime('%Y-%m-%d')})の終値を予想してください。
JSONフォーマット: {{"USD/JPY":0.000, "Nikkei 225":0.00, "S&P 500":0.00}}

市場データ:
{all_assets_info}"""
    
    # 統合プロンプト（Gemini用）
    gemini_prompt = system_msg + "\n\n" + user_msg

    gpt_res = ask_gpt(openai_client, system_msg, user_msg)
    gem_res = ask_gemini(gemini_prompt)

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

    stats = calculate_stats(history)
    # 昨日が答え合わせ対象日の予測を取得（終値確定後の答え合わせ結果を表示）
    yesterday_dt = today_dt - timedelta(days=1)
    today_check = [r for r in history["records"] 
                   if r["target_date"] == yesterday_dt.strftime("%Y-%m-%d") 
                   and r["status"] == "settled"]

    # 各銘柄の市場状況を取得
    market_status = {}
    for asset in TARGETS.keys():
        market_status[asset] = get_market_status(asset)

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
        "today_judgement": today_check,
        "market_status": market_status
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f: json.dump(output_data, f, indent=4, ensure_ascii=False)
    with open(HISTORY_FILE, "w", encoding="utf-8") as f: json.dump(history, f, indent=4, ensure_ascii=False)
    print("Success! Data Updated.")

if __name__ == "__main__":
    main()