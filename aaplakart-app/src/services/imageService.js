// GUI category: App services. Resolves Firebase Storage image paths into cached download URLs.
import { ref, getDownloadURL } from 'firebase/storage';
import { firebaseReady, storage } from './firebase';

const imageCache = new Map();

export const getProductImageUrl = async (path, forceRefresh = false) => {
  if (!path || !firebaseReady || !storage) {
    return null;
  }

  if (!forceRefresh && imageCache.has(path)) {
    return imageCache.get(path);
  }

  const downloadUrl = await getDownloadURL(ref(storage, path));
  imageCache.set(path, downloadUrl);
  return downloadUrl;
};

export const prefetchProductImages = async (products = [], forceRefresh = false) => {
  const results = await Promise.allSettled(
    products.map(async (product) => {
      const path = product.image || product.firebaseImagePath;
      const url = await getProductImageUrl(
        path,
        forceRefresh
      );

      return {
        id: product.id,
        path,
        url,
      };
    })
  );

  return results;
};

export const clearImageCache = () => {
  imageCache.clear();
};

