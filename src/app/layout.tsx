import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import CookieConsent from '@/components/ui/CookieConsent';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'ECOD - Evolutionary Classification of Protein Domains',
    template: '%s | ECOD',
  },
  description:
    'ECOD is a hierarchical classification of protein domains based on evolutionary relationships, combining automated analysis with manual curation.',
  keywords: [
    'ECOD',
    'protein domains',
    'protein structure',
    'protein classification',
    'bioinformatics',
    'structural biology',
    'PDB',
    'AlphaFold',
    'protein fold',
    'evolutionary classification',
  ],
  authors: [{ name: 'Grishin Lab', url: 'http://prodata.swmed.edu/' }],
  openGraph: {
    title: 'ECOD - Evolutionary Classification of Protein Domains',
    description:
      'Hierarchical classification of protein domains based on evolutionary relationships',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <ThemeProvider>
          <Header />
          <main className="flex-grow">{children}</main>
          <Footer />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
