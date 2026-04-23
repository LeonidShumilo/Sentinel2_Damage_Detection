var roi = geometry //region of interest

var fields = geometry //polygons
var changeMarks = date1.merge(date2).merge(date3).merge(date4).merge(date5).merge(date6)... //merge all labeled dates

var dates = changeMarks.aggregate_array('Date').distinct();
print('Unique Dates of Labels', dates);

// ---------- 1. Selection of two satellite images Sentinel-2 ----------
var start = '2023-12-27';   // first date
var end   = '2023-12-31';   // second date

var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(roi)
  .filterDate(start, end)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80))
  .sort('system:time_start');

// First two images
var img1 = ee.Image(s2.first());
var img2 = ee.Image(s2.toList(50,0).get(-1));


print('First Date', img1.date());
print('Second Date', img2.date());

// ---------- 2. Visualization ----------
var vis = {bands:['B4','B3','B2'], min:0, max:2000};

Map.addLayer(img1, vis, 'RGB Sentinel-2 Перша дата');
Map.addLayer(img2, vis, 'RGB Sentinel-2 Друга дата',0);

var vis1 = {bands:['B12','B8','B4'], min:0, max:5000};
//Map.centerObject(roi, 12);
Map.addLayer(img1, vis1, 'SWIR Sentinel-2 Перша дата',0);
Map.addLayer(img2, vis1, 'SWIR Sentinel-2 Друга дата',0);

// ---------- 3. Add field to the feature collection ----------
var date2 = img2.date().format('YYYY-MM-dd'); // date of second image

var fieldsWithFlags = ee.FeatureCollection(dates.iterate(function(date, fc) {
  fc = ee.FeatureCollection(fc);
  date = ee.String(date);

  // Labels for date of interest
  var marksForDate = changeMarks.filter(ee.Filter.eq('Date', date));

  // Add field to the polygon
  var updated = fc.map(function(f) {
    var intersects = marksForDate.filterBounds(f.geometry()).size().gt(0);
    return f.set(date, ee.Number(intersects));
  });

  return updated;
}, fields));

var styled = fieldsWithFlags.style({
  color: 'FF0000',        // outline color (red)
  width: 2,               // outline width (pixels)
  fillColor: '00000000'   // transparent fill (ARGB hex; 00 = 0% alpha)
});

Map.addLayer(styled, {}, 'Fields with Labels',0);
Map.addLayer(fieldsWithFlags, {}, 'Fields with Labels',0);


Export.table.toDrive({
  collection: fieldsWithFlags,
  description: 'Fields_with_changeFlag',
  fileFormat: 'SHP'
});
