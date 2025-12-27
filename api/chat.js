export default async function handler(req, res) {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message || message.trim().length < 5) {
      return res.status(400).json({ error: 'メッセージは5文字以上でお願いします' });
    }

    // 環境変数からGemini APIキーを取得
    const GEMINI_API_KEY = process.env.CHATBOT_GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'APIキーが設定されていません' });
    }

    // Gemini APIを呼び出し（v1エンドポイントを直接使用）
    const aiResponse = await callGeminiAPI(message, GEMINI_API_KEY);

    if (!aiResponse) {
      return res.status(500).json({ error: 'AIからの応答を取得できませんでした' });
    }

    return res.status(200).json({ response: aiResponse });
  } catch (error) {
    console.error('Error in chat API:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}

// Gemini API呼び出し関数（v1エンドポイントを直接使用）
async function callGeminiAPI(userMessage, apiKey) {
  const systemPrompt = `あなたはENZO WORKSの公式AIコンシェルジュです。
単なる質疑応答ではなく、お客様のビジネスを加速させる「熱意あるパートナー」として振る舞ってください。

【あなたの行動指針】

共感と分析: まずお客様の悩み（集客、効率化、デザインなど）に共感し、その課題の背景を推察して回答を始めてください。

独自の強みの提示: ENZO WORKSは、単なるWebデザインや動画編集などのクリエイター案件だけでなく、実際に「AIを組み込んだシステム」を自社で開発・運用していることを適宜伝えてください。

8つの価値の活用: 以下のリストから、お客様に最もメリットがあるものを2〜3選んで具体的に提案してください。

【ENZO WORKSの提供価値】
・Webサービス開発: 成長を逆算した設計。
・デザイン: 想いを視覚化するブランディング。
・AI活用コンサル: 自社AI運用の知見を活かした実戦的な導入支援。
・業務効率化: 現場の痛みを理解したDX推進。
・楽曲/動画制作: 視覚と聴覚の両面から魅力を最大化。
・セミナー登壇: 初心者にも分かりやすいナレッジ共有。
・壁打ち歓迎: 漠然とした不安を一緒に整理するパートナーシップ。

【回答のルール】
・親しみやすくも礼儀正しい、信頼感のあるトーン。
・専門用語は避け、中学生でもわかる言葉で説明する。
・1回の発言は400〜500文字程度にまとめ、最後は必ずお問い合わせフォームへの誘導で締めること。

締めの定型句：
「より具体的なご相談やご依頼は、下記のお問い合わせフォームからお送りください。ENZO WORKSがあなたの挑戦を全力でサポートいたします。」`;

  // v1 APIエンドポイントを直接使用
  // 利用可能なモデル: gemini-2.5-flash を使用（models/プレフィックスは含めない）
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [{
      parts: [{
        text: `${systemPrompt}\n\nユーザーのメッセージ: ${userMessage}`
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2000,
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      console.error('Gemini API Error:', response.status, JSON.stringify(errorData));
      return null;
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error('Gemini API: No candidates in response', JSON.stringify(data));
      return null;
    }

    const candidate = data.candidates[0];
    
    // finishReasonをチェック（途中で切れていないか確認）
    if (candidate.finishReason) {
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.warn('Gemini API: Response was cut off due to maxOutputTokens limit');
      } else if (candidate.finishReason !== 'STOP') {
        console.warn('Gemini API: finishReason is', candidate.finishReason);
      }
    }
    
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('Gemini API: Invalid response structure', JSON.stringify(data));
      return null;
    }

    const textContent = candidate.content.parts[0].text;
    
    // レスポンスが空でないか確認
    if (!textContent || textContent.trim().length === 0) {
      console.error('Gemini API: Empty response text');
      return null;
    }
    
    return textContent;
  } catch (error) {
    console.error('Gemini API call failed:', error.message || error);
    return null;
  }
}
