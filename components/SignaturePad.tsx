import React, { useRef, useState, useEffect } from 'react';
import { XIcon, CheckIcon } from './ui/Icons';

interface SignaturePadProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  title: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ isOpen, onClose, onSave, title }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Resize canvas to full screen on mount
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      // Set resolution
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Basic styling
      if (ctx) {
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
      }
    }
  }, [isOpen]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    setHasSignature(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { clientX, clientY } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(clientX, clientY);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { clientX, clientY } = getCoordinates(e);
    ctx.lineTo(clientX, clientY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath(); // Reset path to avoid connecting lines
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      return {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
      };
    }
    return {
      clientX: (e as React.MouseEvent).clientX,
      clientY: (e as React.MouseEvent).clientY,
    };
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasSignature(false);
        }
    }
  };

  const handleSave = () => {
    if (canvasRef.current && hasSignature) {
      onSave(canvasRef.current.toDataURL('image/png'));
    }
    // If saving empty, user might just want to close, but let's enforce signature for "Save"
    // To close without saving, use the Cancel button
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white touch-none animate-fade-in flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
        {/* Cancel Button (Left) */}
        <button 
           onClick={onClose}
           className="px-4 py-2 bg-gray-100 rounded-full text-gray-600 font-bold shadow-sm"
        >
           Cancel
        </button>

        {/* Clear Button (Right - X Icon as requested) */}
        <button 
            onClick={handleClear}
            className="p-3 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors shadow-sm"
            aria-label="Clear Signature"
          >
            <XIcon className="w-8 h-8" />
        </button>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 relative cursor-crosshair bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="block w-full h-full"
        />
        {!hasSignature && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 select-none">
             <div className="text-center">
                 <p className="text-4xl font-bold text-gray-400 mb-2">Sign Here</p>
                 <p className="text-xl text-gray-300">Draw above</p>
             </div>
           </div>
        )}
      </div>

      {/* Footer / Save Button */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center pb-safe">
         <button 
            onClick={handleSave}
            disabled={!hasSignature}
            className={`flex items-center gap-2 px-8 py-3 rounded-full text-lg font-bold shadow-lg transform transition-all active:scale-95 ${
                hasSignature 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <CheckIcon className="w-6 h-6" />
            <span>Complete Signature</span>
         </button>
      </div>
    </div>
  );
};

export default SignaturePad;