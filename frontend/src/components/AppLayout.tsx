import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { DemoBanner } from './DemoBanner';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/upload', label: 'Upload', icon: '📄' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/chat', label: 'Chat', icon: '💬' },
  { to: '/report', label: 'Report', icon: '📋' },
];

/**
 * Main application layout with responsive navigation.
 * Desktop (≥1024px): fixed left sidebar with nav links.
 * Mobile/Tablet (<1024px): hamburger menu that opens a slide-out nav.
 * Validates: Requirements 12.1, 12.3
 */
export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {/* Skip to main content link for keyboard users (WCAG 12.3) */}
      <a
        href="#main-content"
        className="skip-link"
      >
        Skip to main content
      </a>

      {/* Demo Banner - always at top */}
      <DemoBanner />

      {/* Desktop Sidebar - fixed position */}
      <aside
        className="hidden lg:block fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-neutral-200 z-30"
      >
        <div className="flex items-center h-16 px-6 border-b border-neutral-200">
          <NavLink to="/" className="text-xl font-bold text-primary-700">
            SmartWealth AI
          </NavLink>
        </div>
        <nav className="px-4 py-6 space-y-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-neutral-200 z-30 flex items-center px-4">
        <button
          onClick={toggleMenu}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          className="p-2 rounded-md text-neutral-600 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {mobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
        <span className="ml-3 text-lg font-bold text-primary-700">
          SmartWealth AI
        </span>
      </header>

      {/* Mobile Slide-out Navigation */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/30 z-40"
            onClick={closeMenu}
            aria-hidden="true"
          />
          {/* Slide-out panel */}
          <nav
            className="lg:hidden fixed inset-y-0 left-0 w-64 bg-white z-50 shadow-xl"
            aria-label="Main navigation"
          >
            <div className="flex items-center h-14 px-6 border-b border-neutral-200">
              <span className="text-lg font-bold text-primary-700">
                SmartWealth AI
              </span>
            </div>
            <div className="px-4 py-6 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`
                  }
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </>
      )}

      {/* Main Content - uses margin to offset fixed sidebar */}
      <div
        id="main-content"
        className="min-h-screen bg-neutral-50"
      >
        {/* Spacer for mobile header */}
        <div className="h-14 lg:hidden" />
        <div className="content-area">
          <Outlet />
        </div>
      </div>
    </>
  );
}
