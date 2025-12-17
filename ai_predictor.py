import os
import json
import time
import re
import yfinance as yf
from openai import OpenAI
import google.generativeai as genai  # ★ここを変更（標準ライブラリ）
from datetime import datetime, timedelta

# --- 環境変数 ---
# キーの前後に余計な改行や空白があったら削除する (.strip)
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

# --- Gemini初期化（標準的な書き方） ---
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def get_market_data(ticker):
    """市場データを取得"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    
    # プログレスバー非表示で取得
    df = yf.download(ticker, start=start_date, end=end_date, progress=False)
    
    if df.empty:
        return None, None
    
    # 最新の終値
    current_price = float(df['Close'].iloc[-1])
    
    # AI用の過去データテキスト作成
    price_str_list = []
    for date, row in df.tail(30).iterrows():
        try:
            val = float(row['Close'])
            price_str_list.append(f"{date.strftime('%Y-%m-%d')}: {val:.2f}")
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
    """Geminiに予測を依頼（フルパス指定版）"""
    try:
        # 'models/' を付けて住所をハッキリさせます
        # これでもダメなら 'models/gemini-1.5-flash' に戻してもOKですが、
        # まずは一番歴史のある 'models/gemini-pro' で道を通します。
        model = genai.GenerativeModel('models/gemini-pro') 
        response = model.generate_content(prompt)
        content = response.text
        return parse_json_response(content, "Gemini")
    except Exception as e:
        print(f"Gemini Error: {e}")
        return None

def parse_json_response(content, model_name):
    """共通のJSON解析処理（デバッグ機能付き）"""
    print(f"--- DEBUG [{model_name}] Raw Response ---")
    print(content)
    print("---------------------------------------")
    
    try:
        # Markdown削除
        clean_content = re.sub(r'```json|```', '', content).strip()
        # { } 抽出
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

    # 履歴データの読み込み
    history_data = {"records": []}
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            try:
                history_data = json.load(f)
            except:
                history_data = {"records": []}

    today_str = datetime.now().strftime("%Y-%m-%d")
    target_date = (datetime.now() + timedelta(days=PREDICT_DAYS)).strftime("%Y-%m-%d")

    # 1. データ準備
    all_assets_info = ""
    current_prices = {}
    
    print("Market Data Loading...")
    for asset_name, ticker in TARGETS.items():
        hist_str, price = get_market_data(ticker)
        if price:
            current_prices[asset_name] = price
            all_assets_info += f"\n### {asset_name}\nCurrent: {price:.3f}\nHistory:\n{hist_str}\n"

    # 2. プロンプト作成
    prompt = f"""
    あなたは金融アナリストです。以下の3つの銘柄について、{PREDICT_DAYS}日後の終値を予測してください。
    
    【重要ルール】
    1. 現在価格と同じ数値を答えることは禁止です。必ず変動を予測してください。
    2. USD/JPYは小数点第3位まで、株価指数は小数点第2位まで予測してください。
    3. JSON形式以外は絶対に出力しないでください。

    Output JSON Format:
    {{
        "USD/JPY": 0.000,
        "Nikkei 225": 0.00,
        "S&P 500": 0.00
    }}

    Data:
    {all_assets_info}
    """

    # 3. AIに予測依頼
    print("Asking GPT...")
    gpt_res = ask_gpt(openai_client, prompt)
    
    print("Asking Gemini...")
    time.sleep(2) # 休憩
    gem_res = ask_gemini(prompt)

    # 4. 結果保存
    output_data = {"last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "assets": {}}
    
    for asset in TARGETS.keys():
        if asset in current_prices:
            curr = current_prices[asset]
            
            g_pred = gpt_res.get(asset) if (gpt_res and asset in gpt_res) else None
            m_pred = gem_res.get(asset) if (gem_res and asset in gem_res) else None
            
            output_data["assets"][asset] = {
                "current_price": float(curr),
                "gpt_prediction": float(g_pred) if g_pred is not None else None,
                "gemini_prediction": float(m_pred) if m_pred is not None else None,
                "gpt_change": round(((g_pred - curr)/curr)*100, 3) if g_pred is not None else None,
                "gemini_change": round(((m_pred - curr)/curr)*100, 3) if m_pred is not None else None,
            }

            # 履歴保存
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