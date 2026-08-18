import React, { useEffect } from 'react';
import { X, Download, ZoomIn } from 'lucide-react';

interface ImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ imageUrl, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (imageUrl) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      {/* Top Action Bar */}
      <div
        className="absolute top-4 right-4 z-10 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={imageUrl}
          download="chat-image.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-[#1C1C1E] text-[#F2F2F2] hover:bg-[#262629] border border-[#262629] flex items-center justify-center transition shadow-lg"
          title="Download Image"
          aria-label="Download image"
        >
          <Download className="w-5 h-5" />
        </a>

        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-[#1C1C1E] text-[#F2F2F2] hover:bg-[#262629] border border-[#262629] flex items-center justify-center transition shadow-lg"
          title="Close Lightbox"
          aria-label="Close image preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image */}
      <div
        className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt="Full preview"
          className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
        />
      </div>
    </div>
  );
};
