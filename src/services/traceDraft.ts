export interface TracedDraftPath {
  path: string;
  strokeWidth: number;
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('AI 草稿图片加载失败'));
    image.src = dataUrl;
  });
}

export async function traceDraftToPathCommands(
  imageDataUrl: string,
  centerX: number,
  centerY: number,
) {
  const image = await loadImage(imageDataUrl);
  const sampleSize = 280;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sampleSize;
  sourceCanvas.height = sampleSize;
  const context = sourceCanvas.getContext('2d');
  if (!context) {
    throw new Error('浏览器不支持草稿追踪');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, sampleSize, sampleSize);
  const scale = Math.min(sampleSize / image.width, sampleSize / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const offsetX = (sampleSize - width) / 2;
  const offsetY = (sampleSize - height) / 2;
  context.drawImage(image, offsetX, offsetY, width, height);

  const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
  const dark = new Uint8Array(sampleSize * sampleSize);
  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const index = (y * sampleSize + x) * 4;
      const alpha = pixels[index + 3] ?? 0;
      const red = pixels[index] ?? 255;
      const green = pixels[index + 1] ?? 255;
      const blue = pixels[index + 2] ?? 255;
      const luma = red * 0.299 + green * 0.587 + blue * 0.114;
      dark[y * sampleSize + x] = alpha > 40 && luma < 205 ? 1 : 0;
    }
  }

  const isDark = (x: number, y: number) => (
    x >= 0 && x < sampleSize && y >= 0 && y < sampleSize && dark[y * sampleSize + x] === 1
  );
  const edge = new Uint8Array(sampleSize * sampleSize);
  for (let y = 1; y < sampleSize - 1; y += 1) {
    for (let x = 1; x < sampleSize - 1; x += 1) {
      if (!isDark(x, y)) {
        continue;
      }
      if (!isDark(x - 1, y) || !isDark(x + 1, y) || !isDark(x, y - 1) || !isDark(x, y + 1)) {
        edge[y * sampleSize + x] = 1;
      }
    }
  }

  const visited = new Uint8Array(sampleSize * sampleSize);
  const edgeAt = (x: number, y: number) => (
    x >= 0 && x < sampleSize && y >= 0 && y < sampleSize && edge[y * sampleSize + x] === 1 && visited[y * sampleSize + x] === 0
  );
  const outputScale = 1.45;
  const toCanvasX = (x: number) => centerX + (x - sampleSize / 2) * outputScale;
  const toCanvasY = (y: number) => centerY + (y - sampleSize / 2) * outputScale;
  const paths: TracedDraftPath[] = [];
  const directions = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];

  const findNext = (x: number, y: number) => {
    for (let radius = 1; radius <= 2; radius += 1) {
      for (const [dx, dy] of directions) {
        const nx = x + dx * radius;
        const ny = y + dy * radius;
        if (edgeAt(nx, ny)) {
          return { x: nx, y: ny };
        }
      }
    }
    return null;
  };

  const simplifyPoints = (points: Array<{ x: number; y: number }>) => {
    const simplified: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < points.length; index += 1) {
      if (index % 3 === 0 || index === points.length - 1) {
        simplified.push(points[index]);
      }
    }
    return simplified;
  };

  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      if (!edgeAt(x, y)) {
        continue;
      }
      const points: Array<{ x: number; y: number }> = [];
      let current = { x, y };
      for (let step = 0; step < 240; step += 1) {
        visited[current.y * sampleSize + current.x] = 1;
        points.push(current);
        const next = findNext(current.x, current.y);
        if (!next) {
          break;
        }
        current = next;
      }
      if (points.length < 8) {
        continue;
      }
      const simplified = simplifyPoints(points);
      const [first, ...rest] = simplified;
      const commands = [`M ${toCanvasX(first.x).toFixed(1)} ${toCanvasY(first.y).toFixed(1)}`];
      rest.forEach((point) => {
        commands.push(`L ${toCanvasX(point.x).toFixed(1)} ${toCanvasY(point.y).toFixed(1)}`);
      });
      paths.push({ path: commands.join(' '), strokeWidth: 2.4 });
      if (paths.length >= 180) {
        return paths;
      }
    }
  }

  return paths;
}
