export const config = { maxDuration: 30 };

class ChatError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

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
    const { message } = req.body || {};

    if (typeof message !== 'string' || message.trim().length < 5) {
      return res.status(400).json({ error: 'メッセージは5文字以上でお願いします' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'メッセージは2000文字以内でお願いします' });
    }

    // 環境変数からGemini APIキーを取得
    const GEMINI_API_KEY = process.env.CHATBOT_GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      throw new ChatError('CHAT_NOT_CONFIGURED', 503, '現在チャットを利用できません。公式LINEをご利用ください。');
    }

    // モデルと認証情報はサーバー側で管理する。
    const aiResponse = await callGeminiAPI(message, GEMINI_API_KEY);

    return res.status(200).json({ response: aiResponse });
  } catch (error) {
    const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    const code = timeout ? 'AI_TIMEOUT' : (error.code || 'CHAT_ERROR');
    console.error('Chat API failed:', code);
    return res.status(timeout ? 504 : (error.status || 502)).json({
      code,
      error: timeout
        ? '応答に時間がかかっています。少し待ってから再度お試しください。'
        : (error instanceof ChatError ? error.message : '通信エラーが発生しました。しばらくしてから再度お試しください。'),
    });
  }
}

// Gemini API呼び出し関数
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
・最後は必ず公式LINEへ誘導してください。

締めの定型句：
「より具体的なご相談やご依頼は、下記の公式LINEからお送りください。ENZO WORKSがあなたの挑戦を全力でサポートいたします。」`;

  const model = process.env.CHATBOT_GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{
      role: 'user',
      parts: [{
        text: userMessage
      }]
    }],
    generationConfig: {
      maxOutputTokens: 2000,
      // 短い案内で思考が出力枠を使い切るのを防ぐ。
      ...(model === 'gemini-2.5-flash' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // 質問本文・APIキーはログに残さず、診断用の状態だけ記録する。
    const reason = errorData.error?.details?.find(detail => detail.reason)?.reason;
    console.error('Gemini API error:', { model, status: response.status, reason, providerStatus: errorData.error?.status });
    if (response.status === 402) {
      throw new ChatError('AI_BILLING_REQUIRED', 503, '現在チャットを一時停止しています。公式LINEをご利用ください。');
    }
    if (response.status === 429) {
      throw new ChatError('AI_RATE_LIMITED', 503, '現在AIの利用が集中しているか、利用上限に達しています。しばらくしてからお試しいただくか、公式LINEをご利用ください。');
    }
    if ([400, 401, 403, 404].includes(response.status)) {
      throw new ChatError('AI_CONFIGURATION_ERROR', 503, '現在チャットを利用できません。公式LINEをご利用ください。');
    }
    throw new ChatError('AI_UNAVAILABLE', 502, 'AIサービスに接続できませんでした。しばらくしてから再度お試しください。');
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new ChatError('AI_NO_RESPONSE', 502, '回答を作成できませんでした。質問の表現を変えてお試しください。');
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
    throw new ChatError('AI_EMPTY_RESPONSE', 502, '回答を取得できませんでした。質問の表現を変えてお試しください。');
  }

  const textContent = candidate.content.parts
    .filter(part => !part.thought && typeof part.text === 'string')
    .map(part => part.text)
    .join('');

  // レスポンスが空でないか確認
  if (!textContent || textContent.trim().length === 0) {
    throw new ChatError('AI_EMPTY_RESPONSE', 502, '回答を取得できませんでした。もう一度お試しください。');
  }

  return textContent;
}
