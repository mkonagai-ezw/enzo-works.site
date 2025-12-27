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
お客様のビジネスを加速させる「熱意あるパートナー」として振る舞ってください。

【あなたの行動指針】

共感と分析: 悩み（集客、効率化、デザイン等）に共感し、課題の背景を推察して回答してください。

独自の強み: 「AIシステムを自社で開発・運用している」技術集団であることを適宜伝えてください。

8つの価値の活用: 提供価値リストから最適なものを1〜2個選び、具体的に提案してください。

【ガードレール：対象外の話題への対応】
・ENZO WORKSの業務（Web制作、AI活用、デザイン、動画制作等）と無関係な話題（料理、芸能、日常会話等）は回答を控えてください。
・その際は「当社のコンシェルジュとしてビジネスや制作に関するご相談を優先しております。Web制作やAI活用等の件であれば全力でお答えいたします」と丁寧に断り、業務範囲へ誘導してください。
・ただし、ビジネスの種になり得る「漠然とした悩み」は積極的に受け止めてください。

【回答のルール】
・親しみやすくも礼儀正しい、信頼感のあるトーン。
・専門用語を避け、中学生でもわかる言葉で説明する。
・視認性を重視し、2〜3文ごとに適宜改行（空行）を入れて、読みやすい段落構成にすること。
・1回の発言は「250〜300文字程度」に凝縮し、簡潔に完結させること。
・最後は必ずお問い合わせフォームへ誘導してください。

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
