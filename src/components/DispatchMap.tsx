import React, { useEffect, useRef, useState, useCallback } from "react";
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
  Maximize2,
  Minimize2,
  Building2,
  Crosshair,
  Layers,
  Sparkles,
  CheckCircle2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress, getCityCenterCoordinates, CITY_COORDINATES } from "@/lib/addressUtils";
import { cn } from "@/lib/utils";

const WORLD_OUTER_BOUNDS: [number, number][] = [
  [58.5, 20.0],
  [58.5, 29.0],
  [63.0, 29.0],
  [63.0, 20.0],
];

// Saumaton yhtenäinen Pääkaupunkiseutu (Espoo + Helsinki + Vantaa + Kauniainen)
const PK_SEUTU_UNIFIED_POLYGON: [number, number][] = [
  [60.125, 24.530], // Soukka / Kivenlahti SW
  [60.155, 24.490], // Kivenlahti / Saunalahti W
  [60.210, 24.470], // Kauklahti / Espoonkartano W
  [60.270, 24.490], // Nuuksio S
  [60.335, 24.530], // Bodom / Nuuksio N
  [60.355, 24.640], // Vantaankoski / Luukukki NW
  [60.370, 24.750], // Kivistö / Klaukkalan raja N
  [60.400, 24.880], // Seutula / Lentoasema N
  [60.395, 25.040], // Korson pohjoinen N
  [60.365, 25.170], // Hakunila / Sipooseen NE
  [60.285, 25.260], // Landbo / Östersundom NE
  [60.220, 25.220], // Vuosaaren satama SE
  [60.170, 25.120], // Santahamina / Laajasalo S
  [60.138, 24.980], // Harakka / Kaivopuisto S
  [60.132, 24.880], // Lauttasaari S
  [60.145, 24.800], // Westend S
  [60.140, 24.700], // Haukilahti / Matinkylä S
  [60.125, 24.600], // Espoonlahti S
];

const CITY_SERVICE_POLYGONS: Record<string, [number, number][]> = {
  helsinki: [
    [60.135, 24.830],
    [60.210, 24.840],
    [60.260, 24.840],
    [60.280, 24.950],
    [60.290, 25.080],
    [60.285, 25.260],
    [60.220, 25.220],
    [60.170, 25.120],
    [60.138, 24.980],
    [60.132, 24.880]
  ],
  espoo: [
    [60.125, 24.530],
    [60.155, 24.490],
    [60.210, 24.470],
    [60.270, 24.490],
    [60.335, 24.530],
    [60.350, 24.680],
    [60.320, 24.780],
    [60.260, 24.840],
    [60.210, 24.840],
    [60.150, 24.820],
    [60.140, 24.700],
    [60.125, 24.600]
  ],
  vantaa: [
    [60.250, 24.780],
    [60.320, 24.780],
    [60.355, 24.640],
    [60.370, 24.750],
    [60.400, 24.880],
    [60.395, 25.040],
    [60.365, 25.170],
    [60.280, 25.120],
    [60.260, 24.950]
  ],
  kauniainen: [
    [60.200, 24.690],
    [60.225, 24.690],
    [60.225, 24.745],
    [60.200, 24.745]
  ],
  kirkkonummi: [
    [60.000, 24.220],
    [60.080, 24.180],
    [60.180, 24.250],
    [60.230, 24.450],
    [60.170, 24.510],
    [60.120, 24.500],
    [60.000, 24.450]
  ],
  kerava: [
    [60.370, 25.070],
    [60.420, 25.070],
    [60.430, 25.140],
    [60.380, 25.150]
  ],
  jarvenpaa: [
    [60.440, 25.050],
    [60.500, 25.040],
    [60.510, 25.130],
    [60.450, 25.140]
  ],
  tuusula: [
    [60.350, 24.900],
    [60.430, 24.900],
    [60.520, 24.950],
    [60.520, 25.080],
    [60.380, 25.080]
  ],
  sipoo: [
    [60.280, 25.160],
    [60.380, 25.160],
    [60.500, 25.250],
    [60.450, 25.480],
    [60.280, 25.400]
  ],
  nurmijarvi: [
    [60.400, 24.650],
    [60.550, 24.650],
    [60.600, 24.900],
    [60.420, 24.900]
  ],
  lohja: [
    [60.180, 23.900],
    [60.300, 23.900],
    [60.350, 24.200],
    [60.200, 24.200]
  ],
  vihti: [
    [60.300, 24.150],
    [60.480, 24.150],
    [60.500, 24.450],
    [60.330, 24.450]
  ]
};

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
  latitude?: number | null;
  longitude?: number | null;
}

export interface MapLaundryItem {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  contact_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface DispatchMapProps {
  tasks: MapTaskItem[];
  laundries: MapLaundryItem[];
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string) => void;
  onAssignDriver?: (taskId: string) => void;
  onAssignLaundry?: (taskId: string) => void;
  className?: string;
}

export const DispatchMap: React.FC<DispatchMapProps> = ({
  tasks,
  laundries,
  selectedTaskId,
  onSelectTask,
  onAssignDriver,
  onAssignLaundry,
  className,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [mapFilter, setMapFilter] = useState<"all" | "pickup" | "delivery">("all");
  const [selectedTask, setSelectedTask] = useState<MapTaskItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [coordsMap, setCoordsMap] = useState<Record<string, [number, number]>>({});
  const [isGeocoding, setIsGeocoding] = useState(false);

  // 1. ASYNC GEOCODING: Tarkat oikeat koordinaatit pesuloille ja tilauksille
  useEffect(() => {
    let isMounted = true;

    const resolveCoordinates = async () => {
      setIsGeocoding(true);
      const updatedCoords: Record<string, [number, number]> = {};

      // 1. Geokoodaa pesulat
      for (const l of laundries) {
        const key = `laundry_${l.id}`;
        if (coordsMap[key]) {
          updatedCoords[key] = coordsMap[key];
          continue;
        }

        if (l.latitude && l.longitude) {
          updatedCoords[key] = [l.latitude, l.longitude];
        } else if (l.address) {
          const res = await geocodeAddress(l.address, l.city || "Espoo");
          updatedCoords[key] = [res.lat, res.lng];
        } else {
          const res = getCityCenterCoordinates(l.city || "Espoo");
          updatedCoords[key] = [res.lat, res.lng];
        }
      }

      // 2. Geokoodaa tilaukset/keikat
      for (const t of tasks) {
        const key = `task_${t.id}`;
        if (coordsMap[key]) {
          updatedCoords[key] = coordsMap[key];
          continue;
        }

        if (t.latitude && t.longitude) {
          updatedCoords[key] = [t.latitude, t.longitude];
        } else if (t.address) {
          const res = await geocodeAddress(t.address, t.city || "Helsinki");
          updatedCoords[key] = [res.lat, res.lng];
        } else {
          const res = getCityCenterCoordinates(t.city || "Helsinki");
          updatedCoords[key] = [res.lat, res.lng];
        }
      }

      if (isMounted) {
        setCoordsMap((prev) => ({ ...prev, ...updatedCoords }));
        setIsGeocoding(false);
      }
    };

    resolveCoordinates();

    return () => {
      isMounted = false;
    };
  }, [tasks, laundries]);

  const maskLayerRef = useRef<L.Polygon | null>(null);

  // 2. ALUSTA LEAFLET KARTTA JA PALVELUALUEPEITTO
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Espoon ja Helsingin välinen oletuskeskipiste
    const map = L.map(mapContainerRef.current, {
      center: [60.2055, 24.6559], // Espoon keskus
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

    // Haetaan aktiiviset palvelualueet ja piirretään punainen puoliläpinäkyvä peitto alueille, joissa ei toimita
    const drawServiceMask = async () => {
      try {
        const { data } = await supabase
          .from("service_areas")
          .select("city, is_active")
          .eq("is_active", true);

        const activeCities = new Set<string>();
        if (data && data.length > 0) {
          data.forEach((sa) => {
            if (sa.city) activeCities.add(sa.city.toLowerCase().trim());
          });
        } else {
          activeCities.add("helsinki");
          activeCities.add("espoo");
          activeCities.add("vantaa");
          activeCities.add("kauniainen");
          activeCities.add("kirkkonummi");
        }

        const hasCapitalRegion =
          activeCities.has("helsinki") ||
          activeCities.has("espoo") ||
          activeCities.has("vantaa") ||
          activeCities.has("kauniainen");

        const holes: [number, number][][] = [];

        if (hasCapitalRegion) {
          // Yhtenäinen saumaton Pääkaupunkiseudun rajus – ei sisäisiä laatikkoviivoja eikä leikkauksia!
          holes.push(PK_SEUTU_UNIFIED_POLYGON);
        }

        activeCities.forEach((cityName) => {
          const norm = cityName.replace(/ä/g, "a").replace(/ö/g, "o");
          if (hasCapitalRegion && ["helsinki", "espoo", "vantaa", "kauniainen"].includes(norm)) {
            return;
          }
          if (CITY_SERVICE_POLYGONS[norm]) {
            holes.push(CITY_SERVICE_POLYGONS[norm]);
          }
        });

        if (maskLayerRef.current) {
          map.removeLayer(maskLayerRef.current);
        }

        const maskPolygon = L.polygon([WORLD_OUTER_BOUNDS, ...holes], {
          color: "#dc2626",
          weight: 1.5,
          dashArray: "4, 4",
          fillColor: "#ef4444",
          fillOpacity: 0.18,
          interactive: false,
        });

        maskPolygon.addTo(map);
        maskLayerRef.current = maskPolygon;
      } catch (err) {
        console.error("Error drawing service area mask:", err);
      }
    };

    drawServiceMask();

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 3. IKKUNAN KOON MUUTOSTEN KÄSITTELY
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
  }, [isFullscreen]);

  // 4. PIIRETÄÄN TARKAT MARKERIT KUN KOORDINAATIT TAI VALINNAT MUUTTUVAT
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const bounds: [number, number][] = [];

    // --- PESULAT (VIHREÄT KUMPPANIMARKERIT) ---
    laundries.forEach((l) => {
      const coords = coordsMap[`laundry_${l.id}`] || (l.latitude && l.longitude ? [l.latitude, l.longitude] : null);
      if (!coords) return;

      bounds.push(coords);

      const laundryIconHtml = `
        <div class="relative flex flex-col items-center group cursor-pointer">
          <div class="w-8 h-8 rounded-full bg-emerald-600 text-white shadow-xl border-2 border-white flex items-center justify-center font-bold text-sm transition-transform hover:scale-110">
            🏢
          </div>
          <div class="mt-1 bg-emerald-950/90 text-[10px] text-white px-2 py-0.5 rounded-full shadow-md whitespace-nowrap font-semibold border border-emerald-500/30">
            ${l.name}
          </div>
        </div>
      `;

      const laundryIcon = L.divIcon({
        html: laundryIconHtml,
        className: "custom-leaflet-laundry-pin",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(coords, { icon: laundryIcon, zIndexOffset: 500 });
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; min-width: 190px;">
          <div style="font-weight: bold; color: #059669; font-size: 11px; text-transform: uppercase; margin-bottom: 2px;">
            🏢 Kumppanipesula
          </div>
          <div style="font-weight: bold; font-size: 14px; color: #111827; margin-bottom: 4px;">
            ${l.name}
          </div>
          <div style="color: #4b5563; font-size: 12px; margin-bottom: 2px;">
            📍 ${l.address || l.city || "Espoo"}
          </div>
          ${l.contact_phone ? `<div style="color: #6b7280; font-size: 11px;">📞 ${l.contact_phone}</div>` : ""}
        </div>
      `);
      markersLayer.addLayer(marker);
    });

    // --- TILAUKSET & KEIKAT (NOUDOT JA PALAUTUKSET) ---
    const displayedTasks = tasks.filter((t) => {
      if (mapFilter === "all") return true;
      return t.task_type === mapFilter;
    });

    displayedTasks.forEach((t) => {
      const coords = coordsMap[`task_${t.id}`] || (t.latitude && t.longitude ? [t.latitude, t.longitude] : null);
      if (!coords) return;

      bounds.push(coords);

      const isPickup = t.task_type === "pickup";
      const isAssigned = !!t.driverId;
      const isSelected = selectedTaskId === t.id;

      // Noudot: Sininen / Amber, Palautukset: Purppura / Ruusu
      const bgColor = isPickup
        ? isAssigned ? "bg-blue-600" : "bg-amber-500"
        : isAssigned ? "bg-purple-600" : "bg-rose-500";

      const borderRing = isSelected ? "ring-4 ring-primary scale-125 z-50" : "border-2 border-white hover:scale-110";

      const pinHtml = `
        <div class="relative flex flex-col items-center cursor-pointer transition-transform ${borderRing}">
          <div class="w-7 h-7 rounded-full ${bgColor} text-white shadow-lg flex items-center justify-center font-bold text-[11px]">
            ${isPickup ? "N" : "P"}
          </div>
          <div class="mt-0.5 bg-slate-900/90 text-[10px] text-white px-1.5 py-0.2 rounded shadow whitespace-nowrap font-medium pointer-events-none">
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

      const marker = L.marker(coords, { icon: pinIcon, zIndexOffset: isSelected ? 1000 : 100 });

      marker.on("click", () => {
        setSelectedTask(t);
        if (onSelectTask) onSelectTask(t.id);
        map.flyTo(coords, Math.max(map.getZoom(), 13), { duration: 0.8 });
      });

      markersLayer.addLayer(marker);
    });

    // Jos valittu tietty keikka, lennä siihen
    if (selectedTaskId) {
      const activeCoords = coordsMap[`task_${selectedTaskId}`];
      if (activeCoords) {
        map.flyTo(activeCoords, Math.max(map.getZoom(), 14), { duration: 0.8 });
      }
    }
  }, [tasks, laundries, coordsMap, mapFilter, selectedTaskId]);

  // Päivitä valittu keikka kun selectedTaskId muuttuu ulkoa
  useEffect(() => {
    if (selectedTaskId) {
      const match = tasks.find((t) => t.id === selectedTaskId);
      if (match) setSelectedTask(match);
    }
  }, [selectedTaskId, tasks]);

  // Kartan kohdistusnapit
  const handleCenterCity = (cityKey: string) => {
    const coords = CITY_COORDINATES[cityKey];
    if (coords && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([coords.lat, coords.lng], 12, { duration: 0.8 });
    }
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const allCoords: [number, number][] = Object.values(coordsMap);
    if (allCoords.length > 0) {
      mapInstanceRef.current.fitBounds(allCoords, { padding: [50, 50], maxZoom: 14 });
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 400);
  };

  return (
    <>
      {/* Fullscreen Backdrop if expanded */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-md z-[9998] transition-opacity animate-fade-in"
          onClick={toggleFullscreen}
        />
      )}

      <div
        className={cn(
          "transition-all duration-300 overflow-hidden flex flex-col bg-card border",
          isFullscreen
            ? "fixed inset-3 md:inset-8 z-[9999] rounded-2xl shadow-2xl"
            : cn("relative w-full h-full min-h-[480px] lg:min-h-[560px] rounded-xl shadow-sm", className)
        )}
      >
        {/* KARTAN YLÄPALKKI / TYÖKALUT */}
        <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Suodatus: Kaikki / Noudot / Palautukset */}
          <div className="flex items-center gap-1 bg-background/95 backdrop-blur-md p-1 rounded-xl border shadow-md pointer-events-auto">
            <Button
              variant={mapFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMapFilter("all")}
              className="h-7 text-xs px-2.5 font-semibold"
            >
              Kaikki ({tasks.length})
            </Button>
            <Button
              variant={mapFilter === "pickup" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMapFilter("pickup")}
              className="h-7 text-xs px-2.5 text-blue-600 dark:text-blue-400 font-semibold"
            >
              <Package className="h-3.5 w-3.5 mr-1" />
              Noudot ({tasks.filter((t) => t.task_type === "pickup").length})
            </Button>
            <Button
              variant={mapFilter === "delivery" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMapFilter("delivery")}
              className="h-7 text-xs px-2.5 text-purple-600 dark:text-purple-400 font-semibold"
            >
              <Truck className="h-3.5 w-3.5 mr-1" />
              Palautukset ({tasks.filter((t) => t.task_type === "delivery").length})
            </Button>

            {isGeocoding && (
              <span className="text-[10px] text-muted-foreground px-2 flex items-center gap-1 animate-pulse">
                <Sparkles className="h-3 w-3 text-primary" />
                Päivitetään koordinaatteja...
              </span>
            )}
          </div>

          {/* Oikean puolen pikavalinnat & Koko ruutu */}
          <div className="flex items-center gap-1 bg-background/95 backdrop-blur-md p-1 rounded-xl border shadow-md pointer-events-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFitAll}
              className="h-7 text-xs px-2 text-foreground font-medium"
              title="Sovita kaikki kohteet"
            >
              <Crosshair className="h-3.5 w-3.5 mr-1 text-primary" />
              Sovita
            </Button>
            
            <div className="hidden sm:flex items-center gap-0.5 border-l pl-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCenterCity("espoo")}
                className="h-7 text-xs px-2"
              >
                Espoo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCenterCity("helsinki")}
                className="h-7 text-xs px-2"
              >
                Helsinki
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCenterCity("vantaa")}
                className="h-7 text-xs px-2"
              >
                Vantaa
              </Button>
            </div>

            {/* KOKORUUTUNAPPI (ISOMPI KARTTA) */}
            <Button
              variant={isFullscreen ? "default" : "outline"}
              size="sm"
              onClick={toggleFullscreen}
              className="h-7 text-xs px-2.5 font-semibold ml-0.5"
              title={isFullscreen ? "Pienennä kartta" : "Suurenna kartta koko ruudulle"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 mr-1" />
                  Pienennä
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 mr-1" />
                  Isompi kartta
                </>
              )}
            </Button>
          </div>
        </div>

        {/* KARTTAKONTIN ELEMENTTI */}
        <div ref={mapContainerRef} className="w-full flex-1 h-full min-h-[440px] z-0" />

        {/* VALITUN KOHTEEN TIETOLAATIKKO (ALAPALKKI) */}
        {selectedTask && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-background/95 backdrop-blur-md p-3.5 rounded-2xl border shadow-xl animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm",
                      selectedTask.task_type === "pickup" ? "bg-blue-600" : "bg-purple-600"
                    )}
                  >
                    {selectedTask.task_type === "pickup" ? "📦 Nouto" : "🚚 Palautus"}
                  </span>

                  <span className="text-sm font-bold text-foreground">
                    {selectedTask.customerName}
                  </span>

                  {selectedTask.phone && (
                    <a
                      href={`tel:${selectedTask.phone}`}
                      className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-md"
                    >
                      <Phone className="h-3 w-3" />
                      {selectedTask.phone}
                    </a>
                  )}

                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground">
                    {selectedTask.price.toFixed(2)} €
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    {selectedTask.address}
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Aikataulu: {selectedTask.scheduledTime}
                  </span>

                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Kuski: {selectedTask.driverName || "Jaossa"}
                  </span>

                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    Pesula: {selectedTask.laundryName}
                  </span>
                </div>
              </div>

              {/* TOIMINTANAPIT */}
              <div className="flex items-center gap-2 shrink-0">
                {onAssignDriver && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAssignDriver(selectedTask.id)}
                    className="h-8 text-xs font-semibold"
                  >
                    {selectedTask.driverId ? "Vaihda kuljettaja" : "Määritä kuljettaja"}
                  </Button>
                )}

                {onAssignLaundry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAssignLaundry(selectedTask.id)}
                    className="h-8 text-xs font-semibold"
                  >
                    Määritä pesula
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedTask(null)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Sulje"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
