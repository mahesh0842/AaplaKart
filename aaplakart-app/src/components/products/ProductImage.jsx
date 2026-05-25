// GUI category: Products. Loads Firebase Storage product photos with loading and error placeholders.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { getProductImageUrl } from '../../services/imageService';
import { COLORS } from '../../utils/constants';

const ProductImage = ({ firebaseImagePath, image, style, imageStyle }) => {
  const resolvedPath = firebaseImagePath || image || '';
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    const loadImage = async () => {
      setLoading(true);
      setError(false);

      try {
        const url = await getProductImageUrl(resolvedPath);

        if (!active) {
          return;
        }

        setImageUrl(url);
        setError(!url);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(true);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      active = false;
    };
  }, [resolvedPath]);

  return (
    <View style={[styles.container, style]}>
      {imageUrl && !error ? (
        <Image source={{ uri: imageUrl }} resizeMode="cover" style={[styles.image, imageStyle]} />
      ) : (
        <View style={styles.placeholder}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.fallback}>🧺</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  fallback: {
    fontSize: 28,
  },
});

export default ProductImage;

