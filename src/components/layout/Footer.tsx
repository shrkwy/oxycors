export function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-700 py-6 mt-auto">
      <div className="container mx-auto px-6 text-center text-gray-400 text-sm">
        <p>&copy; {new Date().getFullYear()} Oxycors. All rights reserved.</p>
        <p className="mt-1">
          Crafted with{" "}
          <span role="img" aria-label="love">
            ❤️
          </span>{" "}
          by{" "}
          <a
            href="https://github.com/shrkwy"
            className="text-teal-400 underline hover:text-teal-500"
          >
            @shrkwy
          </a>
        </p>
      </div>
    </footer>
  );
}
