import React from 'react';
import './logo.css';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({ size = 'medium', showText = true }: LogoProps) {
  const textSizeClass = {
    small: 'text-xl',
    medium: 'text-2xl',
    large: 'text-4xl'
  }[size];

  if (!showText) return null;

  return (
    <div className="flex items-center">
      <h1 className={`font-bold ${textSizeClass} logo-text`}>
        Chatsenger
      </h1>
    </div>
  );
}
