import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // Gemini APIを呼び出し
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

// Gemini API呼び出し関数
async function callGeminiAPI(userMessage, apiKey) {
  const systemPrompt = `あなたはEnzoWorksの公式コンシェルジュです。

お客様の相談や悩みに対して、EnzoWorksの「8つの価値」の視点を交えて、以下の業務内容から最適な提案をしてください。

【EnzoWorksの8つの価値】
1. Webサービス開発
   コーポレートサイトからWebアプリケーションまで。ビジネスの成長を支える基盤を構築します。

2. デザイン
   ロゴ制作、UI/UXデザイン、ブランディング。想いを視覚化し、ユーザーの心に届けます。

3. AI活用コンサルティング
   ChatGPTなどの最新AI技術を導入支援。新しい可能性とイノベーションを創出します。

4. 業務効率化
   社内DXの推進や自動化ツールの導入。無駄を省き、本質的な業務に集中できる環境を提供します。

5. 楽曲制作
   動画BGMからブランドイメージソングまで。世界観を音で表現し、コンテンツの魅力を最大化します。

6. 動画制作
   プロモーション映像からSNS用動画編集まで。視覚と聴覚に訴えるコンテンツで、魅力を強力に発信します。

7. セミナー登壇
   ITトレンド、AI活用、キャリア形成など。実体験に基づいたナレッジを、初心者にも分かりやすく解説します。

8. 漠然としたご相談
   「何から手をつければいいかわからない」そんな段階からの壁打ちも大歓迎。一緒に課題を整理しましょう。

回答の最後には必ず「より具体的なご相談や戦略立案は、下記のお問い合わせフォームからお送りください」と伝え、/contact へ誘導してください。`;

  try {
    // GoogleGenerativeAIインスタンスを作成
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // モデルを取得（models/は含めない）
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    // システムプロンプトとユーザーメッセージを結合
    const prompt = `${systemPrompt}\n\nユーザーのメッセージ: ${userMessage}`;

    // API呼び出し（直接テキストを渡す形式）
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error('Gemini API call failed:', error.message || error);
    if (error.response) {
      console.error('API Error Response:', error.response);
    }
    return null;
  }
}
