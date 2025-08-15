// pages/api/analyze-png.ts
import type { NextApiRequest, NextApiResponse } from 'next'

// 关闭内置 body 解析，自己读二进制
export const config = { api: { bodyParser: false } }

// 一个带超时的 fetch 辅助函数（Node18+ 原生 fetch）
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal })
    return resp
  } finally {
    clearTimeout(id)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // 读取原始二进制 PNG
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => resolve())
      req.on('error', (err) => reject(err))
    })
    const buffer = Buffer.concat(chunks)
    if (!buffer.length) {
      return res.status(400).json({ error: 'Empty body' })
    }

    // 检查 API KEY
    const key = 'AIzaSyB01AG330d_erEz_5pz3x_vLtyeee40Ayw'
    if (!key) {
      return res.status(500).json({ error: 'Missing GOOGLE_GENAI_API_KEY' })
    }

    // PNG -> base64
    const base64 = buffer.toString('base64')

    // 🔧 你的任务定制 Prompt（严格 JSON 输出）
    const prompt =
      [
        'You are a drawing assistant for linked-list merging.',
        'Analyze the uploaded sketch (PNG).',
        '1) Extract a structured representation called "Merlin" (domain-specific text).',
        '2) Suggest the next *incremental* overlay as minimal inline SVG elements (e.g., a few <rect>/<path>/<text>), NOT the whole figure.',
        '3) Add short notes (one or two sentences).',
        '',
        'Return ONLY strictly valid JSON with the following shape:',
        '{',
        '  "merlin": "string",',
        '  "overlay_svg": "string",',
        '  "notes": "string"',
        '}',
      ].join('\n')

    // 组织 REST 请求体
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: base64, mimeType: 'image/png' } },
          ],
        },
      ],
    }

    // 直连 REST（绕过 SDK，便于排障）
    const endpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

    const resp = await fetchWithTimeout(`${endpoint}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 30000)

    if (!resp.ok) {
      const errTxt = await resp.text()
      console.error('Gemini REST error:', resp.status, errTxt)
      return res
        .status(502)
        .json({ error: 'Gemini REST error', status: resp.status, details: errTxt })
    }

    const json: any = await resp.json()
    const text =
      json?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text || '')
        .join('') ?? ''

    // 尝试解析为严格 JSON；否则兜底返回原文
    let payload: any
    try {
      payload = JSON.parse(text)
      // 轻度校验字段
      if (
        typeof payload !== 'object' ||
        typeof payload.merlin !== 'string' ||
        typeof payload.overlay_svg !== 'string' ||
        typeof payload.notes !== 'string'
      ) {
        throw new Error('Invalid JSON shape')
      }
    } catch (e) {
      payload = { raw: text }
    }

    return res.status(200).json(payload)
  } catch (err: any) {
    console.error('analyze-png failed:', {
      message: err?.message,
      name: err?.name,
      cause: err?.cause,
      stack: err?.stack,
    })
    // 超时/网络错误可能是 AbortError
    const status =
      (err?.name === 'AbortError' || err?.code === 'ETIMEDOUT') ? 504 : 500
    return res.status(status).json({ error: err?.message ?? 'Internal error' })
  }
}
