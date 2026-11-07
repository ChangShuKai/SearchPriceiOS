const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const targets = {
  familymart: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/fb/33/33/fb33335d-039b-33df-070d-7fbece05df25/AppIcon-0-0-1x_U007emarketing-0-11-0-85-220.png/512x512bb.jpg',
  pxmart: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/85/4d/30/854d3018-6041-90ac-7be0-92097b4144f6/AppIcon-0-0-1x_U007emarketing-0-6-0-85-220.png/512x512bb.jpg',
  watsons: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/49/b3/8a/49b38a39-4695-6321-8505-10a46ff68f9b/AppIcon-TW-1111-2026-0-0-1x_U007emarketing-0-11-0-85-220.png/512x512bb.jpg',
  cosmed: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/e3/ab/1c/e3ab1c75-3921-6c81-4fe4-c058a08a660c/AppIcon-0-0-1x_U007emarketing-0-2-0-85-220.png/512x512bb.jpg',
  costco: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/32/46/9f/32469fee-3c22-b800-36ea-51ee3e12740b/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg',
  'rt-mart': 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/e4/17/64/e417641c-0082-9f37-2ccf-5e4879849e8b/AppIcon-0-0-1x_U007emarketing-0-6-0-85-220.png/512x512bb.jpg',
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('Status ' + res.statusCode));
      }
      const stream = fs.createWriteStream(dest);
      res.pipe(stream);
      stream.on('finish', () => stream.close(resolve));
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  for (const [key, url] of Object.entries(targets)) {
    const tmpFile = path.join(tmpDir, key + '.jpg');
    console.log('Downloading', key);
    await download(url, tmpFile);

    // Convert to standard 32bpp PNG using PowerShell System.Drawing
    const outFile = path.resolve('assets/stores', key + '.png');
    const ps = `
      Add-Type -AssemblyName System.Drawing;
      $img = [System.Drawing.Image]::FromFile('${tmpFile.replace(/\\/g, '\\\\')}');
      $bmp = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb);
      $g = [System.Drawing.Graphics]::FromImage($bmp);
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality;
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;
      $g.DrawImage($img, 0, 0, 512, 512);
      $g.Dispose();
      $img.Dispose();
      $bmp.Save('${outFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png);
      $bmp.Dispose();
    `;
    const b64 = Buffer.from(ps, 'utf16le').toString('base64');
    execSync('powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + b64);
    console.log('Converted', key, 'to', outFile);
  }

  // Also create a clean, elegant other.png for custom stores
  const otherFile = path.resolve('assets/stores/other.png');
  const psOther = `
    Add-Type -AssemblyName System.Drawing;
    $bmp = New-Object System.Drawing.Bitmap 512, 512, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb);
    $g = [System.Drawing.Graphics]::FromImage($bmp);
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;
    $g.Clear([System.Drawing.Color]::FromArgb(242, 243, 247));

    # Draw a modern storefront building icon
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(100, 110, 125)), 28;
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round;
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round;
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round;

    # Roof / Awning
    $g.DrawLine($pen, 80, 190, 256, 100);
    $g.DrawLine($pen, 256, 100, 432, 190);

    # Columns
    $g.DrawLine($pen, 130, 210, 130, 380);
    $g.DrawLine($pen, 214, 210, 214, 380);
    $g.DrawLine($pen, 298, 210, 298, 380);
    $g.DrawLine($pen, 382, 210, 382, 380);

    # Base line
    $g.DrawLine($pen, 70, 400, 442, 400);

    $pen.Dispose();
    $g.Dispose();
    $bmp.Save('${otherFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png);
    $bmp.Dispose();
  `;
  const b64Other = Buffer.from(psOther, 'utf16le').toString('base64');
  execSync('powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + b64Other);
  console.log('Created other.png');

  // Clean tmp
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

run().catch(console.error);
