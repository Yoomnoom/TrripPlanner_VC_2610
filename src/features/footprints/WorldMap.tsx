import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { NUMERIC_TO_ALPHA2 } from '@/data/countryNumeric';
import { statusStyle, type MapView, type Marks } from './mapStyle';

/** World map (react-simple-maps, Mercator). Controlled view so a search can move it. */
export default function WorldMap({
  marks,
  view,
  onViewChange,
  onPick,
}: {
  marks: Marks;
  view: MapView;
  onViewChange: (v: MapView) => void;
  onPick: (alpha2: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-card" role="group" aria-label="세계 지도">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 120 }}
        height={420}
        style={{ width: '100%', height: 'auto' }}
      >
        <ZoomableGroup
          zoom={view.zoom}
          center={view.center}
          minZoom={1}
          maxZoom={12}
          onMoveEnd={({ zoom, coordinates }) =>
            onViewChange({ zoom, center: coordinates as [number, number] })
          }
        >
          <Geographies geography="/geo/countries-110m.json">
            {({ geographies }) =>
              geographies.map((geo) => {
                const code = NUMERIC_TO_ALPHA2[String(geo.id)];
                const status = code ? marks[code] : undefined;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => code && onPick(code)}
                    style={statusStyle(status)}
                    aria-label={`${geo.properties.name}${status ? (status === 'visited' ? ' 가봤어요' : ' 가보고 싶어요') : ''}`}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
