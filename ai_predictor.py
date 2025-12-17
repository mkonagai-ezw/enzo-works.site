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

# --- Gemini初期化（最も安定する構成） ---
if GEMINI_API_KEY:
    # 404エラーを回避するため、余計な api_version や transport 指定を削り
    # ライブラリの標準設定に任せる形に戻しました
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
            # 業界標準に合わせ、日付の横に終値を2桁〜3桁で表示
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
    """Geminiに予測を依頼（安定版指定）"""
    try:
        # シンプルに 'gemini-1.5-flash' と指定するのが、現在のライブラリでは最も成功率が高いです
        model = genai.GenerativeModel('gemini-1.5-flash-latest') 
        response = model.generate_content(prompt)
        content = response.text
        return parse_json_response(content, "Gemini")
    except Exception as e:
        print(f"Gemini Error: {e}")
        return None

def parse_json_response(content, model_name):
    """共通のJSON解析処理（解析力を強化）"""
    print(f"--- DEBUG [{model_name}] Raw Response ---")
    print(content)
    print("---------------------------------------")
    
    try:
        # Markdownの枠だけでなく、前後の余計な文章を徹底的に排除
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
            # 通貨ペアのみ小数点第3位まで表示し、AIに精度を意識させる
            p_format = ".3f" if "JPY" in asset_name else ".2f"
            all_assets_info += f"\n### {asset_name}\nCurrent: {price:{p_format}}\nHistory:\n{hist_str}\n"

    # 2. プロンプト作成（金融プロ仕様：桁数指定を厳格化）
    prompt = f"""
    あなたは凄腕の金融アナリストです。以下のデータに基づき、{PREDICT_DAYS}日後の終値を論理的に予測してください。
    
    【重要ルール】
    1. 現在の価格と全く同じ数値を答えることは「厳禁」です。市場のボラティリティを考慮してください。
    2. 精度について:
       - USD/JPY: 小数点第3位（0.001円単位）まで。
       - Nikkei 225 / S&P 500: 小数点第2位まで。
    3. 出力は必ず以下のJSON形式のみとし、解説文は一切含めないでください。

    {{
        "USD/JPY": 0.000,
        "Nikkei 225": 0.00,
        "S&P 500": 0.00
    }}

    --- データ ---
    {all_assets_info}
    """

    # 3. AIに予測依頼
    print("Asking GPT...")
    gpt_res = ask_gpt(openai_client, prompt)
    
    print("Asking Gemini...")
    time.sleep(2) # レートリミット回避
    gem_res = ask_gemini(prompt)

    # 4. 結果保存
    output_data = {"last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "assets": {}}
    
    for asset in TARGETS.keys():
        if asset in current_prices:
            curr = current_prices[asset]
            
            # 安全に数値を取得（辞書が壊れていても落ちないようにする）
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

    # ファイル書き込み
    with open("ai_predictions.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4, ensure_ascii=False)
        
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=4, ensure_ascii=False)

    print("Success! AI Predictions Updated.")

if __name__ == "__main__":
    main()