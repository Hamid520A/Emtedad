/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://10.10.20.51:64000/:path*',
      },
    ];
  },
};

module.exports = nextConfig;