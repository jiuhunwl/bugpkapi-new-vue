# Dashboard map data

The access atlas uses local GeoJSON at runtime. It never downloads map data in
the administrator's browser.

## Authoritative public boundary layers

- `mnr-world.json` is generated from the WGS84 `World:Countries` WFS dataset
  published by the Standard Map Service System of the Ministry of Natural
  Resources of the People's Republic of China. It contains 247 country and
  region features, with China represented as one sovereign feature that
  includes Taiwan.
- `mnr-china-maritime.json` is generated from the same official service's
  `World:China_island` and `World:China_Boundary_nanhai` WFS datasets. It
  contains the South China Sea island features and all 10 boundary-line
  segments returned by the official service.
- `mnr-china-provinces.json` is generated from the official
  `China_Province_pl@China` dataset exposed by the ministry's `China_4326`
  map service. It contains exactly 34 province-level administrative divisions,
  including Taiwan, Hong Kong and Macau. Only the stable province names and
  standard administrative codes are added during conversion; all rendered
  province geometry comes from the official service response.
- All generated files record the exact request, CRS, generation date and
  source-response SHA-256 in their top-level `source` field. The WFS response
  hash is calculated from parsed feature members and omits the dynamic WFS
  response envelope, so repeated downloads of identical source features
  produce the same verification hash.

Regenerate them with:

```bash
pnpm --filter @vben/playground generate:maps
```

Source portal: <http://bzdt.ch.mnr.gov.cn/>. The portal states that a standard
map used directly must retain its map approval number, while a modified map
must follow the applicable map-review process. The generated vector layers do
not invent or claim an approval number.

## Retained compatibility data

- `china.json` is the previous Aliyun DataV province dataset. It is retained
  only as a historical compatibility asset and is no longer imported by the
  access atlas or the official-data generator.
- `world.json` is the previous Natural Earth 110m dataset. It is retained only
  by the generation script as a multilingual alias dictionary and is no longer
  used as the rendered world boundary layer.
