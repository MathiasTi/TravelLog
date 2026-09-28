import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  X,
  Copy,
  Check,
  Image as ImageIcon,
  Share2,
  Sparkles,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { Trip } from '../../types';

interface MobileSyncQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip?: Trip | null;
}

export const MobileSyncQrModal: React.FC<MobileSyncQrModalProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build the mobile URL
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://wanderlog.app';
  const mobileUrl = trip ? `${currentUrl.split('#')[0]}?trip=${trip.id}` : currentUrl;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4E3B31]/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#FDFBF7] border border-[#E5E1D8] rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D8] bg-[#F1EDE6]/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8A9A5B]/15 border border-[#8A9A5B]/30 text-[#8A9A5B]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#4E3B31] font-serif">
                Fotos vom Smartphone hochladen
              </h3>
              <p className="text-xs text-[#6B5E55]">Direkt mit iPhone & Android verbinden</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-center">
          {/* QR Code Container */}
          <div className="inline-block p-4 bg-white rounded-3xl border-2 border-[#E5E1D8] shadow-md">
            <QRCodeSVG
              value={mobileUrl}
              size={190}
              level="M"
              fgColor="#4E3B31"
              bgColor="#FFFFFF"
              imageSettings={{
                src: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=80&q=80',
                x: undefined,
                y: undefined,
                height: 36,
                width: 36,
                excavate: true,
              }}
            />
          </div>

          {/* Quick Steps */}
          <div className="bg-[#F1EDE6]/60 p-4 rounded-2xl border border-[#E5E1D8] text-left space-y-2.5">
            <div className="text-xs font-bold text-[#4E3B31] flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-[#8A9A5B]" />
              <span>So einfach geht's vom Smartphone:</span>
            </div>
            <ol className="text-xs text-[#6B5E55] space-y-1.5 list-decimal list-inside">
              <li>
                Scanne den QR-Code mit deinem iPhone oder Android-Handy.
              </li>
              <li>
                Öffne die Reise und tippe auf <strong>"Eintrag verfassen"</strong>.
              </li>
              <li>
                Wähle deine Urlaubsfotos direkt aus deiner <strong>Foto-Mediathek</strong> aus.
              </li>
            </ol>
          </div>

          {/* Features Pill */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-[#4E3B31] text-left">
            <div className="p-2.5 bg-white rounded-xl border border-[#E5E1D8] flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#E2725B] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Auto-GPS Erkennung</span>
                <span className="text-[#8C8273] text-[10px]">Standort direkt aus Bild-EXIF</span>
              </div>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-[#E5E1D8] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#8A9A5B] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Keine App nötig</span>
                <span className="text-[#8C8273] text-[10px]">Läuft direkt im mobilen Browser</span>
              </div>
            </div>
          </div>

          {/* Copy Link Row */}
          <div className="pt-1 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={mobileUrl}
              className="flex-1 px-3 py-2 text-xs bg-white rounded-xl border border-[#E5E1D8] text-[#6B5E55] focus:outline-none truncate select-all font-mono"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-2 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
