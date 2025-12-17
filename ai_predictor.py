import os
import json
import time
import re
import yfinance as yf
from openai import OpenAI
import google.generativeai as genai
from datetime import datetime, timedelta

# --- 環境変数 ---
# .strip() を入れることで、GitHub Secrets側の不慮の改行や空白を無効化します
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

# --- Gemini初期化 ---
if GEMINI_API_KEY:
    # configureはシンプルにkeyのみ指定。api_versionはModel生成時に指定します。
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
            # 日付の横に終値を表示
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
    """Geminiに予測を依頼（404エラー対策版）"""
    try:
        # モデル名を指定
        # 一部の環境でv1betaに飛ばされて404になるのを防ぐため、明示的に指定
        model = genai.GenerativeModel('gemini-1.5-flash') 
        
        # 実行時に api_version='v1' を指定するのが今のライブラリで最も確実です
        response = model.generate_content(prompt)
        
        content = response.text
        return parse_json_response(content, "Gemini")
    except Exception as e:
        # 404が出る場合はモデルを 'gemini-pro' に落としてリトライ
        print(f"Gemini (flash) Error: {e}. Retrying with gemini-pro...")
        try:
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content(prompt)
            return parse_json_response(response.text, "Gemini-Pro")
        except Exception as e2:
            print(f"Gemini (pro) Error: {e2}")
            return None

def parse_json_response(content, model_name):
    """共通のJSON解析処理"""
    print(f"--- DEBUG [{model_name}] Raw Response ---")
    print(content)
    print("---------------------------------------")
    
    try:
        # Markdownの枠を削除
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
            p_format = ".3f" if "JPY" in asset_name else ".2f"
            all_assets_info += f"\n### {asset_name}\nCurrent: {price:{p_format}}\nHistory:\n{hist_str}\n"

    # 2. プロンプト作成
    prompt = f"""
    あなたは凄腕の金融アナリストです。以下のデータに基づき、{PREDICT_DAYS}日後の終値を予測してください。
    
    【ルール】
    1. 現在価格と同じ数値は禁止。必ず変動を予測してください。
    2. USD/JPYは小数点第3位まで、他は第2位まで。
    3. JSON形式のみ出力してください。

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
    time.sleep(2) 
    gem_res = ask_gemini(prompt)

    # 4. 結果保存
    output_data = {"last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "assets": {}}
    
    for asset in TARGETS.keys():
        if asset in current_prices:
            curr = current_prices[asset]
            
            try:
                g_pred = float(gpt_res.get(asset)) if (gpt_res and asset in gpt_res) else None
            except: g_pred = None
            
            try:
                m_pred = float(gem_res.get(asset)) if (gem_res and asset in gem_res) else None
            except: m_pred = None
            
            output_data["assets"][asset] = {
                "current_price": float(curr),
                "gpt_prediction": g_pred,
                "gemini_prediction": m_pred,
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