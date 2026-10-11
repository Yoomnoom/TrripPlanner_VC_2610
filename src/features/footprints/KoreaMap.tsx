import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { statusStyle, type Marks } from './mapStyle';

/** South Korea at 시·군·구 level (KOSTAT 2013 boundaries). Region footprints are keyed by the 5-digit code. */
export default function KoreaMap({
  marks,
  onPick,
}: {
  marks: Marks;
  onPick: (code: string, name: string) => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-card bg-surface shadow-card"
      role="group"
      aria-label="대한민국 시·군 지도"
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [127.8, 36.2], scale: 6200 }}
        width={600}
        height={640}
        style={{ width: '100%', height: 'auto' }}
      >
        <ZoomableGroup minZoom={1} maxZoom={8} center={[127.8, 36.2]}>
          <Geographies geography="/geo/kr-municipalities.json">
            {({ geographies }) =>
              geographies.map((geo) => {
                const code = String(geo.properties.code);
                const name = String(geo.properties.name);
                const status = marks[code];
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onPick(code, name)}
                    style={statusStyle(status)}
                    aria-label={`${name}${status ? (status === 'visited' ? ' 가봤어요' : ' 가보고 싶어요') : ''}`}
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
