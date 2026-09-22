import { useState, useRef } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeToConfirmProps {
  onConfirm: () => void;
  text?: string;
  confirmText?: string;
  disabled?: boolean;
  className?: string;
}

export const SwipeToConfirm = ({ 
  onConfirm, 
  text = "Swipe to confirm", 
  confirmText = "Confirmed!",
  disabled = false,
  className
}: SwipeToConfirmProps) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const threshold = 0.8; // Percentage of container width needed to confirm

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!containerRef.current || disabled || isConfirmed) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const dragPosition = Math.max(0, Math.min(info.point.x, containerWidth));
    const progress = dragPosition / containerWidth;
    
    if (progress >= threshold) {
      setIsConfirmed(true);
      setIsDragging(false);
      setTimeout(() => {
        onConfirm();
      }, 300);
    }
  };

  const handleDragStart = () => {
    if (!disabled && !isConfirmed) {
      setIsDragging(true);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  if (isConfirmed) {
    return (
      <div className={cn(
        "relative h-16 bg-green-500 rounded-xl overflow-hidden flex items-center justify-center",
        className
      )}>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2 text-white font-semibold"
        >
          <Check className="h-5 w-5" />
          {confirmText}
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative h-16 bg-gradient-to-r from-primary to-primary-glow rounded-xl overflow-hidden touch-none select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Background text */}
      <div className="absolute inset-0 flex items-center justify-center text-white font-semibold pointer-events-none">
        {text}
      </div>
      
      {/* Progress background */}
      <motion.div
        className="absolute inset-y-0 left-0 bg-white/20 rounded-xl"
        animate={{
          width: isDragging ? "100%" : "0%"
        }}
        transition={{ duration: 0.2 }}
      />
      
      {/* Draggable button */}
      <motion.div
        className={cn(
          "absolute left-2 top-2 bottom-2 w-12 bg-white rounded-lg shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing",
          disabled && "cursor-not-allowed"
        )}
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDrag={handleDrag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        whileDrag={{ scale: 1.05 }}
        animate={{
          x: isConfirmed ? "100%" : 0
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30
        }}
      >
        <ChevronRight className={cn(
          "h-6 w-6 text-primary transition-colors",
          isDragging && "text-primary-glow"
        )} />
      </motion.div>
    </div>
  );
};