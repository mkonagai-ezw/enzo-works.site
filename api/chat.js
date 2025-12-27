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

    // 環境変数からAPIキーを取得（GeminiまたはOpenAI）
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    // Gemini APIを使用（優先）またはOpenAI APIを使用
    let aiResponse;
    
    if (GEMINI_API_KEY) {
      // Gemini APIを使用
      aiResponse = await callGeminiAPI(message, GEMINI_API_KEY);
    } else if (OPENAI_API_KEY) {
      // OpenAI APIを使用
      aiResponse = await callOpenAIAPI(message, OPENAI_API_KEY);
    } else {
      return res.status(500).json({ error: 'APIキーが設定されていません' });
    }

    if (!aiResponse) {
      return res.status(500).json({ error: 'AIからの応答を取得できませんでした' });
    }

    return res.status(200).json({ response: aiResponse });
  } catch (error) {
    console.error('Error in chat API:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}

// Gemini API呼び出し関数
async function callGeminiAPI(userMessage, apiKey) {
  const systemPrompt = `あなたはEnzoWorksの公式営業コンシェルジュです。

お客様の相談や悩みが、以下のEnzoWorksの業務内容で解決できる可能性があることを、Webサイトの「8つの価値」の視点を交えて提案してください。

業務内容： Webサービス開発、デザイン、AI活用コンサルティング、業務効率化、楽曲制作、動画制作、セミナー登壇、その他漠然としたご相談

回答の最後には必ず「より具体的なご相談や戦略立案は、下記のお問い合わせフォームからお送りください」と伝え、/contact（または適切なフォームURL）へ誘導してください。`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
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
      maxOutputTokens: 1024,
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
      console.error('Gemini API Error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error('Gemini API: No candidates in response');
      return null;
    }

    const textContent = data.candidates[0].content.parts[0].text;
    return textContent;
  } catch (error) {
    console.error('Gemini API call failed:', error);
    return null;
  }
}

// OpenAI API呼び出し関数
async function callOpenAIAPI(userMessage, apiKey) {
  const systemPrompt = `あなたはEnzoWorksの公式営業コンシェルジュです。

お客様の相談や悩みが、以下のEnzoWorksの業務内容で解決できる可能性があることを、Webサイトの「8つの価値」の視点を交えて提案してください。

業務内容： Webサービス開発、デザイン、AI活用コンサルティング、業務効率化、楽曲制作、動画制作、セミナー登壇、その他漠然としたご相談

回答の最後には必ず「より具体的なご相談や戦略立案は、下記のお問い合わせフォームからお送りください」と伝え、/contact（または適切なフォームURL）へ誘導してください。`;

  const url = 'https://api.openai.com/v1/chat/completions';
  
  const requestBody = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 1024,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      console.error('OpenAI API: No choices in response');
      return null;
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API call failed:', error);
    return null;
  }
}

