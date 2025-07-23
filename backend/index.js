const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const { JSDOM } = require('jsdom'); // 用于解析 SVG

require('dotenv').config();
const app = express();
const port = process.env.PORT || 4000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// 配置 CORS
app.use(cors({
  origin: 'http://localhost:3000' // 只允许来自 http://localhost:3000 的请求
}));
app.use(bodyParser.json());

app.post('/api/ai-draw', (req, res) => {
  const { text, svg, mode } = req.body;

  // 打印接收到的数据（用于调试）
  console.log('Received data:', { text, svg, mode });

  // 根据模式返回不同的响应
  let result;
  switch (mode) {
    case 'check':
      result = 'Your solution looks good!';
      break;
    case 'nextDraw':
      // 返回一个简单的 SVG 元素作为示例
      result = `<rect x="10" y="10" width="100" height="100" fill="blue" />`;
      break;
    case 'hintOnly':
      result = 'Try to think about the base cases for the recursion.';
      break;
    default:
      result = 'Unknown mode';
  }

  // 返回 JSON 响应
  res.json({ result });
});

app.listen(port, () => {
  console.log(`✅ AI backend running at http://localhost:${port}`);
});