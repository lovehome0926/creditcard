
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
  >
    {children}
  </div>
);

interface ButtonProps {
  // Fix: Made children optional to support icon-only buttons as used in AccountManager
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  className?: string;
  icon?: React.ElementType;
  disabled?: boolean;
  // Fix: Add type property to support form submission and intrinsic button attributes
  type?: "button" | "submit" | "reset";
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = "primary", 
  className = "", 
  icon: Icon,
  disabled = false,
  // Fix: Default to "button" to prevent accidental form submissions when type is not specified
  type = "button"
}) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-sm"
  };
  return (
    <button 
      type={type} 
      onClick={onClick} 
      className={`${baseStyle} ${variants[variant]} ${className}`} 
      disabled={disabled}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};
