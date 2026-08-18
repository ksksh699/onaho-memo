// アップロード前に画像を軽量化する共通ユーティリティ。
// スマホのカメラ写真などをそのままアップロードすると容量が大きくなりがちなので、
// ブラウザ内(Canvas)でリサイズ・再圧縮してからSupabase Storageに送る。

function canEncodeWebp() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

async function loadDrawable(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file);
    } catch {
      // HEICなど一部形式はcreateImageBitmapが失敗することがあるので<img>にフォールバック
    }
  }
  return loadImageElement(file);
}

/**
 * 画像ファイルをリサイズ・再圧縮したFileを返す。
 * 失敗した場合や、圧縮後の方が大きくなってしまった場合は元のファイルをそのまま返す。
 *
 * @param {File} file
 * @param {{ maxWidth?: number, maxHeight?: number, quality?: number }} options
 * @returns {Promise<File>}
 */
export async function compressImage(file, options = {}) {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = options;

  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  // GIFはアニメーションの可能性があるため圧縮対象外(そのまま使う)
  if (file.type === 'image/gif') return file;

  try {
    const drawable = await loadDrawable(file);
    const width = drawable.width;
    const height = drawable.height;
    if (!width || !height) return file;

    let targetWidth = width;
    let targetHeight = height;
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      targetWidth = Math.max(1, Math.round(width * ratio));
      targetHeight = Math.max(1, Math.round(height * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(drawable, 0, 0, targetWidth, targetHeight);

    const useWebp = canEncodeWebp();
    const mimeType = useWebp ? 'image/webp' : 'image/jpeg';
    const ext = useWebp ? 'webp' : 'jpg';

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if (!blob) return file;

    // 圧縮した結果、元より大きくなってしまった場合は元ファイルを使う
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^./\\]+$/, '') || 'image';
    return new File([blob], `${baseName}.${ext}`, { type: mimeType });
  } catch (err) {
    console.error('画像の圧縮に失敗しました。元のファイルをアップロードします。', err);
    return file;
  }
}
