import { ImageResponse } from 'next/og';
import { COMPANY_NAME, PRODUCT_NAME } from '@/lib/seo';

export const runtime = 'edge';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 45%, rgba(8,47,73,1) 100%)',
          color: 'white',
          padding: '56px 64px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>{COMPANY_NAME}</div>
          <div style={{ fontSize: 24, color: '#cbd5e1' }}>STEM Assessment Platform</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ maxWidth: 920, fontSize: 74, fontWeight: 800, lineHeight: 1.05 }}>
            {PRODUCT_NAME}
          </div>
          <div style={{ maxWidth: 980, fontSize: 30, color: '#e2e8f0', lineHeight: 1.35 }}>
            National talent assessment with online registration, performance analytics,
            awards, and school-level insights.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#bfdbfe' }}>
          <div>Ignite Brilliance. Master Tomorrow.</div>
          <div>{COMPANY_NAME}</div>
        </div>
      </div>
    ),
    size,
  );
}
