import { ImageResponse } from 'next/og'
export async function GET(req: Request) {
  return new ImageResponse(<div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
    <img src={new URL('/fiteasy-logo.png', req.url).href} width={460} height={215} />
  </div>, { width: 512, height: 512, headers: { 'Cache-Control': 'public, max-age=86400' } })
}
