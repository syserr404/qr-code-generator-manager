const { Jimp } = require('jimp');
const fs = require('fs');

async function processImage() {
  const sourcePath = 'C:/Users/tishy.patel/.gemini/antigravity/brain/d9ebd1e8-c9b6-4287-a9ff-11ff47383923/media__1779384190460.png';
  const buffer = fs.readFileSync(sourcePath);
  const image = await Jimp.read(buffer);
  
  // 1. Copy the full image to favicon.png
  await fs.promises.copyFile(sourcePath, 'public/favicon.png');

  // 2. Crop the shield.
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  let splitY = height;
  let startedShield = false;
  
  for (let y = 0; y < height; y++) {
    let rowHasAlpha = false;
    for (let x = 0; x < width; x++) {
      const color = image.getPixelColor(x, y);
      // In Jimp, color is RGBA (32-bit int), so alpha is the lowest 8 bits.
      const alpha = color & 0xFF;
      if (alpha > 10) {
        rowHasAlpha = true;
        break;
      }
    }
    
    if (rowHasAlpha) {
      startedShield = true;
    } else if (startedShield && !rowHasAlpha) {
      splitY = y;
      break;
    }
  }
  
  console.log(`Found split at Y: ${splitY} out of ${height}`);
  
  const shield = image.clone();
  shield.crop({ x: 0, y: 0, w: width, h: splitY });
  
  const outBuffer = await shield.getBuffer('image/png');
  fs.writeFileSync('public/logo.png', outBuffer);
  console.log('Successfully saved favicon.png and logo.png');
}

processImage().catch(console.error);
