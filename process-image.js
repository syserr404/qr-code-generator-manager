const { Jimp } = require('jimp');
const fs = require('fs');

async function processImage() {
  const sourcePath = 'C:/Users/tishy.patel/.gemini/antigravity/brain/d9ebd1e8-c9b6-4287-a9ff-11ff47383923/media__1779384190460.png';
  const buffer = fs.readFileSync(sourcePath);
  const image = await Jimp.read(buffer);
  
  // 1. Copy the full image to favicon.png
  await fs.promises.copyFile(sourcePath, 'public/favicon.png');

  // We can scan to find the exact bounding box for the shield
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  let startedShield = false;
  let splitY = height;
  
  // Find bottom of shield
  for (let y = 0; y < height; y++) {
    let rowHasAlpha = false;
    for (let x = 0; x < width; x++) {
      if ((image.getPixelColor(x, y) & 0xFF) > 10) { rowHasAlpha = true; break; }
    }
    if (rowHasAlpha) startedShield = true;
    else if (startedShield && !rowHasAlpha) { splitY = y; break; }
  }
  
  // Find minX, maxX, minY of the shield area
  let minX = width, maxX = 0, minY = splitY;
  for (let y = 0; y < splitY; y++) {
    let rowHasAlpha = false;
    for (let x = 0; x < width; x++) {
      if ((image.getPixelColor(x, y) & 0xFF) > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        rowHasAlpha = true;
      }
    }
    if (rowHasAlpha && y < minY) minY = y;
  }
  
  const cropW = maxX - minX + 1;
  const cropH = splitY - minY;
  
  const shield = image.clone();
  shield.crop({ x: minX, y: minY, w: cropW, h: cropH });
  
  const outBuffer = await shield.getBuffer('image/png');
  fs.writeFileSync('public/logo.png', outBuffer);
  console.log('Successfully saved favicon.png and logo.png');
}

processImage().catch(console.error);
