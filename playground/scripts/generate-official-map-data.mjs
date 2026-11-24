import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const mapsDirectory = fileURLToPath(new URL('../src/assets/maps/', import.meta.url));
const worldSourceUrl =
  'http://bzdt.ch.mnr.gov.cn/iserver/services/data-world/wfs200?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=World:Countries&COUNT=247';
const islandSourceUrl =
  'http://bzdt.ch.mnr.gov.cn/iserver/services/data-world/wfs200?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=World:China_island&BBOX=108,3,125,18.2';
const boundarySourceUrl =
  'http://bzdt.ch.mnr.gov.cn/iserver/services/data-world/wfs200?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=World:China_Boundary_nanhai&COUNT=10';
const chinaProvinceSourceUrl =
  'http://bzdt.ch.mnr.gov.cn/iserver/services/map-china400/rest/maps/China_4326/queryResults.json?returnContent=true';
const chinaProvinceDataset = 'China_Province_pl@China';
const chinaProvinceQuery = {
  distance: 1,
  queryMode: 'SqlQuery',
  queryParameters: {
    expectCount: 50,
    networkType: 'LINE',
    queryOption: 'ATTRIBUTEANDGEOMETRY',
    queryParams: [
      {
        attributeFilter: 'SMID > 0',
        name: chinaProvinceDataset,
      },
    ],
    startRecord: 0,
  },
  spatialQueryMode: 'INTERSECT',
};

const provinceAdcodeByName = Object.freeze({
  上海市: '310000',
  云南省: '530000',
  内蒙古自治区: '150000',
  北京市: '110000',
  台湾省: '710000',
  吉林省: '220000',
  四川省: '510000',
  天津市: '120000',
  宁夏回族自治区: '640000',
  安徽省: '340000',
  山东省: '370000',
  山西省: '140000',
  广东省: '440000',
  广西壮族自治区: '450000',
  新疆维吾尔自治区: '650000',
  江苏省: '320000',
  江西省: '360000',
  河北省: '130000',
  河南省: '410000',
  浙江省: '330000',
  海南省: '460000',
  湖北省: '420000',
  湖南省: '430000',
  澳门特别行政区: '820000',
  甘肃省: '620000',
  福建省: '350000',
  西藏自治区: '540000',
  贵州省: '520000',
  辽宁省: '210000',
  重庆市: '500000',
  陕西省: '610000',
  青海省: '630000',
  香港特别行政区: '810000',
  黑龙江省: '230000',
});

const sourceMetadata = {
  agency: '中华人民共和国自然资源部标准地图服务系统',
  crs: 'EPSG:4326',
  generatedAt: new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
  }).format(new Date()),
  portal: 'http://bzdt.ch.mnr.gov.cn/',
};

const [
  worldXml,
  islandXml,
  boundaryXml,
  chinaProvinceResponse,
  legacyWorld,
] = await Promise.all([
  fetchText(worldSourceUrl),
  fetchText(islandSourceUrl),
  fetchText(boundarySourceUrl),
  postText(chinaProvinceSourceUrl, chinaProvinceQuery),
  readFile(`${mapsDirectory}world.json`, 'utf8').then(JSON.parse),
]);

const aliases = buildLegacyAliases(legacyWorld.features ?? []);
const worldMembers = parseMembers(worldXml, 'Countries');
const islandMembers = parseMembers(islandXml, 'China_island');
const boundaryMembers = parseMembers(boundaryXml, 'China_Boundary_nanhai');

const worldFeatures = worldMembers.map((member) => {
  const country = member.properties.COUNTRY ?? '';
  const legacy = findLegacyAlias(aliases, country);
  const isChina = country === '中华人民共和国';
  return {
    type: 'Feature',
    properties: {
      ...pickLegacyProperties(legacy),
      ADMIN: isChina ? 'China' : legacy?.ADMIN,
      ADM0_A3: isChina ? 'CHN' : legacy?.ADM0_A3,
      CAPITAL: member.properties.CAPITAL ?? '',
      CONTINENT: member.properties.CONTINENT ?? '',
      COUNTRY: country,
      ISO_A2: isChina ? 'CN' : legacy?.ISO_A2,
      ISO_A3: isChina ? 'CHN' : legacy?.ISO_A3,
      LABEL_VISIBLE: Boolean(country),
      NAME: isChina ? 'China' : legacy?.NAME ?? country,
      NAME_EN: isChina
        ? "People's Republic of China"
        : legacy?.NAME_EN ?? legacy?.NAME,
      NAME_ZH: isChina ? '中国' : country,
      OFFICIAL_NAME_ZH: country,
      SOVEREIGNT: isChina ? 'China' : legacy?.SOVEREIGNT,
      sourceFeatureId: member.id,
    },
    geometry: simplifyGeometry(member.geometry, 0.035),
  };
});

if (worldFeatures.length < 200) {
  throw new Error(`Expected at least 200 official world features, got ${worldFeatures.length}`);
}
const chinaFeature = worldFeatures.find(
  (feature) => feature.properties.OFFICIAL_NAME_ZH === '中华人民共和国',
);
if (!chinaFeature) {
  throw new Error('Official world dataset did not contain the China feature');
}

const chinaProvinceFeatures = parseChinaProvinceFeatures(
  JSON.parse(chinaProvinceResponse),
);
if (chinaProvinceFeatures.length !== 34) {
  throw new Error(
    `Expected 34 official China province features, got ${chinaProvinceFeatures.length}`,
  );
}

const islandFeatures = islandMembers.map((member) => ({
    type: 'Feature',
    properties: {
      kind: 'island',
      NAME_ZH: member.properties.NAME || '南海诸岛',
      sourceFeatureId: member.id,
    },
    geometry: simplifyGeometry(member.geometry, 0.0008),
  }),
);
const boundaryFeatures = boundaryMembers.map((member, index) => ({
  type: 'Feature',
  properties: {
    kind: 'boundary-line',
    NAME_ZH: '南海诸岛归属范围线',
    segment: index + 1,
    sourceFeatureId: member.id,
  },
  geometry: simplifyGeometry(member.geometry, 0.0015),
}));

if (islandFeatures.length === 0) {
  throw new Error('Official South China Sea island query returned no features');
}
if (boundaryFeatures.length !== 10) {
  throw new Error(
    `Expected 10 official South China Sea boundary segments, got ${boundaryFeatures.length}`,
  );
}

const worldCollection = {
  type: 'FeatureCollection',
  name: 'MNR official world countries and regions',
  source: {
    ...sourceMetadata,
    request: worldSourceUrl,
    sourceHashNormalization:
      'Parsed WFS feature members; dynamic response envelope omitted',
    sourceSha256: sha256(JSON.stringify(worldMembers)),
  },
  features: worldFeatures,
};
const maritimeCollection = {
  type: 'FeatureCollection',
  name: 'MNR official South China Sea islands and boundary line',
  source: {
    ...sourceMetadata,
    requests: [islandSourceUrl, boundarySourceUrl],
    sourceHashNormalization:
      'Parsed WFS feature members; dynamic response envelope omitted',
    sourceSha256: {
      boundary: sha256(JSON.stringify(boundaryMembers)),
      islands: sha256(JSON.stringify(islandMembers)),
    },
  },
  features: [...islandFeatures, ...boundaryFeatures],
};
const chinaProvinceCollection = {
  type: 'FeatureCollection',
  name: 'MNR official China province-level administrative divisions',
  source: {
    ...sourceMetadata,
    dataset: chinaProvinceDataset,
    request: {
      body: chinaProvinceQuery,
      method: 'POST',
      url: chinaProvinceSourceUrl,
    },
    sourceSha256: sha256(chinaProvinceResponse),
  },
  features: chinaProvinceFeatures,
};

await Promise.all([
  writeJson(`${mapsDirectory}mnr-world.json`, worldCollection),
  writeJson(`${mapsDirectory}mnr-china-maritime.json`, maritimeCollection),
  writeJson(
    `${mapsDirectory}mnr-china-provinces.json`,
    chinaProvinceCollection,
  ),
]);

console.log(
  JSON.stringify(
    {
      boundarySegments: boundaryFeatures.length,
      chinaPolygons: polygonCount(chinaFeature.geometry),
      chinaProvinceFeatures: chinaProvinceFeatures.length,
      islandFeatures: islandFeatures.length,
      outputDirectory: mapsDirectory,
      worldFeatures: worldFeatures.length,
      workspace: root,
    },
    null,
    2,
  ),
);

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

async function postText(url, body) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

function parseChinaProvinceFeatures(response) {
  const recordset = (response.recordsets ?? []).find(
    (item) => item.datasetName === chinaProvinceDataset,
  );
  return (recordset?.features ?? []).map((record) => {
    const properties = Object.fromEntries(
      (record.fieldNames ?? []).map((field, index) => [
        field,
        record.fieldValues?.[index],
      ]),
    );
    const name = String(properties.NAME ?? '').trim();
    const adcode = provinceAdcodeByName[name];
    if (!adcode) {
      throw new Error(`Unknown official China province name: ${name}`);
    }
    const center = record.geometry?.center;
    return {
      type: 'Feature',
      properties: {
        adcode,
        center:
          Number.isFinite(center?.x) && Number.isFinite(center?.y)
            ? [roundCoordinate(center.x), roundCoordinate(center.y)]
            : undefined,
        name,
        sourceDataset: chinaProvinceDataset,
        sourceFeatureId: record.ID,
      },
      geometry: simplifyGeometry(
        superMapRegionToGeoJSON(record.geometry),
        0.008,
      ),
    };
  });
}

function superMapRegionToGeoJSON(region) {
  const partLengths = region?.parts ?? [];
  const sourcePoints = region?.points ?? [];
  const partTopo = region?.partTopo ?? [];
  const rings = [];
  let offset = 0;
  for (let index = 0; index < partLengths.length; index += 1) {
    const length = Number(partLengths[index]);
    const ring = sourcePoints
      .slice(offset, offset + length)
      .map((point) => [Number(point.x), Number(point.y)])
      .filter((point) => point.every(Number.isFinite));
    offset += length;
    if (ring.length < 3) continue;
    if (!samePoint(ring[0], ring.at(-1))) ring.push([...ring[0]]);
    rings.push({
      coordinates: ring,
      hole: Number(partTopo[index] ?? 1) < 0,
    });
  }
  if (offset !== sourcePoints.length) {
    throw new Error(
      `SuperMap region parts use ${offset} points, response has ${sourcePoints.length}`,
    );
  }

  const polygons = rings
    .filter((ring) => !ring.hole)
    .map((ring) => ({
      area: Math.abs(signedRingArea(ring.coordinates)),
      rings: [ring.coordinates],
    }));
  for (const hole of rings.filter((ring) => ring.hole)) {
    const container = polygons
      .filter((polygon) =>
        pointInRing(hole.coordinates[0], polygon.rings[0]),
      )
      .sort((left, right) => left.area - right.area)[0];
    if (!container) {
      throw new Error('Official province geometry contains an unassigned hole');
    }
    container.rings.push(hole.coordinates);
  }

  const coordinates = polygons.map((polygon) => polygon.rings);
  if (coordinates.length === 1) {
    return { coordinates: coordinates[0], type: 'Polygon' };
  }
  return { coordinates, type: 'MultiPolygon' };
}

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    const intersects =
      currentPoint[1] > point[1] !== previousPoint[1] > point[1] &&
      point[0] <
        ((previousPoint[0] - currentPoint[0]) *
          (point[1] - currentPoint[1])) /
          (previousPoint[1] - currentPoint[1]) +
          currentPoint[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function signedRingArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area +=
      ring[index][0] * ring[index + 1][1] -
      ring[index + 1][0] * ring[index][1];
  }
  return area / 2;
}

function parseMembers(xml, typeName) {
  const blocks = [...xml.matchAll(/<wfs:member>([\s\S]*?)<\/wfs:member>/g)].map(
    (match) => match[1],
  );
  return blocks
    .filter((block) => block.includes(`<World:${typeName}`))
    .map((block) => ({
      geometry: parseGeometry(block),
      id:
        block.match(
          new RegExp(`gml:id="World\\.${escapeRegExp(typeName)}\\.([^"]+)"`),
        )?.[1] ?? '',
      properties: parseProperties(block),
    }))
    .filter((feature) => feature.geometry);
}

function parseGeometry(block) {
  const polygonBlocks = [...block.matchAll(/<gml:Polygon\b[\s\S]*?<\/gml:Polygon>/g)].map(
    (match) => match[0],
  );
  if (polygonBlocks.length > 0) {
    const polygons = polygonBlocks
      .map((polygon) => {
        const rings = [...polygon.matchAll(/<gml:posList>([\s\S]*?)<\/gml:posList>/g)]
          .map((match) => parseCoordinateList(match[1], true))
          .filter((ring) => ring.length >= 4);
        return rings;
      })
      .filter((polygon) => polygon.length > 0);
    if (polygons.length === 1) {
      return { coordinates: polygons[0], type: 'Polygon' };
    }
    return { coordinates: polygons, type: 'MultiPolygon' };
  }

  const lines = [...block.matchAll(/<gml:LineString\b[\s\S]*?<\/gml:LineString>/g)]
    .map((match) => {
      const values = match[0].match(/<gml:posList>([\s\S]*?)<\/gml:posList>/)?.[1];
      return parseCoordinateList(values ?? '', false);
    })
    .filter((line) => line.length >= 2);
  if (lines.length === 1) {
    return { coordinates: lines[0], type: 'LineString' };
  }
  if (lines.length > 1) {
    return { coordinates: lines, type: 'MultiLineString' };
  }
  return null;
}

function parseProperties(block) {
  const geometryStart = block.indexOf('<World:the_geom>');
  const geometryEnd = block.indexOf('</World:the_geom>');
  const withoutGeometry =
    geometryStart >= 0 && geometryEnd >= geometryStart
      ? `${block.slice(0, geometryStart)}${block.slice(
          geometryEnd + '</World:the_geom>'.length,
        )}`
      : block;
  const properties = {};
  for (const match of withoutGeometry.matchAll(
    /<World:([A-Za-z][\w]*)(?:\s[^>]*)?>([^<]*)<\/World:\1>/g,
  )) {
    properties[match[1]] = decodeXml(match[2].trim());
  }
  return properties;
}

function parseCoordinateList(value, closeRing) {
  const numbers = value.trim().split(/\s+/).map(Number);
  const coordinates = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    if (Number.isFinite(numbers[index]) && Number.isFinite(numbers[index + 1])) {
      coordinates.push([numbers[index], numbers[index + 1]]);
    }
  }
  if (
    closeRing &&
    coordinates.length > 0 &&
    !samePoint(coordinates[0], coordinates.at(-1))
  ) {
    coordinates.push([...coordinates[0]]);
  }
  return coordinates;
}

function simplifyGeometry(geometry, tolerance) {
  if (!geometry) return geometry;
  if (geometry.type === 'LineString') {
    return {
      ...geometry,
      coordinates: simplifyLine(geometry.coordinates, tolerance, false),
    };
  }
  if (geometry.type === 'MultiLineString') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((line) =>
        simplifyLine(line, tolerance, false),
      ),
    };
  }
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) =>
        simplifyLine(ring, ringTolerance(ring, tolerance), true),
      ),
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) =>
          simplifyLine(ring, ringTolerance(ring, tolerance), true),
        ),
      ),
    };
  }
  return geometry;
}

function ringTolerance(ring, maximum) {
  const bounds = coordinateBounds(ring);
  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  if (span < 0.15) return Math.min(maximum, 0.0003);
  if (span < 0.7) return Math.min(maximum, 0.002);
  if (span < 2) return Math.min(maximum, 0.008);
  return maximum;
}

function simplifyLine(points, tolerance, closeRing) {
  if (points.length <= (closeRing ? 5 : 2)) {
    return points.map(roundPoint);
  }
  const source = closeRing && samePoint(points[0], points.at(-1))
    ? points.slice(0, -1)
    : [...points];
  const simplified = simplifyDouglasPeucker(source, tolerance * tolerance);
  if (closeRing) {
    if (simplified.length < 3) return points.map(roundPoint);
    simplified.push([...simplified[0]]);
  }
  return simplified.map(roundPoint);
}

function simplifyDouglasPeucker(points, squareTolerance) {
  const markers = new Uint8Array(points.length);
  const first = 0;
  const last = points.length - 1;
  const stack = [[first, last]];
  markers[first] = 1;
  markers[last] = 1;

  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxDistance = squareTolerance;
    let index = -1;
    for (let current = start + 1; current < end; current += 1) {
      const distance = squareSegmentDistance(
        points[current],
        points[start],
        points[end],
      );
      if (distance > maxDistance) {
        index = current;
        maxDistance = distance;
      }
    }
    if (index > 0) {
      markers[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  return points.filter((_, index) => markers[index]);
}

function squareSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const ratio =
      ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (ratio > 1) {
      x = end[0];
      y = end[1];
    } else if (ratio > 0) {
      x += dx * ratio;
      y += dy * ratio;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function buildLegacyAliases(features) {
  const aliases = new Map();
  for (const feature of features) {
    const properties = feature.properties ?? {};
    for (const value of [
      properties.NAME_ZH,
      properties.NAME,
      properties.ADMIN,
      properties.SOVEREIGNT,
    ]) {
      const key = countryKey(value);
      if (key && !aliases.has(key)) aliases.set(key, properties);
    }
  }
  return aliases;
}

function findLegacyAlias(aliases, country) {
  return aliases.get(countryKey(country));
}

function countryKey(value) {
  return String(value ?? '')
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .replace(/共和国|王国|联邦|公国|合众国|民主|人民|伊斯兰/g, '')
    .replace(/[\s·'-]/g, '')
    .replace(/^中华人民共和国$/, '中国')
    .toLocaleLowerCase();
}

function pickLegacyProperties(properties = {}) {
  return Object.fromEntries(
    [
      'ADM0_A3',
      'ADMIN',
      'ISO_A2',
      'ISO_A3',
      'LABEL_X',
      'LABEL_Y',
      'NAME',
      'NAME_EN',
      'SOVEREIGNT',
    ]
      .filter((key) => properties[key] !== undefined)
      .map((key) => [key, properties[key]]),
  );
}

function coordinateBounds(points) {
  const longitude = points.map((point) => point[0]);
  const latitude = points.map((point) => point[1]);
  return [
    Math.min(...longitude),
    Math.min(...latitude),
    Math.max(...longitude),
    Math.max(...latitude),
  ];
}

function polygonCount(geometry) {
  if (geometry.type === 'Polygon') return 1;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.length;
  return 0;
}

function roundPoint(point) {
  return point.map(roundCoordinate);
}

function roundCoordinate(value) {
  return Number(value.toFixed(5));
}

function samePoint(left, right) {
  return Boolean(
    left && right && left[0] === right[0] && left[1] === right[1],
  );
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value)}\n`, 'utf8');
}
