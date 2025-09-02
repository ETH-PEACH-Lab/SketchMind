import React from 'react';
import { Box, Typography } from '@mui/material';
import MarkdownWithDrawing from './MarkdownWithDrawing';

interface LeftPaneProps {
  markdown: string;
  onAlgorithmSelect: (alg: string) => Promise<void>;
}

export default React.memo(function LeftPane({ markdown, onAlgorithmSelect }: LeftPaneProps) {
  return (
    <div className="w-2/5 relative bg-gray-100">
      <MarkdownWithDrawing 
        markdown={markdown} 
        onAlgorithmSelect={onAlgorithmSelect} 
      />
      
      {/* 贪心算法动画演示视频 */}
      <Box sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
          🎥 贪心算法动画演示
        </Typography>
        <Box sx={{ 
          borderRadius: 1, 
          overflow: 'hidden', 
          border: '1px solid #e0e0e0',
          bgcolor: 'white'
        }}>
          <video
            controls
            preload="metadata"
            playsInline
            muted
            style={{ width: '100%', height: 'auto', display: 'block' }}
            poster="/video-poster.jpg"
            onError={(e) => console.error('Video error:', e)}
          >
            <source src="/videos/greed.mp4" type="video/mp4" />
            <source src="/videos/greed.webm" type="video/webm" />
            您的浏览器不支持视频播放。
          </video>
        </Box>
        <Typography variant="body2" sx={{ mt: 1, color: '#666', fontSize: '0.875rem' }}>
          观看贪心算法在跳跃游戏中的实际应用过程
        </Typography>
      </Box>
    </div>
  );
});
