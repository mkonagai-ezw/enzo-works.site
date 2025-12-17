import os
import json
import yfinance as yf
from openai import OpenAI
from google import genai
from datetime import datetime, timedelta

# --- 環境変数からAPIキーを取得 ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# --- 設定 ---
TICKER_SYMBOL = "USDJPY=X" # 為替：ドル円。株価なら "AAPL" (Apple) など
PREDICT_DAYS = 5 # 予測する日数
OUTPUT_FILE = "ai_predictions.json"
TODAY = datetime.now().strftime("%Y-%m-%d")

def get_recent_data(ticker):
    """過去30日間の価格データを取得する"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    data = yf.download(ticker, start=start_date, end=end_date)
    
    if data.empty:
        raise ValueError(f"Ticker {ticker} のデータ取得に失敗しました。")

    # プロンプト用に整形
    price_data = []
    for date, row in data.iterrows():
        price_data.append(f"{date.strftime('%Y-%m-%d')}: {row['Close']:.3f}")
    
    return "\n".join(price_data), data['Close'].iloc[-1]

def get_prediction(api_client, model_name, data, last_price):
    """指定されたAIモデルから予測を取得する"""
    prompt = f"""
    あなたはプロの金融アナリストです。
    以下の過去30日間の終値データに基づいて、{PREDICT_DAYS}日後の終値を**数値だけ**で予測してください。
    
    --- 過去データ ---
    {data}
    ---
    
    予測結果は、最終日の終値 {last_price:.3f} から変動した後の、**具体的な終値の数値（小数点以下2桁または3桁まで）だけ**を回答してください。
    例: 150.123
    """

    try:
        if model_name.startswith("gpt"):
            # GPTクライアント
            response = api_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}]
            )
            prediction_text = response.choices[0].message.content
        
        elif model_name.startswith("gemini"):
            # Geminiクライアント
            response = api_client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            prediction_text = response.text
        
        # 回答から数値のみを抽出
        import re
        predicted_value = re.findall(r"[\d\.]+", prediction_text)
        return float(predicted_value[0]) if predicted_value else None
        
    except Exception as e:
        print(f"[{model_name}] 予測取得エラー: {e}")
        return None

def main():
    if not OPENAI_API_KEY or not GEMINI_API_KEY:
        print("エラー：APIキーが設定されていません。GitHub Secretsを確認してください。")
        return

    # 1. データ取得
    try:
        price_data_str, last_price = get_recent_data(TICKER_SYMBOL)
    except Exception as e:
        print(f"データ取得エラー: {e}")
        return

    # 2. AIクライアント初期化
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

    # 3. AI予測実行
    gpt_prediction = get_prediction(openai_client, "gpt-3.5-turbo", price_data_str, last_price)
    gemini_prediction = get_prediction(gemini_client, "gemini-2.5-flash", price_data_str, last_price)

    # 4. 乖離率の計算
    deviation_percent = None
    if gpt_prediction and gemini_prediction:
        deviation = abs(gpt_prediction - gemini_prediction)
        average = (gpt_prediction + gemini_prediction) / 2
        deviation_percent = (deviation / average) * 100 if average != 0 else 0

    # 5. 結果をJSONファイルに保存
    data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ticker": TICKER_SYMBOL,
        "current_price": round(last_price, 3),
        "prediction_days": PREDICT_DAYS,
        "gpt": {
            "model": "gpt-3.5-turbo",
            "prediction": round(gpt_prediction, 3) if gpt_prediction else None,
            "change_pct": round(((gpt_prediction - last_price) / last_price) * 100, 2) if gpt_prediction else None
        },
        "gemini": {
            "model": "gemini-2.5-flash",
            "prediction": round(gemini_prediction, 3) if gemini_prediction else None,
            "change_pct": round(((gemini_prediction - last_price) / last_price) * 100, 2) if gemini_prediction else None
        },
        "deviation_percent": round(deviation_percent, 2) if deviation_percent is not None else None,
        "disclaimer": "これは投資助言ではありません。AIの予測は参考情報であり、自己責任でご利用ください。"
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    
    print(f"予測結果を {OUTPUT_FILE} に正常に保存しました。")
    print(f"乖離率: {deviation_percent:.2f}%")

if __name__ == "__main__":
    main()