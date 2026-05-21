import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: any) => void;
  options: DropdownOption[];
  width?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({ 
  value, 
  onChange, 
  options, 
  width = '170px' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keep focused index synced with current selection upon open
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(options.findIndex(o => o.value === value));
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, value, options]);

  // Accessible Keyboard Navigator
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          onChange(options[focusedIndex].value);
          setIsOpen(false);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setFocusedIndex(prev => (prev + 1) % options.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setFocusedIndex(prev => (prev - 1 + options.length) % options.length);
      }
    }
  };

  const activeOption = options.find(o => o.value === value) || options[0];

  return (
    <div ref={dropdownRef} style={{ position: 'relative', zIndex: 100, width }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          height: '40px',
          padding: '0 1.25rem',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          color: 'var(--text-main)',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 1)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)'}
        onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(0,0,0,0.05)'}
        onBlur={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)'}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activeOption?.label || ''}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', opacity: 0.8, flexShrink: 0 }}
        >
          <ChevronDown size={15} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              width: '100%',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(16px)',
              borderRadius: '12px',
              boxShadow: '0 12px 28px -6px rgba(0,0,0,0.12), 0 8px 16px -8px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              padding: '5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              border: '1px solid rgba(0,0,0,0.03)',
              boxSizing: 'border-box'
            }}
          >
            {options.map((opt, idx) => {
              const isSelected = value === opt.value;
              const isFocused = focusedIndex === idx;
              
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  style={{
                    border: 'none',
                    background: isSelected 
                      ? 'rgba(99, 102, 241, 0.08)' 
                      : (isFocused ? 'rgba(15, 23, 42, 0.04)' : 'transparent'),
                    color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? 700 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={() => setFocusedIndex(idx)}
                >
                  {opt.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
