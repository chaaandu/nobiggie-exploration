/** schema.org JSON-LD. Only states what facts.ts knows: no ratings, no reviews, no invented address. */
import { brand, dips, flavours, type Flavour } from '../content/facts';

export function businessLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    '@id': `${brand.siteUrl}/#business`,
    name: brand.name,
    slogan: brand.tagline,
    url: brand.siteUrl,
    telephone: brand.phone.tel,
    ...(brand.email ? { email: brand.email } : {}),
    image: `${brand.siteUrl}/og/home.png`,
    logo: `${brand.siteUrl}/icon-512.png`,
    sameAs: [brand.instagram.url],
    areaServed: { '@type': 'City', name: 'Bengaluru' },
    ...(brand.address
      ? { address: { '@type': 'PostalAddress', streetAddress: brand.address, addressLocality: 'Bengaluru', addressRegion: brand.region, addressCountry: brand.country } }
      : {}),
    makesOffer: flavours.map((f) => ({ '@type': 'Offer', itemOffered: { '@id': `${brand.siteUrl}/shop/${f.id}#product` } })),
  };
}

export function productLd(f: Flavour): Record<string, unknown> {
  const url = `${brand.siteUrl}/shop/${f.id}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: `${f.name} mini cookies with ${dips[f.dip].name} dip`,
    description: f.blurb,
    sku: f.id,
    brand: { '@type': 'Brand', name: brand.name },
    image: [`${brand.siteUrl}/og/${f.id}.png`],
    url,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'INR',
      price: f.price,
      // Baked to order (confirmed), so this is the honest availability.
      availability: 'https://schema.org/MadeToOrder',
      seller: { '@id': `${brand.siteUrl}/#business` },
      areaServed: { '@type': 'City', name: 'Bengaluru' },
    },
  };
}
