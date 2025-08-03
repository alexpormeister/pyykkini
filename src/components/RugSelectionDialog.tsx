import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface RugSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dimensions: { length: number; width: number }) => void;
  rugName: string;
}

export const RugSelectionDialog = ({
  open,
  onOpenChange,
  onConfirm,
  rugName
}: RugSelectionDialogProps) => {
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");

  const predefinedSizes = [
    { name: "Pieni (60x90 cm)", length: 60, width: 90, price: 29.90 },
    { name: "Keskikokoinen (80x150 cm)", length: 80, width: 150, price: 39.90 },
    { name: "Suuri (120x180 cm)", length: 120, width: 180, price: 49.90 },
    { name: "Isämmat (160x230 cm)", length: 160, width: 230, price: 59.90 }
  ];

  const calculatePrice = (l: number, w: number) => {
    const area = (l * w) / 10000; // Convert to m²
    if (area <= 0.54) return 29.90; // Up to 0.54 m²
    if (area <= 1.2) return 39.90;  // Up to 1.2 m²
    if (area <= 2.16) return 49.90; // Up to 2.16 m²
    return 59.90; // Larger sizes
  };

  const handlePredefinedSize = (size: typeof predefinedSizes[0]) => {
    onConfirm({ 
      length: size.length, 
      width: size.width 
    });
    onOpenChange(false);
  };

  const handleCustomSize = () => {
    const l = parseFloat(length);
    const w = parseFloat(width);
    
    if (isNaN(l) || isNaN(w) || l <= 0 || w <= 0) {
      return;
    }

    if (l > 200 || w > 300) {
      alert("Maksimi mitat: 200cm x 300cm");
      return;
    }

    onConfirm({ length: l, width: w });
    onOpenChange(false);
  };

  const customLength = parseFloat(length);
  const customWidth = parseFloat(width);
  const customPrice = (!isNaN(customLength) && !isNaN(customWidth)) ? 
    calculatePrice(customLength, customWidth) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🧼 {rugName}
          </DialogTitle>
          <DialogDescription>
            Valitse maton koko tai syötä omat mitat. Hinta määräytyy maton koon mukaan.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Predefined Sizes */}
          <div>
            <h4 className="font-semibold mb-3">🎯 Yleiset koot</h4>
            <div className="grid grid-cols-1 gap-2">
              {predefinedSizes.map((size, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handlePredefinedSize(size)}
                  className="justify-between p-4 h-auto hover:bg-primary/5 transition-colors"
                >
                  <div className="text-left">
                    <div className="font-medium">{size.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {(size.length * size.width / 10000).toFixed(2)} m²
                    </div>
                  </div>
                  <Badge variant="secondary">{size.price.toFixed(2)}€</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Size */}
          <div>
            <h4 className="font-semibold mb-3">📏 Omat mitat</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="length">Pituus (cm)</Label>
                <Input
                  id="length"
                  type="number"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="esim. 120"
                  min="1"
                  max="300"
                />
              </div>
              <div>
                <Label htmlFor="width">Leveys (cm)</Label>
                <Input
                  id="width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="esim. 180"
                  min="1"
                  max="200"
                />
              </div>
            </div>
            
            {customPrice > 0 && (
              <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm">
                    Koko: {customLength}cm x {customWidth}cm ({(customLength * customWidth / 10000).toFixed(2)} m²)
                  </span>
                  <Badge>{customPrice.toFixed(2)}€</Badge>
                </div>
              </div>
            )}
            
            <Button 
              onClick={handleCustomSize}
              disabled={!length || !width || customLength <= 0 || customWidth <= 0}
              className="w-full mt-3"
              variant="hero"
            >
              ✨ Vahvista koko
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            ℹ️ Hinta määräytyy maton pinta-alan mukaan. Maksimi mitat: 200cm x 300cm
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};