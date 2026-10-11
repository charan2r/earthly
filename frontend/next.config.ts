import type { NextConfig } from 'next';
const config: NextConfig = {
  async rewrites() { return [{ source: '/api/:path*', destination: `${process.env.API_URL || 'http://127.0.0.1:5000'}/api/:path*` }]; },
  async headers() { return [{source: '/sw.js', headers: [{key:'Cache-Control',value:'no-cache'},{key:'Service-Worker-Allowed',value:'/'}]}]; },
};
export default config;
