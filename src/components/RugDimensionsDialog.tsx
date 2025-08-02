import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ruler } from 'lucide-react';

interface RugDimensionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dimensions: { length: number; width: number }) => void;
  rugName: string;
}

export const RugDimensionsDialog = ({ open, onOpenChange, onConfirm, rugName }: RugDimensionsDialogProps) => {
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');

  const handleConfirm = () => {
    const lengthNum = parseFloat(length);
    const widthNum = parseFloat(width);
    
    if (lengthNum > 0 && widthNum > 0) {
      onConfirm({ length: lengthNum, width: widthNum });
      onOpenChange(false);
      setLength('');
      setWidth('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Maton mitat
          </DialogTitle>
          <DialogDescription>
            Anna maton "{rugName}" mitat jatkaaksesi tilausta
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="length">Pituus (cm)</Label>
              <Input
                id="length"
                type="number"
                min="1"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="200"
              />
            </div>
            <div>
              <Label htmlFor="width">Leveys (cm)</Label>
              <Input
                id="width"
                type="number"
                min="1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="150"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Peruuta
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!length || !width || parseFloat(length) <= 0 || parseFloat(width) <= 0}
            >
              Vahvista mitat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};