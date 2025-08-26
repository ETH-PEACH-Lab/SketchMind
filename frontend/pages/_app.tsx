import '../styles/globals.css'
import '../styles/mobile.css' // 移动设备优化样式
import "@excalidraw/excalidraw/index.css" // Excalidraw 样式
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
