import os
import json
import yfinance as yf
from openai import OpenAI
from google import genai
from datetime import datetime, timedelta
import pandas as pd

# --- 環境変数 ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# --- 設定 ---
# 予測対象リスト
TARGETS = {
    "USD/JPY": "USDJPY=X",
    "Nikkei 225": "^N225",
    "S&P 500": "^GSPC"
}
PREDICT_DAYS = 5
HISTORY_FILE = "ai_history.json" # 履歴を保存するファイル

def get_market_data(ticker):
    """直近の価格データを取得"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    
    # データを取得
    df = yf.download(ticker, start=start_date, end=end_date, progress=False)
    
    if df.empty:
        return None, None

    # 最新の終値
    current_price = float(df['Close'].iloc[-1])
    
    # AI用の過去データテキスト作成（直近30日分）
    price_str_list = []
    # indexが日付、rowがデータ
    for date, row in df.tail(30).iterrows():
        try:
            val = float(row['Close'])
            price_str_list.append(f"{date.strftime('%Y-%m-%d')}: {val:.2f}")
        except:
            continue
            
    return "\n".join(price_str_list), current_price

def ask_ai(client, model, prompt):
    """AIに予測を依頼する共通関数"""
    try:
        import re
        prediction_text = ""
        
        if "gpt" in model:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}]
            )
            prediction_text = response.choices[0].message.content
        elif "gemini" in model:
            response = client.models.generate_content(
                model=model,
                contents=prompt
            )
            prediction_text = response.text

        # 数値抽出 (カンマ除去して数値を探す)
        clean_text = prediction_text.replace(",", "")
        numbers = re.findall(r"[\d\.]+", clean_text)
        if numbers:
            return float(numbers[0])
        return None
    except Exception as e:
        print(f"AI Error ({model}): {e}")
        return None

def main():
    if not OPENAI_API_KEY or not GEMINI_API_KEY:
        print("Error: API Key missing.")
        return

    # クライアント初期化
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

    # 1. 履歴データの読み込み（なければ新規作成）
    history_data = {}
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            history_data = json.load(f)
    else:
        history_data = {"records": []}

    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # 結果データ格納用
    output_data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "assets": {}
    }

    # --- A. 答え合わせフェーズ (過去の予測 vs 今日の価格) ---
    # 記録されている予測のうち、判定日が今日以前で、まだ結果が出ていないものをチェック
    for record in history_data["records"]:
        if record["status"] == "pending" and record["target_date"] <= today_str:
            ticker = TARGETS.get(record["asset_name"])
            if ticker:
                # その日の実際の価格を取得して答え合わせ
                try:
                    df = yf.download(ticker, start=record["target_date"], end=datetime.now() + timedelta(days=1), progress=False)
                    if not df.empty:
                        # ターゲット日の終値（なければ直近）
                        actual_price = float(df['Close'].iloc[0])
                        record["actual_price"] = actual_price
                        
                        # 判定ロジック
                        # AIが「上がる」と予想し、実際に上がっていればWIN
                        start_price = record["start_price"]
                        pred_price = record["predicted_price"]
                        
                        predicted_up = pred_price > start_price
                        actual_up = actual_price > start_price
                        
                        if predicted_up == actual_up:
                            record["result"] = "WIN"
                        else:
                            record["result"] = "LOSS"
                        
                        # 誤差率
                        record["diff_percent"] = round(((actual_price - pred_price) / actual_price) * 100, 2)
                        record["status"] = "settled" # 判定完了
                        print(f"★答え合わせ完了: {record['asset_name']} ({record['result']})")
                except Exception as e:
                    print(f"答え合わせ失敗: {e}")

    # --- B. 新規予測フェーズ ---
    for asset_name, ticker in TARGETS.items():
        print(f"Processing {asset_name}...")
        
        hist_str, current_price = get_market_data(ticker)
        if not current_price:
            print(f"Data fetch failed for {asset_name}")
            continue

        # プロンプト作成
        prompt = f"""
        あなたはプロの金融アナリストです。
        以下の過去データに基づき、{PREDICT_DAYS}日後の「{asset_name}」の終値を予測してください。
        
        現在の価格: {current_price}
        
        条件:
        1. テクニカル分析（トレンド、ボラティリティ）を重視せよ。
        2. {PREDICT_DAYS}日後の具体的な数値のみを出力せよ。余計な説明は不要。
        
        過去データ:
        {hist_str}
        """

        # 各AIに予測させる
        gpt_val = ask_ai(openai_client, "gpt-3.5-turbo", prompt)
        gem_val = ask_ai(gemini_client, "gemini-2.0-flash", prompt)

        # 表示用データの構築
        output_data["assets"][asset_name] = {
            "current_price": round(current_price, 2),
            "gpt_prediction": round(gpt_val, 2) if gpt_val else None,
            "gemini_prediction": round(gem_val, 2) if gem_val else None,
            "gpt_change": round(((gpt_val - current_price)/current_price)*100, 2) if gpt_val else None,
            "gemini_change": round(((gem_val - current_price)/current_price)*100, 2) if gem_val else None,
        }

        # --- 履歴への保存（答え合わせ用） ---
        target_date = (datetime.now() + timedelta(days=PREDICT_DAYS)).strftime("%Y-%m-%d")
        
        # GPTの予測を記録
        if gpt_val:
            history_data["records"].append({
                "date": today_str, # 予測した日
                "target_date": target_date, # 答え合わせする日
                "asset_name": asset_name,
                "ai_model": "GPT-3.5",
                "start_price": current_price,
                "predicted_price": gpt_val,
                "actual_price": None,
                "result": None, # WIN or LOSS
                "status": "pending"
            })
            
        # Geminiの予測を記録
        if gem_val:
            history_data["records"].append({
                "date": today_str,
                "target_date": target_date,
                "asset_name": asset_name,
                "ai_model": "Gemini",
                "start_price": current_price,
                "predicted_price": gem_val,
                "actual_price": None,
                "result": None,
                "status": "pending"
            })

    # --- 保存 ---
    # 1. 表示用JSON (Webサイトが読み込む)
    with open("ai_predictions.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4, ensure_ascii=False)
        
    # 2. 履歴用JSON (バックエンドで持ち回るデータベース)
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=4, ensure_ascii=False)

    print("All tasks completed.")

if __name__ == "__main__":
    main()