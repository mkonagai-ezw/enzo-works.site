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
TICKER_SYMBOL = "USDJPY=X" # 為替：ドル円
PREDICT_DAYS = 5 # 予測する日数
OUTPUT_FILE = "ai_predictions.json"

def get_recent_data(ticker):
    """過去30日間の価格データを取得する"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=40) # 土日挟むため少し長めに確保
    
    # progress=Falseでログを抑制
    data = yf.download(ticker, start=start_date, end=end_date, progress=False)
    
    if data.empty:
        raise ValueError(f"Ticker {ticker} のデータ取得に失敗しました。")

    # プロンプト用に整形
    price_data = []
    for date, row in data.iterrows():
        # 【修正】Series型になってもfloatに強制変換してエラーを防ぐ
        try:
            close_val = float(row['Close'])
            price_data.append(f"{date.strftime('%Y-%m-%d')}: {close_val:.3f}")
        except Exception:
            continue # データがおかしい行はスキップ
    
    # 最新の終値もfloatに変換
    last_price = float(data['Close'].iloc[-1])
    
    # 直近30件だけを使う
    return "\n".join(price_data[-30:]), last_price

def get_prediction(api_client, model_name, data, last_price):
    """指定されたAIモデルから予測を取得する"""
    prompt = f"""
    あなたはウォール街で20年の経験を持つ、時系列データ分析の専門家です。
    あなたの唯一の目的は、与えられたデータと統計的な根拠に基づき、
    {PREDICT_DAYS}日後の終値を**具体的な数値だけ**で予測することです。

    --- 実行ステップ ---
    1.  まず、以下の過去30日間のデータから「直近のトレンド（上昇・下降・レンジ）」、「変動性（ボラティリティ）」、「大きな価格変動日」を厳密に分析せよ。
    2.  次に、これらの分析結果と統計的な時系列モデル（ARIMA、GARCHなど）の概念を念頭に置き、{PREDICT_DAYS}日後の価格を推論せよ。
    3.  予測結果は、最終日の終値 {last_price:.3f} から変動した後の、**具体的な終値の数値（小数点以下3桁まで）だけ**を回答し、それ以外の説明やコメントは一切含めないこと。

    --- 過去データ ---
    {data}
    ---
    """

    try:
        if model_name.startswith("gpt"):
            response = api_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}]
            )
            prediction_text = response.choices[0].message.content
        
        elif model_name.startswith("gemini"):
            response = api_client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            prediction_text = response.text
        
        # 回答から数値のみを抽出
        import re
        # カンマを取り除いてから数値を探す
        clean_text = prediction_text.replace(",", "")
        predicted_value = re.findall(r"[\d\.]+", clean_text)
        
        if not predicted_value:
            return None
            
        return float(predicted_value[0])
        
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

if __name__ == "__main__":
    main()