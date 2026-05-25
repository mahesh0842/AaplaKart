// Native version of LocationMap — uses react-native-maps.
// Web uses LocationMap.web.jsx instead.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { COLORS } from '../../utils/constants';

const LocationMap = ({ latitude, longitude, address = '', height = 180 }) => {
  if (latitude == null || longitude == null) {
    return null;
  }

  const region = {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        region={region}
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title="Delivery Location"
          description={address}
          pinColor={COLORS.primary}
        >
          <Callout>
            <View style={styles.callout}>
              <MapView
                style={styles.map}
                region={region}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker
                  coordinate={{ latitude, longitude }}
                  pinColor={COLORS.primary}
                />
              </MapView>
            </View>
          </Callout>
        </Marker>
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map: {
    flex: 1,
  },
  callout: {
    width: 180,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export default LocationMap;
