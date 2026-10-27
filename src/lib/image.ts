/** Downscales an image file to a JPEG blob no larger than `maxEdge` px. */
export async function downscaleImage(
  file: File,
  maxEdge = 1600,
): Promise<{ blob: Blob; width: number; height: number }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That image is larger than 15 MB.');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const width = Math.max(1, Math.round(bmp.width * scale));
  const height = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Could not process that image.');
  return { blob, width, height };
}
