var roi = //Feature Collection of polygons that define region of interest
// 2) Date range (edit as needed)
var start = '2022-01-01';
var end   = '2023-01-01';  // today

// 3) Cloud threshold (scene-level % from metadata)
var maxCloud = 30;

// ======================= QUERY =======================
// Use S2 SR Harmonized (has CLOUDY_PIXEL_PERCENTAGE property)
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(roi)
  .filterDate(start, end)
  .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', maxCloud));

// Sort by acquisition time (ascending = oldest→newest)
var s2Sorted = s2.sort('system:time_start'); 
// If you prefer newest first: var s2Sorted = s2.sort('system:time_start', false);

// Build table
var table = s2Sorted.map(function(img) {
  return ee.Feature(null, {
    id: img.id(),
    date: ee.Date(img.get('system:time_start')).format('YYYY-MM-dd'),
    cloud_pct: ee.Number(img.get('CLOUDY_PIXEL_PERCENTAGE')),
    mgrs_tile: img.get('MGRS_TILE'),
    orbit: img.get('SENSING_ORBIT_NUMBER')
  });
});

// ======================= OUTPUTS =======================
print('Count (≤ ' + maxCloud + '% cloud):', s2Sorted.size());
print('By date (first 5000 rows):', table.limit(5000));

// Quick visual check
Map.centerObject(roi, 9);
Map.addLayer(ee.Image(s2Sorted.first()).select(['B4','B3','B2']).divide(10000),
             {min:0.05, max:0.3}, 'First by date (RGB)');

// ======================= EXPORT (optional) ============
Export.table.toDrive({
  collection: table,
  description: 'S2_list_roi_cloud' + maxCloud + '_byDate',
  fileNamePrefix: 'S2_list_roi_cloud' + maxCloud + '_byDate',
  fileFormat: 'CSV'
});
