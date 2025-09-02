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
// import { ProxyAgent, setGlobalDispatcher } from 'undici';
// const proxy = new ProxyAgent('http://127.0.0.1:7890');
// setGlobalDispatcher(proxy);
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

// 更详细的错误打印，帮助定位 fetch failed 的具体原因
function logErrorDetails(prefix, err) {
  try {
    const e = err || {};
    console.error(prefix, {
      name: e?.name,
      message: e?.message,
      type: typeof e,
      code: e?.code,
      errno: e?.errno,
      syscall: e?.syscall,
      address: e?.address,
      port: e?.port,
      cause: e?.cause ? {
        name: e.cause?.name,
        message: e.cause?.message,
        code: e.cause?.code,
        errno: e.cause?.errno,
        syscall: e.cause?.syscall,
      } : undefined,
      stack: e?.stack,
    });
  } catch (_) {
    console.error(prefix, err);
  }
}

// JSON 清理和解析的辅助函数
// function cleanAndParseJSON(text) {
//   try {
//     // 第一次尝试：直接解析
//     return JSON.parse(text);
//   } catch (e) {
//     console.log("First JSON parse failed, trying to clean the text...");
    
//     // 第二次尝试：移除 markdown 代码块标记
//     let clean = text.replace(/```json\s*|\s*```/g, "");
    
//     try {
//       return JSON.parse(clean);
//     } catch (e2) {
//       console.log("Second JSON parse failed, trying to remove comments...");
      
//       // 第三次尝试：移除 JavaScript 风格的注释
//       clean = clean.replace(/\/\/.*$/gm, ""); // 移除单行注释
//       clean = clean.replace(/\/\*[\s\S]*?\*\//g, ""); // 移除多行注释
      
//       try {
//         return JSON.parse(clean);
//       } catch (e3) {
//         console.log("Third JSON parse failed, trying to extract JSON from text...");
        
//         // 第四次尝试：从文本中提取 JSON 部分
//         const jsonMatch = clean.match(/\{[\s\S]*\}/);
//         if (jsonMatch) {
//           try {
//             return JSON.parse(jsonMatch[0]);
//           } catch (e4) {
//             console.log("JSON extraction failed");
//             throw new Error(`Failed to parse JSON after multiple attempts: ${e4.message}`);
//           }
//         } else {
//           throw new Error(`No valid JSON found in response: ${e3.message}`);
//         }
//       }
//     }
//   }
// }
// function cleanAndParseJSON(input) {
//   if (input && typeof input === 'object') {
//     // 已是对象则直接返回
//     return input;
//   }
//   // 统一成字符串并做基础清理
//   let text = String(input ?? '').trim();

//   // 去掉 BOM
//   text = text.replace(/^\uFEFF/, '');
//   // 去掉零宽/不换行等特殊空白
//   text = text.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
//   // 去掉行分隔/段落分隔符
//   text = text.replace(/[\u2028\u2029]/g, '\n');

//   // 优先提取 ```json ... ``` 或 ``` ... ``` 里的内容（若存在）
//   const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (fenced) text = fenced[1].trim();

//   // 兼容有人只写开头或结尾反引号的情况
//   text = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

//   // 替换智能引号，避免 JSON 中的花样引号
//   text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

//   // 去掉 JS 风格注释
//   text = text.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

//   // 直接尝试一次
//   try { return JSON.parse(text); } catch {}

//   // 去除可能的尾随逗号（JSON 不允许）
//   let textNoTrailingComma = text.replace(/,\s*([}\]])/g, '$1');
//   try { return JSON.parse(textNoTrailingComma); } catch {}

//   // 从文本中“配对括号”抽出第一个完整的 JSON 对象或数组
//   const sliceBalanced = (src, open, close) => {
//     let depth = 0, start = -1, inStr = false, esc = false;
//     for (let i = 0; i < src.length; i++) {
//       const ch = src[i];
//       if (inStr) {
//         if (esc) { esc = false; continue; }
//         if (ch === '\\') { esc = true; continue; }
//         if (ch === '"') { inStr = false; }
//         continue;
//       }
//       if (ch === '"') { inStr = true; continue; }
//       if (ch === open) { if (depth === 0) start = i; depth++; continue; }
//       if (ch === close) {
//         if (depth > 0) {
//           depth--;
//           if (depth === 0 && start !== -1) return src.slice(start, i + 1);
//         }
//       }
//     }
//     return null;
//   };

//   // 先找对象 {...}
//   let candidate = sliceBalanced(textNoTrailingComma, '{', '}');
//   if (candidate) {
//     try { return JSON.parse(candidate); } catch {}
//   }

//   // 再找数组 [...]
//   candidate = sliceBalanced(textNoTrailingComma, '[', ']');
//   if (candidate) {
//     try { return JSON.parse(candidate); } catch {}
//   }

//   // 还是不行就抛错
//   throw new Error('Failed to parse JSON after multiple attempts.');
// }
function cleanAndParseJSON(input) {
  if (input && typeof input === 'object') return input;

  const raw = String(input ?? '');

  // 1) Quick direct parse of the raw string
  try { return JSON.parse(raw); } catch {}

  // 2) 更全面的 markdown 代码块清理
  let text = raw;
  
  // 移除各种 markdown 代码块格式
  text = text.replace(/^```(?:json|JSON)?\s*\n?/gm, '');  // 移除开头的 ```json 或 ```
  text = text.replace(/\n?```\s*$/gm, '');                // 移除结尾的 ```
  text = text.replace(/^\s*```(?:json|JSON)?\s*|\s*```$/g, ''); // 备用清理
  
  // 移除可能的语言标识
  text = text.replace(/^(json|JSON)\s*[\r\n]+/i, '');
  
  // 清理前后空白
  text = text.trim();

  // Helper: extract first balanced object or array without modifying quotes
  const sliceBalanced = (src, open, close) => {
    let depth = 0, start = -1, inStr = false, esc = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = false; }
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === open) { if (depth === 0) start = i; depth++; continue; }
      if (ch === close) {
        if (depth > 0 && --depth === 0 && start !== -1) {
          return src.slice(start, i + 1);
        }
      }
    }
    return null;
  };

  // 3) Try balanced extraction on the cleaned text, then on raw as fallback
  let candidate = sliceBalanced(text, '{', '}') || sliceBalanced(text, '[', ']')
               || sliceBalanced(raw, '{', '}')  || sliceBalanced(raw, '[', ']');
  if (candidate) {
    try { return JSON.parse(candidate); } catch {}
    // safe touch-ups (do NOT normalize quotes)
    candidate = candidate.replace(/^\uFEFF/, '')               // BOM
                         .replace(/,\s*([}\]])/g, '$1');       // trailing commas
    return JSON.parse(candidate);
  }

  // 4) As a last resort, strip comments & trailing commas, but never change quotes
  let fallback = text
    .replace(/^\uFEFF/, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(fallback);
}

const app = express();
const PORT = process.env.PORT || 5095;

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
function buildPrompt(frameW, frameH, stepText = "", algorithm = "algo1") {
  console.log('step', stepText, 'algorithm', algorithm)
//   const algoRec = `Algorithm: We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):
//   list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]
//   list2[0] + merge(list1, list2[1:])  otherwise
// Namely, the smaller of the two lists' heads plus the result of a merge on the rest of the elements.`
//   const algoIter = `Algorithm (Iterative): Maintain a dummy prehead node and a pointer prev. Use p1 pointing to list1 and p2 to list2. Repeatedly compare p1 and p2, attach the smaller (if equal attach p1 first) to prev.next and advance that pointer and prev. When one list runs out, attach the remaining list to prev.next.`
//   const algoDesc = algorithm === 'iter' ? algoIter : algoRec;
  const algoRecZh = `算法（递归合并有序链表）：
设 list1 与 list2 头节点分别为 list1[0]、list2[0]。忽略空表边界讨论，可递归定义为：
 list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]
  list2[0] + merge(list1, list2[1:])  否则
=> 当对比节点相等时，选择 list2 的节点（与上式“否则”分支一致）。
该定义表示：每次取两表当前较小（相等取 list2）的节点作为本步结果，余下部分继续合并。`;

const algoIterZh = `算法（迭代合并有序链表）：
维护一个虚拟头结点 prehead 与指针 prev；用 p1 指向 list1，p2 指向 list2。
循环比较 p1 与 p2：
- 若 p1.val < p2.val，则接到 prev.next，p1 前进；
- 否则（含相等），接 p2 到 prev.next，p2 前进（注意：相等时选 list2，保持与递归定义一致）；
prev 同步前进。任一链表耗尽后，把剩余链表整体接到 prev.next。`;

const algoGreedZh = `算法（贪心 · 跳跃游戏）：
维护“最远可达下标” farthest。遍历下标 i：
- 若 i ≤ farthest，则可站上 i，更新 farthest = max(farthest, i + nums[i])；
- 若 i > farthest，则出现不可达断层，返回 false；
- 任何时刻若 farthest ≥ n-1（末尾下标），立即返回 true。
贪心要点：每到一个可达位置，都只做一件事——把“最远覆盖”往右推到能达到的最远处。`;
// —— 根据选择拼接算法说明 ——
// algorithm ∈ 'rec' | 'iter' | 'greed'
const algoDescZh =
  algorithm === 'algo1'   ? algoRecZh :
  algorithm === 'iter'  ? algoIterZh :
  /* 'greed' */           algoGreedZh;
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
      "type": "rectangle" | "ellipse" | "diamond" | "arrow" | "text",
      "x_norm": number,                // required; top-left for shapes, start point for arrow
      "y_norm": number,
      // for text
      "text": string,                 // only for text or tag, the key word is text no label
      // for shapes:
      "w_norm": number,                // width normalized [0,1]
      "h_norm": number,                // height normalized [0,1]
      // for arrow:
      "end_x_norm": number,            // required if type = "arrow"
      "end_y_norm": number,
      "style": {                       // optional
        "strokeColor": string,         // e.g. "#ff0000"
        "fillColor": string,           // e.g. "transparent"
        "strokeWidth": number,
        "endArrowhead": "triangle" | "dot" | "arrow" | "bar" | null // null for line
      }
    }
  ],
  "notes": string                      // brief reasoning of what you added, in chinese
 }
 
 ${algoDescZh}
 
 TASK
 1) Decide which new elements to draw for the next step.
 2) Output ONLY the incremental overlay.
 
 CURRENT STEP (hint to follow):
 Based on Algorithm, ${stepText}, Only show this step
 
 OUTPUT
 - Return STRICT JSON only. No extra commentary. 
 - DO NOT use triple backticks or code fences.
 - DO NOT include explanations outside JSON.
 `.trim();
}

/**
 * /analyze
 * body: { imagePath: string, w: number, h: number, stepText?: string }
 */
app.post("/analyze", async (req, res) => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // 仅测试用
  try {
    // 支持场景坐标（绝对坐标）返回
    const { base64, w, h, stepText, coords, originX, originY, frameW, frameH, algorithm } = req.body || {};
    if (!base64 || !w || !h) {
      return res.status(400).json({ ok: false, error: "Missing base64 or w/h" });
    }
    // 读图 -> base64
    // const base64 = await readImageAsBase64(imagePath);
    // const mimeType = "image/png";
    

    const prompt = buildPrompt(w, h, stepText, algorithm || 'algo1');
    let response;
    let text = '';
    
    try {
      response = await ai.models.generateContent({
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
      text = response.text || '';
    } catch (e) {
      logErrorDetails('[analyze] generateContent failed', e);
      
      // 检查是否是服务过载错误
      if (e.message && e.message.includes('overloaded') || e.message.includes('503') || e.message.includes('UNAVAILABLE')) {
        console.log('[analyze] AI service overloaded, using fallback test data');
        
        // 使用回退测试数据
        text = `{
          "elements": [
            {
              "type": "rectangle",
              "x_norm": 0.12,
              "y_norm": 0.88,
              "w_norm": 0.099,
              "h_norm": 0.086,
              "style": {
                "strokeColor": "#fff",
                "fillColor": "transparent",
                "strokeWidth": 2
              }
            }
          ],
          "notes": "AI服务暂时过载，请再次尝试或稍后尝试。"
        }`;
      } else {
        // 其他错误仍然抛出
      throw e;
    }
    }
//          const text = `{
//    "elements": [
//      {
//        "type": "rectangle",
//        "x_norm": 0.12,
//        "y_norm": 0.88,
//        "w_norm": 0.099,
//        "h_norm": 0.086,
//        "style": {
//          "strokeColor": "#000000",
//          "fillColor": "transparent",
//          "strokeWidth": 2
//        }
//      },
//      {
//        "type": "text",
//        "x_norm": 0.158,
//        "y_norm": 0.916,
//        "text": "1"
//      },
//      {
//        "type": "arrow",
//        "x_norm": 0.219,
//        "y_norm": 0.923,
//        "end_x_norm": 0.282,
//        "end_y_norm": 0.923,
//        "style": {
//          "strokeColor": "#000000",
//          "strokeWidth": 2,
//          "endArrowhead": "triangle"
//        }
//      },
//      {
//        "type": "rectangle",
//        "x_norm": 0.282,
//        "y_norm": 0.88,
//        "w_norm": 0.099,
//        "h_norm": 0.086,
//        "style": {
//          "strokeColor": "#000000",
//          "fillColor": "transparent",
//          "strokeWidth": 2
//        }
//      },
//      {
//        "type": "text",
//        "x_norm": 0.320,
//        "y_norm": 0.916,
//        "text": "1"
//      },
//      {
//        "type": "arrow",
//        "x_norm": 0.381,
//        "y_norm": 0.923,
//        "end_x_norm": 0.444,
//        "end_y_norm": 0.923,
//        "style": {
//          "strokeColor": "#000000",
//          "fillColor": "transparent",
//          "strokeWidth": 2
//        }
//      },
//      {
//        "type": "rectangle",
//        "x_norm": 0.444,
//        "y_norm": 0.88,
//        "w_norm": 0.099,
//        "h_norm": 0.086,
//        "style": {
//          "strokeColor": "#000000",
//          "fillColor": "transparent",
//          "strokeWidth": 2
//        }
//      },
//      {
//        "type": "text",
//        "x_norm": 0.482,
//        "y_norm": 0.916,
//        "text": "2"
//      },
//      {
//        "type": "arrow",
//        "x_norm": 0.543,
//        "y_norm": 0.923,
//        "end_x_norm": 0.606,
//        "end_y_norm": 0.923,
//        "style": {
//          "strokeColor": "#000000",
//          "strokeWidth": 2,
//          "endArrowhead": "triangle"
//        }
//      },
//      {
//        "type": "rectangle",
//        "x_norm": 0.606,
//        "y_norm": 0.88,
//        "w_norm": 0.099,
//        "h_norm": 0.086,
//        "style": {
//          "strokeColor": "#000000",
//          "fillColor": "transparent",
//          "strokeWidth": 2
//        }
//      },
//      {
//        "type": "text",
//        "x_norm": 0.644,
//        "y_norm": 0.916,
//        "text": "3"
//      },
//      {
//        "type": "arrow",
//        "x_norm": 0.705,
//        "y_norm": 0.923,
//        "end_x_norm": 0.768,
//        "end_y_norm": 0.923,
//        "style": {
//          "strokeColor": "#000000",
//          "strokeWidth": 2,
//          "endArrowhead": "triangle"
//        }
//      },
//      {
//        "type": "rectangle",
//        "x_norm": 0.768,
//        "y_norm": 0.88,
//        "w_norm": 0.099,
//        "h_norm": 0.086,
//        "style": {
//          "strokeColor": "#000000",
//          "fillColor": "transparent",
//          "strokeWidth": 2
//        }
//      },
//      {
//        "type": "text",
//        "x_norm": 0.806,
//        "y_norm": 0.916,
//        "text": "4"
//      }
//    ],
//    "notes": "根据算法，当list1和list2的头节点都为4时，选择list2的节点4合并。因此，将完整的合并链表1->1->2->3->4绘制出来。由于画布限制，合并链表绘制在"merged"文本上方以保证可见性。"
//  }`
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

  //   // 使用辅助函数清理和解析 JSON
  //   let payload;
  //   try {
  //     payload = cleanAndParseJSON(text);
  //   } catch (e) {
  //     console.error("Failed to parse JSON from model response:", e.message);
  //     throw new Error(`JSON parsing failed: ${e.message}`);
  //   }

  //   return res.json({ ok: true, payload });
  
  let payload;
  try {
    console.log("Raw analyze response:", text);
    payload = cleanAndParseJSON(text);
    console.log("Parsed analyze payload:", payload);

    // 若前端要求 scene 坐标，则把归一化坐标映射为画布绝对坐标
    if (
      coords === 'scene' &&
      Number.isFinite(originX) && Number.isFinite(originY) &&
      Number.isFinite(frameW) && Number.isFinite(frameH)
    ) {
      const ox = Number(originX) || 0;
      const oy = Number(originY) || 0;
      const fw = Number(frameW) || 1;
      const fh = Number(frameH) || 1;
      const toAbs = (xn, yn) => ({ x: ox + (Number(xn) || 0) * fw, y: oy + (Number(yn) || 0) * fh });
      const absW = (wn) => Math.max(1, Math.round((Number(wn) || 0) * fw));
      const absH = (hn) => Math.max(1, Math.round((Number(hn) || 0) * fh));

      const mapped = (payload?.elements || []).map((el) => {
        // 如果已是绝对坐标（存在 x/y 或 end_x/end_y 或 points(x,y)），直接返回
        if (typeof el?.x === 'number' || typeof el?.end_x === 'number' || Array.isArray(el?.points) && el.points[0] && typeof el.points[0].x === 'number') {
          return el;
        }
        return { ...el };
      });

      // 精确类型分支
      for (let i = 0; i < mapped.length; i++) {
        const el = mapped[i];
        if (["rectangle","ellipse","diamond","image"].includes(el?.type)) {
          const p = toAbs(el.x_norm, el.y_norm);
          const wpx = absW(el.w_norm);
          const hpx = absH(el.h_norm);
          mapped[i] = {
            ...el,
            x: Math.round(p.x),
            y: Math.round(p.y),
            w: wpx,
            h: hpx,
          };
          delete mapped[i].x_norm; delete mapped[i].y_norm; delete mapped[i].w_norm; delete mapped[i].h_norm;
          continue;
        }
        if (el?.type === 'arrow') {
          const s = toAbs(el.x_norm, el.y_norm);
          const e = toAbs(el.end_x_norm, el.end_y_norm);
          mapped[i] = {
            ...el,
            x: Math.round(s.x),
            y: Math.round(s.y),
            end_x: Math.round(e.x),
            end_y: Math.round(e.y),
          };
          delete mapped[i].x_norm; delete mapped[i].y_norm; delete mapped[i].end_x_norm; delete mapped[i].end_y_norm;
          continue;
        }
        if (el?.type === 'text') {
          const p = toAbs(el.x_norm, el.y_norm);
          mapped[i] = { ...el, x: Math.round(p.x), y: Math.round(p.y) };
          delete mapped[i].x_norm; delete mapped[i].y_norm;
          continue;
        }
        if (el?.type === 'line' || el?.type === 'draw') {
          const pts = Array.isArray(el.points) ? el.points : [];
          const absPts = pts.map((pt) => {
            const p = toAbs(pt.x_norm, pt.y_norm);
            return { x: Math.round(p.x), y: Math.round(p.y) };
          });
          mapped[i] = { ...el, x: 0, y: 0, points: absPts };
          continue;
        }
      }

      payload = { ...(payload || {}), elements: mapped };
    }

    return res.status(200).json({ ok: true, payload });
  } catch (e) {
    console.error("[/analyze] JSON parse failed, return fallback", { err: String(e), sample: text?.slice?.(0, 200) });
    
    // 尝试手动提取 JSON 内容
    try {
      // 更激进的清理尝试
      let cleanedText = text;
      
      // 移除所有 markdown 代码块标记
      cleanedText = cleanedText.replace(/```(?:json|JSON)?\s*\n?/g, '');
      cleanedText = cleanedText.replace(/\n?```\s*/g, '');
      
      // 查找第一个 { 和最后一个 }
      const firstBrace = cleanedText.indexOf('{');
      const lastBrace = cleanedText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonContent = cleanedText.substring(firstBrace, lastBrace + 1);
        console.log("Extracted JSON content from analyze:", jsonContent);
        
        const manualPayload = JSON.parse(jsonContent);
        console.log("Manual parse successful for analyze:", manualPayload);
        
        // 继续处理坐标映射逻辑...
        if (
          coords === 'scene' &&
          Number.isFinite(originX) && Number.isFinite(originY) &&
          Number.isFinite(frameW) && Number.isFinite(frameH)
        ) {
          const ox = Number(originX) || 0;
          const oy = Number(originY) || 0;
          const fw = Number(frameW) || 1;
          const fh = Number(frameH) || 1;
          const toAbs = (xn, yn) => ({ x: ox + (Number(xn) || 0) * fw, y: oy + (Number(yn) || 0) * fh });
          const absW = (wn) => Math.max(1, Math.round((Number(wn) || 0) * fw));
          const absH = (hn) => Math.max(1, Math.round((Number(hn) || 0) * fh));

          const mapped = (manualPayload?.elements || []).map((el) => {
            // 如果已是绝对坐标（存在 x/y 或 end_x/end_y 或 points(x,y)），直接返回
            if (typeof el?.x === 'number' || typeof el?.end_x === 'number' || Array.isArray(el?.points) && el.points[0] && typeof el.points[0].x === 'number') {
              return el;
            }
            return { ...el };
          });

          // 精确类型分支
          for (let i = 0; i < mapped.length; i++) {
            const el = mapped[i];
            if (["rectangle","ellipse","diamond","image"].includes(el?.type)) {
              const p = toAbs(el.x_norm, el.y_norm);
              const wpx = absW(el.w_norm);
              const hpx = absH(el.h_norm);
              mapped[i] = {
                ...el,
                x: Math.round(p.x),
                y: Math.round(p.y),
                w: wpx,
                h: hpx,
              };
              delete mapped[i].x_norm; delete mapped[i].y_norm; delete mapped[i].w_norm; delete mapped[i].h_norm;
              continue;
            }
            if (el?.type === 'arrow') {
              const s = toAbs(el.x_norm, el.y_norm);
              const e = toAbs(el.end_x_norm, el.end_y_norm);
              mapped[i] = {
                ...el,
                x: Math.round(s.x),
                y: Math.round(s.y),
                end_x: Math.round(e.x),
                end_y: Math.round(e.y),
              };
              delete mapped[i].x_norm; delete mapped[i].y_norm; delete mapped[i].end_x_norm; delete mapped[i].end_y_norm;
              continue;
            }
            if (el?.type === 'text') {
              const p = toAbs(el.x_norm, el.y_norm);
              mapped[i] = { ...el, x: Math.round(p.x), y: Math.round(p.y) };
              delete mapped[i].x_norm; delete mapped[i].y_norm;
              continue;
            }
            if (el?.type === 'line' || el?.type === 'draw') {
              const pts = Array.isArray(el.points) ? el.points : [];
              const absPts = pts.map((pt) => {
                const p = toAbs(pt.x_norm, pt.y_norm);
                return { x: Math.round(p.x), y: Math.round(p.y) };
              });
              mapped[i] = { ...el, x: 0, y: 0, points: absPts };
              continue;
            }
          }

          manualPayload = { ...(manualPayload || {}), elements: mapped };
        }
        
        return res.status(200).json({ ok: true, payload: manualPayload });
      }
    } catch (manualError) {
      console.error("Manual JSON extraction also failed:", manualError.message);
    }
    
    // 兜底返回，避免上游看到 ECONNRESET
    return res.status(200).json({
      ok: true,
      payload: {
        elements: [],                  // 不画新东西
        notes: typeof text === 'string' ? text : String(text)  // 直接把原文本当提示
      }
    });
  }
} catch (err) {
    const msg = (err && (err.message || String(err))) || '';
    console.warn("analyze error:", msg);
    logErrorDetails('[analyze] caught error', err);
    if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|timeout/i.test(msg)) {
      // 兜底返回友好 200，避免前端中断
      return res.status(200).json({
        ok: true,
        payload: {
          elements: [],                  // 不画新东西
          notes: '网络或 AI 服务暂时不可用，请稍后再试，或再次点击“提示”。'
        }
      });
    }
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

/**
 * /validate-step
 * body: { imagePath: string, stepText: string }
 */
app.post("/validate", async (req, res) => {
  try {
    const { base64, currentStepText, previousStepText, step, mode, algorithm } = req.body || {};
    if (!base64 || !currentStepText) {
      return res.status(400).json({ ok: false, error: "Missing base64 or currentStepText" });
    }

    // 读取图片并转换为 Base64
    // const base64 = await readImageAsBase64(imagePath);

    // 添加调试日志
    console.log('validate request:', {
      mode,
      step,
      currentStepText: currentStepText?.substring(0, 100) + '...',
      previousStepText: previousStepText?.substring(0, 100) + '...',
      hasPreviousStep: !!previousStepText,
      algorithm: algorithm
    });

    // 构造验证提示
//     const algoRec = `Algorithm: We can recursively define the result of a merge operation on two lists as the following (avoiding the corner case logic surrounding empty lists):
//   list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]
//   list2[0] + merge(list1, list2[1:])  otherwise
// Namely, the smaller of the two lists' heads plus the result of a merge on the rest of the elements.`

//   const algoIter = `Algorithm (Iterative): Maintain a dummy prehead node and a pointer prev. Use p1 pointing to list1 and p2 to list2. Repeatedly compare p1 and p2, attach the smaller (if equal attach p1 first) to prev.next and advance that pointer and prev. When one list runs out, attach the remaining list to prev.next.`

//   const algoGreed = `Algorithm (Greedy): For the jumping game problem, we use a greedy approach where we maintain the farthest position we can reach. At each step i, if i is reachable (i <= farthest), we update farthest = max(farthest, i + nums[i]). If at any point i > farthest, we return false. If farthest >= n-1, we return true. The greedy choice is to always try to jump as far as possible at each reachable position.`

//   const algoDesc = algorithm === 'iter' ? algoIter : algorithm === 'greed' ? algoGreed : algoRec;
// console.log(algoDesc)
//     const prompt = `
//       You are an AI assistant that analyzes a linked-list diagram (PNG image) and checks if it matches the given step description.
      
//      ALGORITHM Description: ${algoDesc}
      
//       ${previousStepText ? `PREVIOUS STEP DESCRIPTION:
//       ${previousStepText}
      
//       ` : ''}CURRENT STEP DESCRIPTION:
//       ${currentStepText}
      
//       TASK:
//       - Analyze the provided image and determine if it correctly represents the CURRENT step description for the algorithm. 
//       - The image may contain elements from previous steps (which is acceptable).
//       - Focus on validating the CURRENT step requirements specific to the algorithm description. 前提是必须满足算法描述，注意公式中定义的节点一样的话是选list2的节点
//       - Return a JSON object with the following structure:
//         {
//           "isValid": boolean,
//           "message": string
//         }
//       - "isValid" should be true if the image satisfies the CURRENT step description, 前提是必须满足算法描述，注意公式中定义的节点一样的话是选list2的节点. Additional elements from previous steps are acceptable.
//       - "message" should provide a brief explanation of the result, in chinese.

// OUTPUT RULES (VERY IMPORTANT)
// - Return STRICT JSON only, one object. No code fences, no markdown, no prose.
// - Start with '{' and end with '}'. Do not prefix or suffix any text.
// - Use plain ASCII quotes (\"). Do NOT use smart quotes.
//     `.trim();
// —— 算法说明（中文，含关键判定要点）——
const algoRecZh = `算法（递归合并有序链表）：
设 list1 与 list2 头节点分别为 list1[0]、list2[0]。忽略空表边界讨论，可递归定义为：
 list1[0] + merge(list1[1:], list2)  list1[0] < list2[0]
  list2[0] + merge(list1, list2[1:])  否则
=> 当对比节点相等时，选择 list2 的节点（与上式“否则”分支一致）。
该定义表示：每次取两表当前较小（相等取 list2）的节点作为本步结果，余下部分继续合并。`;

const algoIterZh = `算法（迭代合并有序链表）：
维护一个虚拟头结点 prehead 与指针 prev；用 p1 指向 list1，p2 指向 list2。
循环比较 p1 与 p2：
- 若 p1.val < p2.val，则接到 prev.next，p1 前进；
- 否则（含相等），接 p2 到 prev.next，p2 前进（注意：相等时选 list2，保持与递归定义一致）；
prev 同步前进。任一链表耗尽后，把剩余链表整体接到 prev.next。`;

const algoGreedZh = `算法（贪心 · 跳跃游戏）：
维护“最远可达下标” farthest。遍历下标 i：
- 若 i ≤ farthest，则可站上 i，更新 farthest = max(farthest, i + nums[i])；
- 若 i > farthest，则出现不可达断层，返回 false；
- 任何时刻若 farthest ≥ n-1（末尾下标），立即返回 true。
贪心要点：每到一个可达位置，都只做一件事——把“最远覆盖”往右推到能达到的最远处。`;
// —— 根据选择拼接算法说明 ——
// algorithm ∈ 'rec' | 'iter' | 'greed'
const algoDescZh =
  algorithm === 'algo1'   ? algoRecZh :
  algorithm === 'iter'  ? algoIterZh :
  /* 'greed' */           algoGreedZh;

// —— 评审提示（中文，统一输出要求与判定准则）——
const prompt = `
你是一名仅判断“当前步骤是否符合算法描述”的图示评审助手。输入是一张 PNG 算法示意图与步骤文字。

【算法说明（最高准则）】
${algoDescZh}

【步骤文字】
${previousStepText ? `（可出现但不作为必须条件）上一阶段：\n${previousStepText}\n` : ''}（必须满足）当前步骤：\n${currentStepText}

【评审准则】
- 以“算法说明”为最高准则：若图像与算法冲突，判定不通过。
- 只验证“当前步骤”的必要条件；图中包含上一阶段元素是允许的。
- 合并链表题：当两表头值相等时，必须选择 list2 的节点（与递归公式一致）。
- 若图像信息不足以确认关键条件，判定不通过，并在 message 中说明缺失信息。

【输出】
严格返回一个 JSON 对象（仅此一行）：
{
  "isValid": boolean,
  "message": "用中文简要说明原因"
}
输出规则（非常重要）：只能有一个对象；不得包含任何额外文本；使用 ASCII 引号。
`.trim();

console.log(prompt);

    // 调用 Google GenAI 模型
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
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

    // 获取模型返回的文本（更稳妥：拼接 parts 文本）
    const text = (
      response?.response?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text || '')
        .join('')
    ) || response?.text || '';
    if (!text) {
      return res.status(502).json({ ok: false, error: "Empty response from model" });
    }
    console.log("returned data:", text);
    // 使用辅助函数清理和解析 JSON
    let result;
    try {
      console.log("Raw model response:", text);
      result = cleanAndParseJSON(text);
      console.log("Parsed result:", result);
      // 返回结果
      return res.json({ ok: true, ...result });
    } catch (e) {
      console.error("Failed to parse JSON from model response in validate:", e.message);
      console.error("Raw text sample:", text?.slice?.(0,500));
      
      // 尝试手动提取 JSON 内容
      try {
        // 更激进的清理尝试
        let cleanedText = text;
        
        // 移除所有 markdown 代码块标记
        cleanedText = cleanedText.replace(/```(?:json|JSON)?\s*\n?/g, '');
        cleanedText = cleanedText.replace(/\n?```\s*/g, '');
        
        // 查找第一个 { 和最后一个 }
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonContent = cleanedText.substring(firstBrace, lastBrace + 1);
          console.log("Extracted JSON content:", jsonContent);
          
          const manualResult = JSON.parse(jsonContent);
          console.log("Manual parse successful:", manualResult);
          return res.json({ ok: true, ...manualResult });
        }
      } catch (manualError) {
        console.error("Manual JSON extraction also failed:", manualError.message);
      }
      
      // 兜底：不要 500，直接把原文作为 message 返回，避免前端失败
      return res.status(200).json({ ok: true, isValid: false, message: typeof text === 'string' ? text : String(text) });
    }
  } catch (err) {
    // 网络类错误统一兜底 200，避免前端中断
    const msg = (err && (err.message || String(err))) || '';
    if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|timeout/i.test(msg)) {
      return res.status(200).json({ ok: true, isValid: false, message: `网络错误或代理不可用，请再次点击按钮尝试` });
    }
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// 