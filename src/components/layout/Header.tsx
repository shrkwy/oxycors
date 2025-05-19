import { Tv2 } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="bg-gray-900 border-b border-gray-700 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <img
            src="https://cdn.jsdelivr.net/gh/shrkwy/content.host@master/img/oxycors/logo.png"
            alt="oxycors"
            className="h-8 w-auto filter brightness-110"
          />
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-1 text-gray-400 hover:text-teal-400 transition-colors duration-200"
            aria-label="Dashboard"
          >
            <Tv2 className="h-5 w-5" />
            <span className="sr-only">Dashboard</span>
          </Link>

          <Link
            href="https://github.com/shrkwy/oxycors"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-teal-400 transition-colors duration-200 font-medium"
          >
            Source 👨‍💻
          </Link>
        </nav>
      </div>
    </header>
);
}
