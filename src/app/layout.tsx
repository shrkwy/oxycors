import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from '@/components/ui/toaster';

// Load Geist fonts for consistent typography
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Oxycors - HLS CORS Proxy',
  description: 'Next.js based cors proxy for hls streams, seamlessly proxy any hls stream.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-gray-900 text-gray-100 font-sans antialiased',
          geistSans.variable,
          geistMono.variable
        )}
      >
        <div className="flex flex-col min-h-screen">
          {/* Site Header */}
          <Header />

          {/* Main Content Area */}
          <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-10">
            {children}
          </main>

          {/* Site Footer */}
          <Footer />
        </div>

        {/* Global Toaster for notifications */}
        <Toaster />
      </body>
    </html>
  );
}
