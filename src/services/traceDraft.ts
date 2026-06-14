export interface TracedDraftPath {
  path: string;
  strokeWidth: number;
}

type TracePoint = { x: number; y: number };

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
  const lumas: number[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 0;
    if (alpha <= 30) {
      continue;
    }
    const red = pixels[index] ?? 255;
    const green = pixels[index + 1] ?? 255;
    const blue = pixels[index + 2] ?? 255;
    lumas.push(red * 0.299 + green * 0.587 + blue * 0.114);
  }
  lumas.sort((a, b) => a - b);
  const percentile = lumas[Math.floor(lumas.length * 0.42)] ?? 228;
  const inkThreshold = Math.max(216, Math.min(244, percentile + 28));
  const ink = new Uint8Array(sampleSize * sampleSize);
  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const index = (y * sampleSize + x) * 4;
      const alpha = pixels[index + 3] ?? 0;
      const red = pixels[index] ?? 255;
      const green = pixels[index + 1] ?? 255;
      const blue = pixels[index + 2] ?? 255;
      const luma = red * 0.299 + green * 0.587 + blue * 0.114;
      ink[y * sampleSize + x] = alpha > 30 && luma < inkThreshold ? 1 : 0;
    }
  }

  const maskAt = (mask: Uint8Array, x: number, y: number) => (
    x >= 0 && x < sampleSize && y >= 0 && y < sampleSize && mask[y * sampleSize + x] === 1
  );

  const dilate = (mask: Uint8Array, radius: number) => {
    const next = new Uint8Array(mask.length);
    for (let y = 0; y < sampleSize; y += 1) {
      for (let x = 0; x < sampleSize; x += 1) {
        if (!maskAt(mask, x, y)) {
          continue;
        }
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < sampleSize && ny >= 0 && ny < sampleSize) {
              next[ny * sampleSize + nx] = 1;
            }
          }
        }
      }
    }
    return next;
  };

  const closeSmallGaps = (mask: Uint8Array) => {
    const next = new Uint8Array(mask);
    for (let y = 1; y < sampleSize - 1; y += 1) {
      for (let x = 1; x < sampleSize - 1; x += 1) {
        const index = y * sampleSize + x;
        if (mask[index]) {
          continue;
        }
        const horizontal = maskAt(mask, x - 1, y) && maskAt(mask, x + 1, y);
        const vertical = maskAt(mask, x, y - 1) && maskAt(mask, x, y + 1);
        const diagonalA = maskAt(mask, x - 1, y - 1) && maskAt(mask, x + 1, y + 1);
        const diagonalB = maskAt(mask, x + 1, y - 1) && maskAt(mask, x - 1, y + 1);
        if (horizontal || vertical || diagonalA || diagonalB) {
          next[index] = 1;
        }
      }
    }
    return next;
  };

  const traceMask = closeSmallGaps(dilate(ink, 1));

  const visited = new Uint8Array(sampleSize * sampleSize);
  const traceAt = (x: number, y: number) => (
    x >= 0 && x < sampleSize && y >= 0 && y < sampleSize && traceMask[y * sampleSize + x] === 1 && visited[y * sampleSize + x] === 0
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

  const neighborCount = (x: number, y: number) => directions.reduce(
    (count, [dx, dy]) => count + (maskAt(traceMask, x + dx, y + dy) ? 1 : 0),
    0,
  );

  const findNext = (point: TracePoint, previous?: TracePoint) => {
    let best: TracePoint | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    const vx = previous ? point.x - previous.x : 0;
    const vy = previous ? point.y - previous.y : 0;
    for (let radius = 1; radius <= 4; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const nx = point.x + dx;
          const ny = point.y + dy;
          if (!traceAt(nx, ny)) {
            continue;
          }
          const distance = Math.hypot(dx, dy);
          const turnPenalty = previous && distance > 0
            ? Math.max(0, 1 - ((vx * dx + vy * dy) / (Math.hypot(vx, vy) * distance || 1))) * 2.2
            : 0;
          const score = distance + turnPenalty + neighborCount(nx, ny) * 0.04;
          if (score < bestScore) {
            bestScore = score;
            best = { x: nx, y: ny };
          }
        }
      }
      if (best) {
        return best;
      }
    }
    return null;
  };

  const simplifyPoints = (points: TracePoint[]) => {
    const simplified: TracePoint[] = [];
    for (let index = 0; index < points.length; index += 1) {
      if (index % 4 === 0 || index === points.length - 1) {
        simplified.push(points[index]);
      }
    }
    return simplified;
  };

  const startPoints: TracePoint[] = [];
  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      if (traceMask[y * sampleSize + x] === 1 && neighborCount(x, y) <= 2) {
        startPoints.push({ x, y });
      }
    }
  }
  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      if (traceMask[y * sampleSize + x] === 1 && neighborCount(x, y) > 2) {
        startPoints.push({ x, y });
      }
    }
  }

  for (const start of startPoints) {
    if (!traceAt(start.x, start.y)) {
      continue;
    }
    const points: TracePoint[] = [];
    let current = start;
    let previous: TracePoint | undefined;
    for (let step = 0; step < 420; step += 1) {
      visited[current.y * sampleSize + current.x] = 1;
      points.push(current);
      const next = findNext(current, previous);
      if (!next) {
        break;
      }
      previous = current;
      current = next;
    }
    if (points.length < 10) {
      continue;
    }
    const simplified = simplifyPoints(points);
    const [first, ...rest] = simplified;
    const commands = [`M ${toCanvasX(first.x).toFixed(1)} ${toCanvasY(first.y).toFixed(1)}`];
    rest.forEach((point) => {
      commands.push(`L ${toCanvasX(point.x).toFixed(1)} ${toCanvasY(point.y).toFixed(1)}`);
    });
    paths.push({ path: commands.join(' '), strokeWidth: 2.1 });
    if (paths.length >= 220) {
      return paths;
    }
  }

  return paths;
}
