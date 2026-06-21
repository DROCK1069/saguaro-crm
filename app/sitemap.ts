import { MetadataRoute } from 'next';
import { COMPETITOR_SLUGS } from '@/lib/competitors';
import { CITY_SLUGS } from '@/lib/cities';
import { INDUSTRY_SLUGS } from '@/lib/industries';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://saguarocontrol.net';
  const now = new Date();

  const competitorPages: MetadataRoute.Sitemap = COMPETITOR_SLUGS.map(slug => ({
    url: `${base}/compare/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.85,
  }));

  const cityPages: MetadataRoute.Sitemap = CITY_SLUGS.map(slug => ({
    url: `${base}/local/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const industryPages: MetadataRoute.Sitemap = INDUSTRY_SLUGS.map(slug => ({
    url: `${base}/industry/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.85,
  }));

  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/compare/procore`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/switch-from-procore`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    ...competitorPages,
    { url: `${base}/roi-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/product/ai-takeoff`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/pay-applications`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/lien-waivers`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/bid-intelligence`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/field-app`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/certified-payroll`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/portals`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/sage-ai`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/financials`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/rfis`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/daily-logs`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/submittals`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/product/punch-lists`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/get-the-app`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/sandbox`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: 'yearly', priority: 0.7 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    ...cityPages,
    ...industryPages,
  ];
}
