import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Provider } from '@/components/provider';
import './global.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL('https://starredev.github.io/homey-sensy-s1pro/'),
  title: {
    template: '%s · Sensy S1 Pro for Homey',
    default: 'Sensy S1 Pro for Homey',
  },
  description:
    'Homey app for the Sensy-One S1 Pro Multi Sense: mmWave presence, zones, people counting and air quality, straight over the local ESPHome API.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${sans.className}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
