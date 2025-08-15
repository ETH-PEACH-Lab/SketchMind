// const { HttpsProxyAgent } = require('https-proxy-agent');
// global.fetch = (...args) =>
//   import('node-fetch').then(({ default: fetch }) =>
//     fetch(...args, { agent: new HttpsProxyAgent('http://127.0.0.1:7890') })
//   );

// require('dotenv').config();

// const express = require('express');
// const cors = require('cors');
// const path = require('path');
// const fs = require('fs').promises;
// const multer = require('multer');
// import { GoogleGenAI } from '@google/genai';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
// 127.0.0.1:7890 换成你自己的 HTTP 代理端口
const proxy = new ProxyAgent('http://127.0.0.1:7890');
setGlobalDispatcher(proxy);
import { HttpsProxyAgent } from 'https-proxy-agent';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const app = express();
const PORT = process.env.PORT || 4000;

// 中间件
app.use(cors({ origin: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 确保 uploads 目录存在
const uploadsDir = path.join(__dirname, 'uploads');
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true });
// }
// 静态文件托管
app.use('/uploads', express.static(uploadsDir));

// Multer：接收 multipart/form-data
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname || '.png') || '.png';
    cb(null, `png_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sketch-backend', time: new Date().toISOString() });
});

/**
 * POST /save-png
 * 支持两种方式：
 *  1) multipart/form-data:  image=<file>
 *  2) JSON: { dataUrl: "data:image/png;base64,...." }
 */
app.post('/save-png', upload.single('image'), async (req, res) => {

  //  try {
  //   const r = await fetch('https://www.google.com');
  //   const html = await r.text();

  //   console.log('ok',html)
  // } catch (err) {
  //   console.log('err', err.message);
  // }
  try {
    // Case 1: multipart
    if (req.file) {
      const abs = path.resolve(req.file.path);
      return res.json({
        ok: true,
        via: 'multipart',
        file: req.file.filename,
        path: abs,
        url: `/uploads/${req.file.filename}`,
      });
    }

    // Case 2: dataUrl
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      return res.status(400).json({ ok: false, error: 'No image provided. Use multipart field "image" or JSON { dataUrl }' });
    }

    const [header, base64] = dataUrl.split(',');
    const ext = header.includes('image/png') ? '.png'
             : header.includes('image/jpeg') ? '.jpg'
             : header.includes('image/webp') ? '.webp'
             : '.png';

    const buf = Buffer.from(base64, 'base64');
    const filename = `png_${Date.now()}${ext}`;
    const outPath = path.join(__dirname, 'uploads', filename);
    fs.writeFileSync(outPath, buf);

    res.json({
      ok: true,
      via: 'dataUrl',
      file: filename,
      path: path.resolve(outPath),
      url: `/uploads/${filename}`,
    });
  } catch (err) {
    console.error('save-png error:', err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * POST /analyze-png
 * 接收 multipart 的 image，返回本地假结果（不调外网），用于打通前后端流程
 * 以后接 Gemini：在此读取 req.file.path，把文件转成 base64 / bytes，再请求模型 API 即可
 */

// 小工具：读取本地图片并 Base64
async function readImageAsBase64(imagePath) {
  const abspath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(process.cwd(), imagePath);
  const buf = await fs.readFile(abspath);
  return buf.toString("base64");
}

/**
 * 构造提示词（把画布宽高带进去，方便模型输出归一化坐标）
 */
function buildPrompt(frameW, frameH, stepText = "") {
  console.log('step', stepText)
  return `
You are an AI assistant that analyzes a linked-list diagram (PNG image; canvas width=${frameW}, height=${frameH}) 
and proposes the NEXT step overlay ONLY.

RULES
- Return INCREMENTAL elements to draw (do not repeat what already exists in the image).
- Coordinates are normalized to [0,1] relative to the ENTIRE canvas (not viewport).
- Keep output minimal and strictly valid JSON.

SCHEMA
{
  "elements": [
    {
      "type": "rectangle" | "ellipse" | "diamond" | "arrow" | "text ,
      "x_norm": number,                // required; top-left for shapes, start point for arrow
      "y_norm": number,
      // for text
      "text": string,                 // only for text or tag, the key word is text no label
      // for shapes:
      "w_norm": number,                // width normalized [0,1]
      "h_norm": number,                // height normalized [0,1]
      "label": string,                 // inside shapes
      // for arrow:
      "end_x_norm": number,            // required if type = "arrow"
      "end_y_norm": number,
      "style": {                       // optional
        "strokeColor": string,         // e.g. "#ff0000"
        "fillColor": string,           // e.g. "transparent"
        "strokeWidth": number,
        "endArrowhead": "triangle" | "dot" | "arrow" | "bar",  // "none" for line
      }
    }
  ],
  "notes": string                      // brief reasoning of what you added
}

Algorithm: We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):
  list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]
  list2[0] + merge(list1, list2[1:])  otherwise
Namely, the smaller of the two lists' heads plus the result of a merge on the rest of the elements.

TASK
1) Decide which new elements to draw for the next step of "merge two sorted lists".
2) Output ONLY the incremental overlay.

CURRENT STEP (hint to follow):
Based on Algorithm, ${stepText}, Only show this step

OUTPUT
- Return STRICT JSON only. No extra commentary.
`.trim();
}

/**
 * /analyze
 * body: { imagePath: string, w: number, h: number, stepText?: string }
 */
app.post("/analyze", async (req, res) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // 仅测试用
  try {
    const { base64, w, h, stepText } = req.body || {};
    if (!base64 || !w || !h) {
      return res.status(400).json({ ok: false, error: "Missing base64 or w/h" });
    }
    // 读图 -> base64
    // const base64 = await readImageAsBase64(imagePath);
    // const mimeType = "image/png";
    

    const prompt = buildPrompt(w, h, stepText);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // 或 gemini-2.5-flash（如果有权限）
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64,
              },
            },
          ],
        },
      ],
    });
    
    const text = response.text || '';
    console.log(text)
    // const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    // const result = await model.generateContent({
    //   contents: [
    //     {
    //       role: "user",
    //       parts: [
    //         { text: prompt },
    //         {
    //           inlineData: {
    //             data: base64,
    //             mimeType: String(mimeType),
    //           },
    //         },
    //       ],
    //     },
    //   ],
    // });
//     const text = `
// {
//   "elements": [
//     {
//       "type": "rectangle",
//       "label": "",
//       "x_norm": 0.3257,
//       "y_norm": 0.4967,
//       "w_norm": 0.1099,
//       "h_norm": 0.1699,
//       "style": {
//         "strokeColor": "#ff0000",
//         "fillColor": "transparent",
//         "strokeWidth": 3
//       }
//     }
//   ],
//   "notes": "Both heads are 1. According to the algorithm (list1[0] < list2[0] ? choose list1 : choose list2), we choose the head of list2 when they are equal. So, circle the '1' from list2."       
// }
// `
    // const text = result?.response?.text?.() || result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      return res.status(502).json({ ok: false, error: "Empty response from model" });
    }

    // 期望模型返回的是严格 JSON
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      // 有些时候模型会包一层 ```json ... ```
      const clean = text.replace(/```json\s*|\s*```/g, "");
      payload = JSON.parse(clean);
    }

    return res.json({ ok: true, payload });
  } catch (err) {
    console.error("analyze error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

/**
 * /validate-step
 * body: { imagePath: string, stepText: string }
 */
app.post("/validate", async (req, res) => {
  try {
    const { base64, stepText } = req.body || {};
    if (!base64 || !stepText) {
      return res.status(400).json({ ok: false, error: "Missing base64 or stepText" });
    }

    // 读取图片并转换为 Base64
    // const base64 = await readImageAsBase64(imagePath);

    // 构造验证提示
    const prompt = `
      You are an AI assistant that analyzes a linked-list diagram (PNG image) and checks if it matches the given step description.
      
      STEP DESCRIPTION:
      ${stepText}
      
      TASK:
      - Analyze the provided image and determine if it correctly represents the step description.
      - Return a JSON object with the following structure:
        {
          "isValid": boolean,
          "message": string
        }
      - "isValid" should be true if the image matches the step description, otherwise false.
      - "message" should provide a brief explanation of the result.
    `.trim();

    // 调用 Google GenAI 模型
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64,
              },
            },
          ],
        },
      ],
    });

    // 获取模型返回的文本
    const text = response.text || '';
    if (!text) {
      return res.status(502).json({ ok: false, error: "Empty response from model" });
    }

    // 尝试解析模型返回的 JSON
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      // 如果模型返回的内容不是有效的 JSON，尝试清理并重新解析
      const clean = text.replace(/```json\s*|\s*```/g, "");
      try {
        result = JSON.parse(clean);
      } catch (e) {
        return res.status(500).json({ ok: false, error: "Invalid JSON response from model" });
      }
    }

    // 返回结果
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("validate-step error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ backend listening on http://localhost:${PORT}`);
});
