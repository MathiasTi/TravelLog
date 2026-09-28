import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemName?: string;
  description?: string;
  confirmText?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Eintrag löschen?',
  itemName,
  description = 'Möchtest du diesen Eintrag wirklich unwiderruflich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
  confirmText = 'Unwiderruflich löschen',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#4E3B31]/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-md bg-[#FDFBF7] border border-[#E5E1D8] rounded-3xl shadow-2xl overflow-hidden p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-xl text-[#8C8273] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-md">
          <Trash2 className="w-7 h-7" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-[#4E3B31] font-serif mb-1.5">{title}</h3>

        {itemName && (
          <div className="inline-block max-w-[90%] px-3 py-1 mb-3 rounded-xl bg-[#F1EDE6] text-xs font-semibold text-[#4E3B31] truncate border border-[#E5E1D8]">
            „{itemName}“
          </div>
        )}

        <p className="text-xs text-[#6B5E55] mb-6 leading-relaxed px-2">
          {description}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#E5E1D8] bg-white hover:bg-[#F1EDE6] text-[#4E3B31] text-xs font-bold transition"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 transition flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
