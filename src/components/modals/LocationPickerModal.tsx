import React, {useState, useEffect} from 'react';
import {Modal, View, TouchableOpacity, ActivityIndicator} from 'react-native';
import MapView, {Region, PROVIDER_GOOGLE} from 'react-native-maps';
import {useUserLocation} from '@/hooks';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {H3, Caption, Body} from '../Typography';

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: {lat: number; lng: number}) => void;
  initialLocation?: {lat: number; lng: number} | null;
}

export function LocationPickerModal({visible, onClose, onConfirm, initialLocation}: LocationPickerModalProps) {
  const {t} = useTranslation();
  const mapRef = React.useRef<MapView>(null);

  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(initialLocation || null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {location: userLocation, isLoading: isLocLoading} = useUserLocation();

  useEffect(() => {
    if (visible && !initialLocation) {
      if (userLocation) {
        setInitialRegion({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01, // Zoom level 15 approx
          longitudeDelta: 0.01,
        });
        setCurrentLocation({lat: userLocation.latitude, lng: userLocation.longitude});
        setIsLoading(false);
      } else if (!isLocLoading && !userLocation) {
        // Default if location failed or denied
        setInitialRegion({latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.05, longitudeDelta: 0.05});
        setIsLoading(false);
      }
    } else if (visible && initialLocation) {
      setInitialRegion({
        latitude: initialLocation.lat,
        longitude: initialLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setIsLoading(false);
    }
  }, [visible, initialLocation, userLocation, isLocLoading]);

  const onRegionChangeComplete = (region: Region) => {
    setCurrentLocation({
      lat: region.latitude,
      lng: region.longitude,
    });
  };

  const handleConfirm = () => {
    if (currentLocation) {
      onConfirm(currentLocation);
      onClose();
    }
  };

  const handleZoomIn = () => {
    if (!mapRef.current) return;
    mapRef.current.getCamera().then((camera) => {
      if (camera && camera.zoom) {
        mapRef.current?.animateCamera({zoom: camera.zoom + 1});
      }
    });
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    mapRef.current.getCamera().then((camera) => {
      if (camera && camera.zoom) {
        mapRef.current?.animateCamera({zoom: camera.zoom - 1});
      }
    });
  };

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="pt-safe flex-row items-center justify-between border-b border-gray-100 px-4 py-2">
          <TouchableOpacity onPress={onClose} className="p-2">
            <Feather name="x" size={24} color="#374151" />
          </TouchableOpacity>
          <H3 className="text-lg font-bold text-gray-900">Pick Location</H3>
          <View style={{width: 40}} />
        </View>

        <View className="relative flex-1">
          {isLoading || !initialRegion ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#00594f" />
            </View>
          ) : (
            <>
              <MapView
                ref={mapRef}
                style={{flex: 1}}
                provider={PROVIDER_GOOGLE}
                initialRegion={initialRegion}
                onRegionChangeComplete={onRegionChangeComplete}
                showsUserLocation
                showsMyLocationButton
                zoomControlEnabled={true}
              />
              {/* Center Marker Overlay */}
              <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center">
                <View className="mb-8">
                  <Feather name="map-pin" size={40} color="#00594f" />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Footer Info */}
        <View className="mb-safe border-t border-gray-100 bg-white px-6 py-4">
          <Caption className="mb-4 text-center text-xs text-gray-500">Move the map to place the pin at the service location.</Caption>
          <TouchableOpacity onPress={handleConfirm} className="w-full items-center rounded-2xl bg-primary py-4 shadow-lg shadow-green-100">
            <Body className="font-nunito-bold text-lg text-white">Set Location</Body>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
