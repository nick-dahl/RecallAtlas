import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Geist_Mono, Instrument_Sans } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], axes: ['SOFT', 'opsz'], display: 'swap' });
const instrument = Instrument_Sans({ variable: '--font-instrument', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Recall Atlas', template: '%s · Recall Atlas' },
  description: 'Learn every flag in the world, and keep them.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
