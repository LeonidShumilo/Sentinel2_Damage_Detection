var fc = //Feature collection with polygons for data extraction
var id = '7' //id of sampling territory
var dates = [
'2022-03-24',
'2022-03-29',
'2022-04-08',
'2022-05-03',
'2022-05-08',
'2022-05-23',
'2022-06-12',
'2022-06-27',
'2022-07-02',
'2022-07-07',
'2022-07-12',
'2022-07-17',
'2022-07-27',
'2022-08-01',
'2022-08-06',
'2022-08-11',
'2022-08-31',
'2022-09-20',
'2022-10-05',
'2022-11-29',
'2022-12-04',
'2022-12-19'
// ...
]; // <-- your list of YYYY-MM-DD for images to download

// export folder and CRS/scale settings
var exportFolder = 'sample7_S2_exports'; // change or leave empty string for Drive root
var exportCRS = 'EPSG:32636';            // e.g., 'EPSG:32636' or keep null to use native
var exportScale = 10;            // 10 m output (SWIR upsampled to 10 m; use 20 for native SWIR)

// ===================== AOI (union of FC, fix invalid rings) =====================
var aoi = fc.geometry();

// ===================== CLOUD/SHADOW MASK (S2 SR Harmonized) =====================
// Uses SCL (scene classification) to remove cloud, shadow, cirrus, snow, etc.
function maskS2sr(img) {
  var scl = img.select('SCL');
  // keep vegetation(4), bare(5), water(6), unclassified(7), dark area(2), cloud shadow(3) excluded
  var good = scl.eq(1)     // saturated/defective? -> often treated as bad; comment out if you prefer
      .or(scl.eq(2))       // dark area pixels
      .or(scl.eq(4))       // vegetation
      .or(scl.eq(5))       // bare soils
      .or(scl.eq(6))       // water
      .or(scl.eq(7));      // unclassified
  // Mask out clouds(8,9,10), cirrus(10), snow(11), cloud shadows(3)
  var bad = scl.eq(3).or(scl.eq(8)).or(scl.eq(9)).or(scl.eq(10)).or(scl.eq(11));
  var mask = good.and(bad.not());
  return img.updateMask(mask).divide(10000);
}

// Build a median composite for a single date (same calendar day)
function compositeForDate(dateStr) {
  var start = ee.Date(dateStr);
  var end   = start.advance(1, 'day'); // 24h window

  var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 90))
    .map(maskS2sr)
    .select(
      ['B4','B3','B2','B8','B11'],
      ['red','green','blue','nir','swir11']
    );

  // Median over that day; clip to AOI
  var comp = col.median()
    .clip(aoi)
    .set({
      date: dateStr,
      image_count: col.size()
    });

  return comp;
}

// ===================== VIS + LAYERS + EXPORT TASKS =====================
var visRGB = {bands: ['red','green','blue'], min: 0.02, max: 0.3};

// Center map once
Map.addLayer(aoi, {color: 'red'}, 'AOI boundary', false);

// Loop over your (client-side) JS list of dates to:
// 1) make the composite,
// 2) add a preview layer,
// 3) queue an Export.image.toDrive task.
dates.forEach(function(dateStr) {
  var img = compositeForDate(dateStr);

  // Add to map (even if no acquisitions — it will render empty)
  Map.addLayer(img, visRGB, dateStr);

  // Export task (appears in Tasks panel)
  var description = 'S2_' +id+'_'+ dateStr.replace(/-/g, '');
  Export.image.toDrive({
    image: img,
    description: description,
    folder: exportFolder && exportFolder.length ? exportFolder : null,
    fileNamePrefix: description,
    region: aoi,
    scale: exportScale,         // 10 m output by default (SWIR upsampled)
    crs: exportCRS,             // set to a code like 'EPSG:32636' or leave null
    maxPixels: 1e13
  });
});

// table of how many source images per date (after filtering)
var imgCounts = dates.map(function(d) {
  var start = ee.Date(d);
  var end = start.advance(1, 'day');
  var n = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 90))
    .size();
  return ee.Dictionary({date: d, count: n});
});
print('Per-date source counts:', imgCounts);
