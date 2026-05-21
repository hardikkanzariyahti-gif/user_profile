import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Image as ImageIcon, Album, Users, UserCircle } from 'lucide-react';

const navItems = [
  { path: '/gallery', label: 'Gallery', icon: ImageIcon },
  { path: '/albums', label: 'Albums', icon: Album },
  { path: '/people', label: 'People', icon: Users },
  { path: '/', label: 'Profiles', icon: UserCircle, exact: true },
];

const navLinkBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  height: '36px',
  padding: '0 0.75rem',
  borderRadius: '10px',
  textDecoration: 'none',
  fontSize: '0.8rem',
  fontWeight: 500,
  color: '#64748b',
  background: 'transparent',
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
  position: 'relative',
  borderRight: '3px solid transparent',
};

const activeStyle: React.CSSProperties = {
  background: '#f1f4f9',
  color: '#0f172a',
  fontWeight: 600,
  borderRight: '3px solid #3b82f6',
  borderRadius: '0 10px 10px 0',
};

const Sidebar: React.FC = () => {
  const location = useLocation();

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return location.pathname === item.path;
    if (item.path === '/albums') return location.pathname.startsWith('/albums');
    return location.pathname.startsWith(item.path);
  };

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '200px',
        height: '100vh',
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      {/* Logo area */}
      <div
        style={{
          padding: '1.25rem 1rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3B5998 0%, #6A7FBC 50%, #9B96D4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '0.85rem',
            flexShrink: 0,
          }}
        >
          P
        </div>
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 800,
            color: '#1e293b',
            letterSpacing: '-0.3px',
          }}
        >
          ProProfile
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...navLinkBase,
                ...(active ? activeStyle : {}),
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = '#f1f4f9';
                  e.currentTarget.style.color = '#0f172a';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>


    </aside>
  );
};

export default Sidebar;
