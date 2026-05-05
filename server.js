const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 請將這裡替換為你的 Gemini API Key
// 從 https://aistudio.google.com/app/apikey 免費申請
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBy9FzsY-OvDbo4IENpBnGv1urbRdEFwcI';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', geminiConfigured: GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE' });
});

// AI 分析端點
app.post('/api/analyze', async (req, res) => {
  try {
    const { query, laws, matchedLaws } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: '請提供查詢內容' });
    }

    if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      return res.status(503).json({ 
        error: 'Gemini API Key 尚未設定',
        message: '請在 server.js 中設定 GEMINI_API_KEY，或設定環境變數'
      });
    }

    // 構建提示詞
    const prompt = buildPrompt(query, laws, matchedLaws);

    // 呼叫 Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API 錯誤: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '無法取得 AI 回應';

    res.json({
      success: true,
      analysis: aiResponse,
      query: query,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Analysis Error:', error);
    res.status(500).json({
      error: 'AI 分析失敗',
      message: error.message
    });
  }
});

// 建構 Gemini 提示詞
function buildPrompt(query, laws, matchedLaws) {
  const lawsContext = laws.map(law => 
    `- ${law.lawName} ${law.article}：${law.title}\n  摘要：${law.summary}\n  關鍵字：${law.keywords?.join(', ') || '無'}`
  ).join('\n\n');

  return `你是一位專業的醫療法律顧問 AI。請根據以下使用者描述的醫療情境，以及相關的法律條文，提供專業但易懂的分析和建議。

## 使用者情境
"""${query}"""

## 相關法律條文
${lawsContext}

## 請提供以下分析（使用繁體中文，請用平易近人的語氣，多使用比喻和舉例）：

### 1. 情境摘要（用白話說明）
用簡單的話整理這個醫療事件的核心問題。請像跟鄰居聊天一樣解釋，必要時用生活化的比喻（例如：「就像去餐廳點菜...」「類似買東西有瑕疵...」），讓沒有法律背景的人也能聽懂。

### 2. 可能涉及的醫療法律議題
根據上述法律條文，分析本案可能涉及的法律問題。
**重要：請用比喻的方式解釋法律概念**。例如：
- 如果是「告知義務」問題，可以說「就像買股票前要知道風險一樣，醫生也要先告訴你可能的風險」
- 如果是「過失責任」，可以說「就像開車不小心撞到人要負責，醫生如果沒盡到應有的注意也要負責」

### 3. 相關法條解析（重點白話解釋）
針對匹配的每條法律：
- 先說「這條法律白話來說是...」
- 用 1-2 句話說明這條法律在這個案子裡代表什麼
- **務必使用比喻或生活化的例子**，例如：「這就像...」「類似...的情況」

### 4. 具體行動建議（step-by-step）
請提供「現在就可以開始做」的具體步驟，用「第1步、第2步」的方式列出：

**證據收集（先做這個）：**
- 列出具體要收集的文件（例如：「手術同意書影本」「3/15 的收據」）
- 說明去哪裡取得（例如：「向醫院病歷室申請」「保留所有藥袋」）

**溝通策略：**
- 第一次跟醫院溝通要說什麼（給個開場白範例）
- 怎麼問才不會被敷衍（例如：「請問能否給我書面說明？」）

**求助管道（按順序）：**
- 第一步：向哪個政府單位投訴（衛生局？消保官？）
- 第二步：調解管道（醫調會？鄉鎮調解委員會？）
- 第三步：什麼情況該找律師（例如：「如果醫院不願意談」「涉及重大傷害或死亡」）

**時效提醒：**
- 這個案子有沒有「過期」的問題？（例如：民事訴訟2年、刑事6個月到10年不等）
- 建議「最好在...之前...」

### 5. 給當事人的心理建設與提醒
- 這類案子通常要花多久時間？（管理期待）
- 什麼情況下建議「繼續爭取」，什麼情況「可能要考慮和解」
- 重要提醒：這只是初步分析，建議諮詢專業律師

---

**請注意：**
- 全程使用「你」來稱呼使用者，像朋友聊天一樣親切
- 每個法律概念都請用「就像...」「類似...」的方式舉例說明
- 避免使用「原告」「被告」「訴訟標的」等艱深術語，改用「你」「醫院」「這個案子」
- 行動建議要具體到「今天就可以做」，不要只給方向`;
}

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║    醫法通 AI 分析伺服器已啟動                      ║
║                                                    ║
║    網址: http://localhost:${PORT}                      ║
║                                                    ║
${GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE' 
  ? '║    ⚠️  警告: Gemini API Key 尚未設定               ║\n║       請修改 server.js 或設定環境變數              ║' 
  : '║    ✓ Gemini API 已配置                            ║'}
║                                                    ║
╚════════════════════════════════════════════════════╝
  `);
});
