'use client';
import { ChevronDown, Search } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export const SearchableDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  icon: Icon,
  disabled = false
}: { 
  options: { id: number; title: string }[], 
  value: number | string, 
  onChange: (id: number, title: string) => void, 
  placeholder: string,
  icon: any,
  disabled?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(option => 
    option.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // پیدا کردن عنوان نمایشی بر اساس آی‌دی انتخاب شده فعلی
  const selectedDisplay = options.find(o => o.id === Number(value))?.title || '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        className={`w-full p-4 pr-12 bg-[#faf9f6] rounded-2xl flex items-center justify-between cursor-pointer border-none focus-within:ring-2 focus-within:ring-[#c5a059] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <Icon className="absolute right-4 top-4 text-gray-400" size={18} />
        <span className={`text-sm font-bold ${value ? 'text-[#1a2e44]' : 'text-gray-400'}`}>
          {selectedDisplay || placeholder}
        </span>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-50 flex items-center bg-gray-50">
            <Search size={14} className="text-gray-400 mr-2 ml-2" />
            <input 
              type="text" 
              className="w-full bg-transparent border-none text-sm outline-none placeholder-gray-400 text-[#1a2e44] font-bold"
              placeholder="جستجو..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto no-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div 
                  key={option.id}
                  className={`p-3 text-sm font-bold cursor-pointer hover:bg-gray-50 transition-colors ${Number(value) === option.id ? 'bg-blue-50 text-blue-600' : 'text-[#1a2e44]'}`}
                  onClick={() => {
                    onChange(option.id, option.title);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  {option.title}
                </div>
              ))
            ) : (
              <div className="p-3 text-sm text-gray-400 text-center font-bold">موردی یافت نشد</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};