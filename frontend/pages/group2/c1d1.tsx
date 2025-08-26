import { useState } from 'react';
import { IconButton, Box, Typography, Button } from '@mui/material';
import { ArrowForwardIos as NextIcon } from '@mui/icons-material';

export default function Group2C1d1() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* 左侧导航栏 */}
        <Box
          sx={{
            width: isNavCollapsed ? 0 : 80,
            bgcolor: 'background.paper',
            borderRight: isNavCollapsed ? 0 : 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 2,
            transition: 'width 0.3s ease, border-right 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 收起/展开按钮 */}
          <IconButton
            onClick={() => setIsNavCollapsed(!isNavCollapsed)}
            sx={{
              position: 'fixed',
              left: isNavCollapsed ? 8 : 72,
              top: 20,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              boxShadow: 2,
              zIndex: 1000,
              width: 32,
              height: 32,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            {isNavCollapsed ? <NextIcon /> : <NextIcon sx={{ transform: 'rotate(180deg)' }} />}
          </IconButton>
        
          <Box sx={{ flex: 1, p: 1, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* 演示按钮 */}
              <Button
                variant="contained"
                fullWidth
                onClick={() => window.location.href = '/'}
                sx={{
                  py: 1,
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                }}
              >
                演示
              </Button>
              
              <Box
                sx={{
                  height: 1,
                  bgcolor: 'divider',
                  my: 1,
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              />
              
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  py: 1,
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  opacity: isNavCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              >
                测试组
              </Typography>
              
              {/* 组1 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: 'center',
                    py: 1,
                    px: 1,
                    fontSize: '0.875rem',
                    fontWeight: 'normal',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  组1
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => window.location.href = '/group1/c1d1'}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                      minHeight: '20px',
                      textTransform: 'none',
                      opacity: isNavCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    C1D1
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => window.location.href = '/group1/c2d2'}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                      minHeight: '20px',
                      textTransform: 'none',
                      opacity: isNavCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    C2D2
                  </Button>
                </Box>
              </Box>

              {/* 组2 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: 'center',
                    py: 1,
                    px: 1,
                    fontSize: '0.875rem',
                    fontWeight: 'normal',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  组2
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => window.location.href = '/group2/c2d2'}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                      minHeight: '20px',
                      textTransform: 'none',
                      opacity: isNavCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    C2D2
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => window.location.href = '/group2/c1d1'}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                      minHeight: '20px',
                      textTransform: 'none',
                      opacity: isNavCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    C1D1
                  </Button>
                </Box>
              </Box>

              {/* 组3 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: 'center',
                    py: 1,
                    px: 1,
                    fontSize: '0.875rem',
                    fontWeight: 'normal',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  组3
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => window.location.href = '/group3/c1d2'}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                      minHeight: '20px',
                      textTransform: 'none',
                      opacity: isNavCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    C1D2
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => window.location.href = '/group3/c2d1'}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                      minHeight: '20px',
                      textTransform: 'none',
                      opacity: isNavCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    C2D1
                  </Button>
                </Box>
              </Box>

              {/* 组4 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: 'center',
                    py: 1,
                    px: 1,
                    fontSize: '0.875rem',
                    fontWeight: 'normal',
                    opacity: isNavCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  组4
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => window.location.href = '/group4/c2d1'}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                      minHeight: '20px',
                      textTransform: 'none',
                      opacity: isNavCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    C2D1
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => window.location.href = '/group4/c1d2'}
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                      minHeight: '20px',
                      textTransform: 'none',
                      opacity: isNavCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    C1D2
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* 内容区域 */}
        <div className="flex-1 flex">
          {/* 左侧内容 */}
          <div className="w-2/5 relative bg-gray-100 p-6">
            <Typography variant="h4" sx={{ mb: 3, color: 'primary.main' }}>
              组2 - C1D1 页面
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              欢迎来到组2 - C1D1 页面！
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              这是一个测试页面，内容与index页面相同。
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              你可以在这里进行各种测试和演示。
            </Typography>
          </div>

          {/* 右侧内容 */}
          <div className="w-3/5 bg-white relative p-6">
            <Typography variant="h5" sx={{ mb: 3, color: 'text.secondary' }}>
              右侧内容区域
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              这里是右侧的内容区域，可以放置画布、图表或其他组件。
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              当前页面：组2 - C1D1 页面
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => alert('这是一个测试按钮！')}
              sx={{ mt: 2 }}
            >
              测试按钮
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}