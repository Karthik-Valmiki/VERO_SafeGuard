import React, { useState, useEffect, useCallback } from "react"
import { MapContainer, TileLayer, Circle, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Activity, Users, FileCheck, Zap, RefreshCw } from "lucide-react"

// Fix Default Leaflet Icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
})

// ── Zone coordinates (matches DB zone_ids seeded by init_db) ──────────────
const ZONE_COORDS = {
  1:  [12.9784, 77.6408],  // Bengaluru – Indiranagar
  2:  [12.9279, 77.6271],  // Bengaluru – Koramangala
  3:  [12.9698, 77.7499],  // Bengaluru – Whitefield
  4:  [13.0390, 80.2330],  // Chennai – T Nagar
  5:  [13.0012, 80.2565],  // Chennai – Adyar
  6:  [12.9716, 80.2186],  // Chennai – Velachery
  7:  [13.0850, 80.2101],  // Chennai – Anna Nagar
  8:  [19.0596, 72.8295],  // Mumbai – Bandra
  9:  [19.1136, 72.8697],  // Mumbai – Andheri
  10: [19.0178, 72.8478],  // Mumbai – Dadar
  11: [19.2300, 72.8600],  // Mumbai – Borivali
  12: [28.6304, 77.2177],  // Delhi – Connaught Place
  13: [28.5677, 77.2433],  // Delhi – Lajpat Nagar
  14: [28.7041, 77.1025],  // Delhi – Rohini
  15: [28.5921, 77.0460],  // Delhi – Dwarka
  16: [17.3984, 78.4728],  // Hyderabad – Central
  17: [17.4156, 78.4347],  // Hyderabad – Banjara Hills
  18: [17.4399, 78.4983],  // Hyderabad – Secunderabad
  19: [18.5362, 73.8939],  // Pune – Koregaon Park
  20: [18.5074, 73.8077],  // Pune – Kothrud
  21: [22.5528, 88.3524],  // Kolkata – Park Street
  22: [22.5864, 88.4098],  // Kolkata – Salt Lake
  23: [28.4900, 77.0888],  // Gurgaon - Cyber City
  24: [28.5020, 77.0780],  // Gurgaon - Udyog Vihar
  25: [17.7288, 83.3330],  // Vizag - MVP Colony
  26: [17.6868, 83.2185],  // Vizag - Gajuwaka
  27: [23.0366, 72.5611],  // Ahmedabad - Navrangpura
  28: [23.0287, 72.5204],  // Ahmedabad - Satellite
}

const ZONE_RADIUS = {
  default: 2500,
  3: 3000, 7: 2500, 9: 3000, 11: 2500, 14: 3000, 15: 3000,
  18: 2500, 20: 2500, 22: 2500,
}

const CITY_COORDS = {
  "Mumbai":    [19.0760, 72.8777],
  "Delhi":     [28.6139, 77.2090],
  "Bengaluru": [12.9716, 77.5946],
  "Chennai":   [13.0827, 80.2707],
  "Hyderabad": [17.3850, 78.4867],
  "Pune":      [18.5204, 73.8567],
  "Kolkata":   [22.5726, 88.3639],
  "Gurgaon":   [28.4595, 77.0266],
  "Vizag":     [17.6868, 83.2185],
  "Ahmedabad": [23.0225, 72.5714],
}

// Zone color by risk level
function zoneColor(risk, isActive, policies) {
  if (isActive)   return { stroke: "#f43f5e", fill: "#f43f5e", fillOp: 0.35, weight: 3, dash: "8 6" }
  if (risk > 1.3) return { stroke: "#f59e0b", fill: "#f59e0b", fillOp: 0.18, weight: 2, dash: "" }
  if (risk > 1.1) return { stroke: "#a78bfa", fill: "#a78bfa", fillOp: 0.15, weight: 1.5, dash: "" }
  if (policies > 200) return { stroke: "#10b981", fill: "#10b981", fillOp: 0.12, weight: 1.5, dash: "" }
  return { stroke: "#6d28d9", fill: "#6d28d9", fillOp: 0.10, weight: 1, dash: "" }
}

// Scatter dots representing rider density within a zone
function RiderDots({ zone, coords, isActive, riderCount }) {
  if (!riderCount) return null
  // Cap visual dots — show max 50 scatter dots per zone regardless of 8k
  const DOT_SCALE = Math.min(50, Math.ceil(riderCount / 120) + 1)
  const ZONE_COLORS = ["#6d28d9", "#2563eb", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#f97316", "#8b5cf6"]
  const dotColor = isActive ? "#f43f5e" : ZONE_COLORS[zone % ZONE_COLORS.length]
  const spread   = (ZONE_RADIUS[zone] || ZONE_RADIUS.default) / 111320 // approx degrees

  // Deterministic scatter using zone_id as seed
  const dots = Array.from({ length: DOT_SCALE }, (_, i) => {
    const ang = (i / DOT_SCALE) * 2 * Math.PI + zone * 0.47
    const r   = Math.sqrt((i + 1) / DOT_SCALE) * spread * 0.85
    return [coords[0] + r * Math.cos(ang), coords[1] + r * Math.sin(ang)]
  })

  return dots.map((pos, i) => (
    <Circle
      key={`dot-${zone}-${i}`}
      center={pos}
      radius={55 + (i % 3) * 20}
      pathOptions={{ color: dotColor, fillColor: dotColor, fillOpacity: 0.75, weight: 0 }}
    />
  ))
}

function MapUpdater({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.2 })
  }, [center, zoom, map])
  return null
}

// ── Legend ───────────────────────────────────────────────────────────────
function MapLegend() {
  return (
    <div className="absolute bottom-6 left-4 z-[1000] bg-[#0f0f18]/95 backdrop-blur border border-white/10 rounded-xl p-3 text-xs space-y-2 shadow-2xl">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Zone Status</p>
      {[
        { color: "#f43f5e", label: "Active Disruption" },
        { color: "#f59e0b", label: "High Risk (>1.3×)" },
        { color: "#a78bfa", label: "Elevated Risk (>1.1×)" },
        { color: "#10b981", label: "Dense Coverage" },
        { color: "#6d28d9", label: "Standard Zone" },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 flex-shrink-0" style={{ borderColor: color, backgroundColor: color + "30" }} />
          <span className="text-gray-400">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAP TAB
// ══════════════════════════════════════════════════════════════════════════
export default function MapTab() {
  const [mapData,    setMapData]    = useState({ zones: [], activeEvents: [] })
  const [mapCenter,  setMapCenter]  = useState(CITY_COORDS["Mumbai"])
  const [mapZoom,    setMapZoom]    = useState(11)
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [activeCity, setActiveCity] = useState("Mumbai")

  const fetchMap = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res  = await fetch("/api/dashboards/admin/map")
      const data = await res.json()
      setMapData(data)
      setLastUpdate(new Date())
    } catch (err) {
      console.error("Map fetch error:", err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMap()
    // Refresh every 15s — picks up new trigger events automatically
    const iv = setInterval(() => fetchMap(true), 15000)
    return () => clearInterval(iv)
  }, [fetchMap])

  const handleCityClick = (city) => {
    setActiveCity(city)
    setMapCenter(CITY_COORDS[city])
    setMapZoom(12)
  }

  const totalRiders   = mapData.zones.reduce((s, z) => s + (z.riders   || 0), 0)
  const totalPolicies = mapData.zones.reduce((s, z) => s + (z.policies || 0), 0)
  const activeZones   = new Set(mapData.activeEvents || [])

  return (
    <div className="h-[calc(100vh-64px)] w-full flex flex-col relative bg-[#0a0a0f]">

      {/* ── Top bar controls ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2">
        {/* City switcher */}
        <div className="bg-[#0f0f18]/95 backdrop-blur border border-white/10 rounded-2xl p-1.5 shadow-2xl flex items-center gap-1">
          {Object.keys(CITY_COORDS).map(city => (
            <button
              key={city}
              onClick={() => handleCityClick(city)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeCity === city
                  ? "bg-violet-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* KPI strip */}
        <div className="bg-[#0f0f18]/90 backdrop-blur border border-white/10 rounded-xl px-4 py-2 shadow-xl flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-mono text-white">{totalRiders.toLocaleString()}</span>
            <span className="text-[10px] text-gray-500">riders</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-mono text-white">{totalPolicies.toLocaleString()}</span>
            <span className="text-[10px] text-gray-500">active policies</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            {activeZones.size > 0
              ? <><Activity className="w-3.5 h-3.5 text-rose-400 animate-pulse" /><span className="text-xs font-mono text-rose-400">{activeZones.size} LIVE</span></>
              : <><Zap className="w-3.5 h-3.5 text-gray-500" /><span className="text-xs text-gray-500">No disruptions</span></>
            }
          </div>
          <div className="w-px h-4 bg-white/10" />
          <button onClick={() => fetchMap()} className="text-gray-500 hover:text-white p-0.5 transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
          <span className="text-[9px] text-gray-600 font-mono">
            {lastUpdate ? lastUpdate.toLocaleTimeString("en-IN", { hour12: false }) : "loading"}
          </span>
        </div>
      </div>

      {/* ── Map canvas ── */}
      <div className="flex-1 w-full">
        {loading ? (
          <div className="h-full flex items-center justify-center bg-[#0a0a0f] text-gray-500 gap-3">
            <Activity className="w-5 h-5 animate-spin text-violet-500" />
            Loading command map...
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "100%", width: "100%", outline: "none", background: "#0a0a0f" }}
            zoomControl={false}
          >
            <MapUpdater center={mapCenter} zoom={mapZoom} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CARTO"
            />

            {mapData.zones.map(z => {
              const coords = ZONE_COORDS[z.zone_id]
              if (!coords) return null
              const isActive = activeZones.has(z.zone_id)
              const style    = zoneColor(z.risk, isActive, z.policies)
              const radius   = ZONE_RADIUS[z.zone_id] || ZONE_RADIUS.default

              return (
                <React.Fragment key={`zone-${z.zone_id}`}>
                  {/* Zone halo */}
                  <Circle
                    center={coords}
                    radius={radius}
                    pathOptions={{
                      color:       style.stroke,
                      fillColor:   style.fill,
                      fillOpacity: style.fillOp,
                      weight:      style.weight,
                      dashArray:   style.dash,
                    }}
                  >
                    <Popup>
                      <div style={{
                        background: "#0f0f18", border: "1px solid #374151", borderRadius: 12,
                        padding: "12px 14px", minWidth: 190, color: "white",
                      }}>
                        <p style={{ fontWeight: "bold", borderBottom: "1px solid #374151", paddingBottom: 8, marginBottom: 8, fontSize: 13 }}>
                          {z.zone_name}
                          {isActive && <span style={{ marginLeft: 6, fontSize: 9, color: "#f43f5e", border: "1px solid #f43f5e33", borderRadius: 4, padding: "2px 5px" }}>LIVE</span>}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                          <div>
                            <p style={{ color: "#6b7280", fontSize: 10 }}>City</p>
                            <p style={{ fontWeight: 600 }}>{z.city}</p>
                          </div>
                          <div>
                            <p style={{ color: "#6b7280", fontSize: 10 }}>Risk</p>
                            <p style={{ fontWeight: 600, color: z.risk > 1.2 ? "#f59e0b" : "#10b981" }}>{z.risk?.toFixed(2)}×</p>
                          </div>
                          <div>
                            <p style={{ color: "#6b7280", fontSize: 10 }}>Riders</p>
                            <p style={{ fontWeight: 600 }}>{(z.riders || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p style={{ color: "#6b7280", fontSize: 10 }}>Active policies</p>
                            <p style={{ fontWeight: 600, color: "#8b5cf6" }}>{(z.policies || 0).toLocaleString()}</p>
                          </div>
                        </div>
                        {isActive && (
                          <div style={{ marginTop: 10, padding: "6px 8px", background: "#f43f5e22", border: "1px solid #f43f5e44", borderRadius: 8, fontSize: 11, color: "#f43f5e" }}>
                            ⚡ Active disruption — payouts running
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Circle>

                  {/* Rider density dots */}
                  <RiderDots
                    zone={z.zone_id}
                    coords={coords}
                    isActive={isActive}
                    riderCount={z.riders || 0}
                  />
                </React.Fragment>
              )
            })}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <MapLegend />
    </div>
  )
}

