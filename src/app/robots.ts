import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.china-thailand-legal.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/auth/', '/payment/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

export { BASE_URL };
