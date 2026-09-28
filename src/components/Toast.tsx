import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'info' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#FDFBF7]/95 backdrop-blur-md border border-[#E5E1D8] shadow-2xl text-xs font-semibold text-[#4E3B31] animate-in fade-in slide-in-from-bottom-5 duration-300">
      {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#8A9A5B] shrink-0" />}
      {isError && <AlertCircle className="w-4 h-4 text-[#E2725B] shrink-0" />}
      {!isSuccess && !isError && <Info className="w-4 h-4 text-[#8A9A5B] shrink-0" />}
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 p-1 rounded-lg text-[#8C8273] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
