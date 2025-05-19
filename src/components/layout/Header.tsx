import { Tv2 } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <Tv2 className="h-8 w-8" />
          <h1 className="text-2xl font-semibold">StreamProxy</h1>
        </Link>
        {/* Navigation items can be added here if needed */}
      </div>
    </header>
  );
}
