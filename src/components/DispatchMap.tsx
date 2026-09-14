import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Truck,
  Package,
  Clock,
  Phone,
  User,
  Maximize2
} from "lucide-react";

export interface MapTaskItem {
  id: string;
  order_id: string;
  task_type: "pickup" | "delivery";
  status: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  scheduledTime: string;
  driverName: string;
  driverId: string | null;
  laundryName: string;
  price: number;
}

export interface MapLaundryItem {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  contact_phone?: string | null;
}

interface DispatchMapProps {
  tasks: MapTaskItem[];
  laundries: MapLaundryItem[];
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string) => void;
  onAssignDriver?: (taskId: string) => void;
}

const CITY_COORDINATES: Record<string, [number, number]> = {
  helsinki: [60.1699, 24.9384],
  espoo: [60.2055, 24.6559],
  vantaa: [60.2934, 25.0378],
  kauniainen: [60.2098, 24.7269],
  kirkkonummi: [60.1238, 24.4385],
  kerava: [60.4034, 25.105],
  jarvenpaa: [60.4722, 25.0889],
  sipoo: [60.3775, 25.2694],
  tuusula: [60.4028, 25.0292],
  nurmijarvi: [60.4619, 24.8078],
  lohja: [60.25, 24.0667],
  turku: [60.4518, 22.2666],
  tampere: [61.4978, 23.761],
};

function getDeterministicCoordinates(address: string, fallbackCity = "helsinki"): [number, number] {
  const cleanAddr = (address || "").toLowerCase();
  
  let baseCoords: [number, number] = CITY_COORDINATES.helsinki;
  for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
    if (cleanAddr.includes(cityName)) {
      baseCoords = coords;
      break;
    }
  }

  if (baseCoords === CITY_COORDINATES.helsinki && fallbackCity) {
    const f = fallbackCity.toLowerCase();
    for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
      if (f.includes(cityName)) {
        baseCoords = coords;
        break;
      }
    }
  }

  let hash = 0;
  for (let i = 0; i < cleanAddr.length; i++) {
    hash = (hash << 5) - hash + cleanAddr.charCodeAt(i);
    hash |= 0;
  }

  const latOffset = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.06;
  const lngOffset = ((Math.abs(hash * 31) % 1000) / 1000 - 0.5) * 0.09;

  return [baseCoords[0] + latOffset, baseCoords[1] + lngOffset];
}

export const DispatchMap: React.FC<DispatchMapProps> = ({
  tasks,
  laundries,
  selectedTaskId,
  onSelectTask,
  onAssignDriver,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [mapFilter, setMapFilter] = useState<"all" | "pickup" | "delivery">("all");
  const [selectedTask, setSelectedTask] = useState<MapTaskItem | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [60.19, 24.85],
      zoom: 11,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };
    window.addEventListener("resize", handleResize);
    const timer = setTimeout(handleResize, 300);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const bounds: [number, number][] = [];

    // Laundries
    laundries.forEach((l) => {
      const coords = getDeterministicCoordinates(l.address || l.name, l.city || "Espoo");
      bounds.push(coords);

      const laundryIconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-full bg-emerald-600 text-white shadow-md border-2 border-white flex items-center justify-center font-bold text-xs">
            🏢
          </div>
          <div class="absolute -bottom-4 bg-emerald-950 text-[10px] text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap font-medium pointer-events-none">
            ${l.name}
          </div>
        </div>
      `;

      const laundryIcon = L.divIcon({
        html: laundryIconHtml,
        className: "custom-leaflet-pin",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(coords, { icon: laundryIcon });
      marker.bindPopup(`
        <div class="p-2 space-y-1 min-w-[180px]">
          <div class="font-bold text-xs text-emerald-800">🏢 Kumppanipesula</div>
          <div class="font-semibold text-sm">${l.name}</div>
          <div class="text-xs text-gray-600">${l.address || "Espoo"}</div>
          ${l.contact_phone ? `<div class="text-xs text-gray-500">Puh: ${l.contact_phone}</div>` : ""}
        </div>
      `);
      markersLayer.addLayer(marker);
    });

    // Tasks
    const displayedTasks = tasks.filter((t) => {
      if (mapFilter === "all") return true;
      return t.task_type === mapFilter;
    });

    displayedTasks.forEach((t) => {
      const isPickup = t.task_type === "pickup";
      const isAssigned = !!t.driverId;
      const isSelected = selectedTaskId === t.id;
      const coords = getDeterministicCoordinates(t.address, t.city);
      bounds.push(coords);

      const bgColor = isPickup
        ? isAssigned ? "bg-blue-600" : "bg-amber-500"
        : isAssigned ? "bg-purple-600" : "bg-rose-500";

      const borderRing = isSelected ? "ring-4 ring-primary scale-110" : "border-2 border-white";

      const pinHtml = `
        <div class="relative flex items-center justify-center transition-transform cursor-pointer ${borderRing}">
          <div class="w-7 h-7 rounded-full ${bgColor} text-white shadow-lg flex items-center justify-center font-bold text-[11px]">
            ${isPickup ? "N" : "P"}
          </div>
          <div class="absolute -bottom-4 bg-slate-900/90 text-[10px] text-white px-1.5 py-0.2 rounded shadow whitespace-nowrap font-medium pointer-events-none">
            ${t.scheduledTime || (isPickup ? "Nouto" : "Palautus")}
          </div>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: pinHtml,
        className: "custom-task-pin",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(coords, { icon: pinIcon });

      marker.on("click", () => {
        setSelectedTask(t);
        if (onSelectTask) onSelectTask(t.id);
      });

      markersLayer.addLayer(marker);
    });

    if (bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      } catch (err) {
        console.error("Map fitBounds error:", err);
      }
    }
  }, [tasks, laundries, mapFilter, selectedTaskId]);

  const handleCenterCity = (cityKey: string) => {
    const coords = CITY_COORDINATES[cityKey];
    if (coords && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(coords, 12, { duration: 1 });
    }
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current || tasks.length === 0) return;
    const coordsList = tasks.map((t) => getDeterministicCoordinates(t.address, t.city));
    if (coordsList.length > 0) {
      mapInstanceRef.current.fitBounds(coordsList, { padding: [40, 40], maxZoom: 13 });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-xl overflow-hidden border bg-muted/20 flex flex-col">
      {/* KARTAN YLÄPALKKI */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
        <div className="flex items-center gap-1 bg-background/95 backdrop-blur-sm p-1 rounded-lg border shadow-sm pointer-events-auto">
          <Button
            variant={mapFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMapFilter("all")}
            className="h-6 text-[11px] px-2"
          >
            Kaikki ({tasks.length})
          </Button>
          <Button
            variant={mapFilter === "pickup" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMapFilter("pickup")}
            className="h-6 text-[11px] px-2 text-blue-700 dark:text-blue-400"
          >
            <Package className="h-3 w-3 mr-1" />
            Noudot ({tasks.filter((t) => t.task_type === "pickup").length})
          </Button>
          <Button
            variant={mapFilter === "delivery" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMapFilter("delivery")}
            className="h-6 text-[11px] px-2 text-purple-700 dark:text-purple-400"
          >
            <Truck className="h-3 w-3 mr-1" />
            Palautukset ({tasks.filter((t) => t.task_type === "delivery").length})
          </Button>
        </div>

        <div className="hidden sm:flex items-center gap-1 bg-background/95 backdrop-blur-sm p-1 rounded-lg border shadow-sm pointer-events-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitAll}
            className="h-6 text-[11px] px-1.5"
            title="Sovita kaikki kohteet"
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            Sovita
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCenterCity("helsinki")}
            className="h-6 text-[11px] px-1.5"
          >
            Helsinki
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCenterCity("espoo")}
            className="h-6 text-[11px] px-1.5"
          >
            Espoo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCenterCity("vantaa")}
            className="h-6 text-[11px] px-1.5"
          >
            Vantaa
          </Button>
        </div>
      </div>

      <div ref={mapContainerRef} className="w-full flex-1 min-h-[360px] z-0" />

      {selectedTask && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[1000] bg-background/95 backdrop-blur-md p-3 rounded-xl border shadow-lg animate-fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white ${
                  selectedTask.task_type === "pickup" ? "bg-blue-600" : "bg-purple-600"
                }`}>
                  {selectedTask.task_type === "pickup" ? "Nouto" : "Palautus"}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {selectedTask.customerName}
                </span>
                {selectedTask.phone && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {selectedTask.phone}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedTask.address}</span>
              </p>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  klo {selectedTask.scheduledTime}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {selectedTask.driverName || "Ei kuskia (Jaossa)"}
                </span>
                <span className="font-semibold text-foreground">
                  {selectedTask.price.toFixed(2)} €
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onAssignDriver && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAssignDriver(selectedTask.id)}
                  className="h-7 text-xs"
                >
                  {selectedTask.driverId ? "Vaihda kuski" : "Määritä kuski"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedTask(null)}
                className="h-7 text-xs px-2 text-muted-foreground"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
