// pages/api/ai-draw.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { mode } = req.body

  if (mode === 'check') {
    return res.status(200).json({ result: '✅ Looks good so far!' })
  }

  if (mode === 'hintOnly') {
    return res.status(200).json({ result: 'Try connecting the next node from list1 to list2.' })
  }

  if (mode === 'nextDraw') {
    // 返回 SVG 元素字符串（不要包含 <svg> 根标签）
    const svgFragment = `
      <rect x="210" y="220" width="40" height="40" fill="white" stroke="red" stroke-width="2"/>
<text x="225" y="245" font-size="16" font-family="Arial" fill="red">1</text>
    `
    return res.status(200).json({ result: svgFragment })
  }

  return res.status(400).json({ result: 'Invalid mode' })
}
