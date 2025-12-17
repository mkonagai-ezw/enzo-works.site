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
PREDICT_DAYS = 5
HISTORY_FILE = "ai_history.json"

def get_market_data(ticker):
    """市場データを取得"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    df = yf.download(ticker, start=start_date, end=end_date, progress=False)
    
    if df.empty:
        return None, None
    
    current_price = float(df['Close'].iloc[-1])
    price_str_list = []
    for date, row in df.tail(30).iterrows():
        try:
            val = float(row['Close'])
            price_str_list.append(f"{date.strftime('%Y-%m-%d')}: {val:.3f}")
        except:
            continue
            
    return "\n".join(price_str_list), current_price

def ask_gpt(client, prompt):
    """GPTに予測を依頼"""
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        content = response.choices[0].message.content
        return parse_json_response(content, "GPT-3.5")
    except Exception as e:
        print(f"GPT Error: {e}")
        return None

def ask_gemini(prompt):
    """
    あなたのAI Studio(画像3枚目)のサンプルに記載されていた 
    'gemini-3-pro-preview' を直接叩きます。
    最新モデルは v1beta 窓口に存在するため、パスも修正しました。
    """
    if not GEMINI_API_KEY:
        return None

    # URLを v1beta に変更し、モデル名を gemini-3-pro-preview に固定
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key={GEMINI_API_KEY}"
    
    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }

    try:
        print(f"Connecting to Gemini API (v1beta) [Model: gemini-3-pro-preview]...")
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code != 200:
            print(f"Gemini API Error (Status {response.status_code}): {response.text}")
            # それでもダメなら gemini-pro (旧版) で最終試行
            return ask_gemini_pro_fallback(prompt)

        res_json = response.json()
        content = res_json['candidates'][0]['content']['parts'][0]['text']
        return parse_json_response(content, "Gemini")

    except Exception as e:
        print(f"Gemini Direct Connection Error: {e}")
        return None

def ask_gemini_pro_fallback(prompt):
    """Gemini-Proでのバックアップ接続"""
    # 旧モデルは v1 でも v1beta でも通るはずですが、安全のため v1beta を試します
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_API_KEY}"
    try:
        response = requests.post(url, headers={'Content-Type': 'application/json'}, 
                                 json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=30)
        if response.status_code == 200:
            res_json = response.json()
            return parse_json_response(res_json['candidates'][0]['content']['parts'][0]['text'], "Gemini-Pro")
    except:
        pass
    return None

def parse_json_response(content, model_name):
    """共通のJSON解析処理"""
    print(f"--- DEBUG [{model_name}] Raw Response ---")
    print(content)
    print("---------------------------------------")
    
    try:
        clean_content = re.sub(r'```json|```', '', content).strip()
        match = re.search(r'(\{.*\})', clean_content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        else:
            print(f"[{model_name}] JSON format not found.")
            return None
    except json.JSONDecodeError:
        print(f"[{model_name}] JSON Parse Error.")
        return None

def main():
    if not OPENAI_API_KEY or not GEMINI_API_KEY:
        print("Error: API Key missing.")
        return

    openai_client = OpenAI(api_key=OPENAI_API_KEY)

    history_data = {"records": []}
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            try:
                history_data = json.load(f)
            except:
                history_data = {"records": []}

    today_str = datetime.now().strftime("%Y-%m-%d")
    target_date = (datetime.now() + timedelta(days=PREDICT_DAYS)).strftime("%Y-%m-%d")

    all_assets_info = ""
    current_prices = {}
    
    print("Market Data Loading...")
    for asset_name, ticker in TARGETS.items():
        hist_str, price = get_market_data(ticker)
        if price:
            current_prices[asset_name] = price
            p_format = ".3f" if "JPY" in asset_name else ".2f"
            all_assets_info += f"\n### {asset_name}\nCurrent: {price:{p_format}}\nHistory:\n{hist_str}\n"

    prompt = f"""
    あなたは凄腕の金融アナリストです。以下のデータに基づき、{PREDICT_DAYS}日後の終値を予測してください。
    
    【ルール】
    1. 現在価格と同じ数値は禁止。
    2. USD/JPYは小数点第3位まで、他は第2位まで。
    3. JSON形式のみ出力。解説不要。

    {{
        "USD/JPY": 0.000,
        "Nikkei 225": 0.00,
        "S&P 500": 0.00
    }}

    Data:
    {all_assets_info}
    """

    print("Asking GPT...")
    gpt_res = ask_gpt(openai_client, prompt)
    
    print("Asking Gemini...")
    time.sleep(2) 
    gem_res = ask_gemini(prompt)

    output_data = {"last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "assets": {}}
    
    for asset in TARGETS.keys():
        if asset in current_prices:
            curr = current_prices[asset]
            
            try: g_pred = float(gpt_res.get(asset)) if (gpt_res and asset in gpt_res) else None
            except: g_pred = None
            
            try: m_pred = float(gem_res.get(asset)) if (gem_res and asset in gem_res) else None
            except: m_pred = None
            
            output_data["assets"][asset] = {
                "current_price": float(curr),
                "gpt_prediction": g_pred,
                "gemini_prediction": m_pred,
                "gpt_change": round(((g_pred - curr)/curr)*100, 3) if g_pred is not None else None,
                "gemini_change": round(((m_pred - curr)/curr)*100, 3) if m_pred is not None else None,
            }

            for model_name, val in [("GPT-3.5", g_pred), ("Gemini", m_pred)]:
                if val is not None:
                    history_data["records"].append({
                        "date": today_str,
                        "target_date": target_date,
                        "asset_name": asset,
                        "ai_model": model_name,
                        "start_price": float(curr),
                        "predicted_price": float(val),
                        "actual_price": None,
                        "result": None,
                        "status": "pending"
                    })

    with open("ai_predictions.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4, ensure_ascii=False)
        
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=4, ensure_ascii=False)

    print("Success! AI Predictions Updated.")

if __name__ == "__main__":
    main()