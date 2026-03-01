import React, {useEffect, useRef, useState} from 'react';
import {View, TouchableOpacity, Image, Modal, Pressable, Animated} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/utils/supabase';
import {router} from 'expo-router';
import MapView, {Marker, PROVIDER_GOOGLE, Region} from 'react-native-maps';
import Supercluster from 'supercluster';
import {useUserLocation, useDebouncer} from '@/hooks';
import {Body, Caption, Loader, H3, Subtitle} from '@/components';
import {Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';

// Helper to convert zoom level to radius (approximate)
const getRadiusFromZoom = (zoom: number) => Math.max(1, 40000 / Math.pow(2, zoom));

export default function MapScreen() {
  const {t} = useTranslation();
  const mapRef = useRef<MapView>(null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // State for fetching parameters (Debounced) — null until GPS resolves
  const [fetchParams, setFetchParams, debouncedParams] = useDebouncer<{zoom: number; radius: number; lat: number | null; lng: number | null}>(
    {zoom: 14, radius: 10, lat: null, lng: null},
    1000
  );

  // -- User Location Setup --
  const {location, isLoading: isLocationLoading} = useUserLocation();

  useEffect(() => {
    if (location) {
      const region = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setInitialRegion(region);
      setFetchParams({lat: location.latitude, lng: location.longitude, radius: 10, zoom: 14});
      mapRef.current?.animateToRegion(region, 1000);
    } else if (!isLocationLoading && !location) {
      // Permission denied or unavailable — show world view, no SF hardcode
      setInitialRegion({latitude: 20, longitude: 0, latitudeDelta: 60, longitudeDelta: 60});
    }
  }, [location, isLocationLoading]);

  const handleGoToMyLocation = () => {
    if (location) {
      const region = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      mapRef.current?.animateToRegion(region, 600);
    }
  };

  // Animate bottom sheet
  useEffect(() => {
    if (selectedItem) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedItem]);

  // -- Data Fetching --
  const {data: items, isLoading} = useQuery({
    staleTime: 1000 * 60 * 5,
    enabled: !!initialRegion && debouncedParams.lat !== null && debouncedParams.lng !== null,
    queryKey: ['map_items', debouncedParams.lat, debouncedParams.lng, debouncedParams.radius],
    queryFn: async () => {
      const radiusMeters = Math.round(debouncedParams.radius * 1000);
      console.log('Fetching map items:', {
        lat: debouncedParams.lat,
        lng: debouncedParams.lng,
        radiusKm: debouncedParams.radius,
        radiusMeters,
      });

      const {data, error} = await supabase.rpc('search_map_items', {
        user_lat: debouncedParams.lat!,
        user_lng: debouncedParams.lng!,
        radius_meters: radiusMeters,
      });

      if (error) {
        console.error('Map fetch error:', error);
        throw error;
      }
      console.log('Map items fetched:', data?.length);
      return data;
    },
  });

  const [currentZoom, setCurrentZoom] = useState(14);

  // Supercluster instance
  const index = new Supercluster({radius: 40, maxZoom: 20});
  const points = (items || [])
    .filter((i) => i.lat && i.lng)
    .map(
      (i) =>
        ({
          type: 'Feature',
          properties: {cluster: false, itemId: i.id, title: i.title, itemType: i.type},
          geometry: {type: 'Point', coordinates: [i.lng, i.lat]},
        }) as any
    );
  // @ts-ignore
  index.load(points);
  const clusters = index.getClusters([-180, -85, 180, 85], Math.floor(currentZoom));

  // -- Handlers --
  // Track current region for zooming
  const currentRegionRef = useRef<Region | null>(null);

  useEffect(() => {
    if (initialRegion) {
      currentRegionRef.current = initialRegion;
    }
  }, [initialRegion]);

  const onRegionChangeComplete = (region: Region) => {
    currentRegionRef.current = region;

    // Calculate zoom level approx
    const zoom = Math.round(Math.log(360 / region.longitudeDelta) / Math.LN2);
    setCurrentZoom(zoom);
    const newRadius = getRadiusFromZoom(zoom);

    setFetchParams({
      lat: parseFloat(region.latitude.toFixed(4)),
      lng: parseFloat(region.longitude.toFixed(4)),
      radius: newRadius,
      zoom: zoom,
    });
  };

  const handleClusterPress = (clusterId: number, coordinate: {latitude: number; longitude: number}) => {
    // Re-create index to get expansion zoom
    const index = new Supercluster({radius: 40, maxZoom: 20});
    const points = (items || [])
      .filter((i) => i.lat && i.lng)
      .map(
        (i) =>
          ({
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [i.lng, i.lat]},
            properties: {cluster: false, itemId: i.id, title: i.title, itemType: i.type},
          }) as any
      );
    // @ts-ignore
    index.load(points);
    const expansionZoom = index.getClusterExpansionZoom(clusterId);

    mapRef.current?.animateCamera({center: coordinate, zoom: expansionZoom}, {duration: 500});
  };

  if (!initialRegion)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Loader visible />
      </View>
    );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <MapView
        ref={mapRef}
        showsCompass
        style={{flex: 1}}
        showsUserLocation
        zoomControlEnabled
        showsMyLocationButton
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onRegionChangeComplete={onRegionChangeComplete}>
        {clusters.map((feature) => {
          const isCluster = feature.properties.cluster;
          const coordinate = {
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
          };

          if (isCluster) {
            return (
              <Marker key={`cluster-${feature.id}`} coordinate={coordinate} onPress={() => handleClusterPress(feature.id as number, coordinate)}>
                <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-orange-500">
                  <Body className="font-bold text-white">{feature.properties.point_count}</Body>
                </View>
              </Marker>
            );
          }

          return (
            <Marker
              coordinate={coordinate}
              title={feature.properties.title}
              key={`item-${feature.properties.itemId}`}
              pinColor={feature.properties.itemType === 'event' ? '#EF4444' : '#00594f'}
              onPress={() => {
                // Find the full item data
                const fullItem = items?.find((item) => item.id === feature.properties.itemId);
                if (fullItem) {
                  setSelectedItem(fullItem);
                }
              }}
            />
          );
        })}
      </MapView>

      {/* My Location FAB */}
      {location && (
        <TouchableOpacity
          onPress={handleGoToMyLocation}
          className="bottom-safe-offset-8 absolute right-4 h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg"
          style={{elevation: 5}}>
          <Ionicons name="locate" size={22} color="#00594f" />
        </TouchableOpacity>
      )}

      {/* Loading Indicator */}
      <Loader visible={isLoading} />

      {/* Legend */}
      <View className="top-safe-offset-4 absolute left-4 rounded-lg bg-white/90 p-3 shadow-lg">
        <View className="mb-2 flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-full bg-primary" />
          <Caption className="font-medium text-gray-700">{t('map.services')}</Caption>
        </View>
        <View className="mb-2 flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-full bg-secondary" />
          <Caption className="font-medium text-gray-700">{t('map.events')}</Caption>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-full bg-orange-500" />
          <Caption className="font-medium text-gray-700">{t('map.cluster')}</Caption>
        </View>
      </View>

      {/* Bottom Sheet Modal */}
      <Modal visible={!!selectedItem} transparent animationType="none" onRequestClose={() => setSelectedItem(null)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setSelectedItem(null)}>
          <Animated.View
            style={{
              transform: [{translateY: slideAnim.interpolate({inputRange: [0, 1], outputRange: [400, 0]})}],
            }}
            className="absolute bottom-0 left-0 right-0">
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
                {selectedItem && (
                  <View className="flex-row gap-4">
                    {/* Image - Larger & Cleaner */}
                    <View className="h-28 w-28 overflow-hidden rounded-xl bg-gray-50 shadow-sm">
                      {selectedItem.images && selectedItem.images.length > 0 ? (
                        <Image
                          source={{uri: supabase.storage.from('images').getPublicUrl(selectedItem.images[0]).data.publicUrl}}
                          className="h-full w-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="h-full w-full items-center justify-center">
                          <Ionicons name="image-outline" size={32} color="#E5E7EB" />
                        </View>
                      )}
                    </View>

                    {/* Content Column */}
                    <View className="flex-1 justify-between py-1">
                      {/* Close Button - Absolute Top Right */}
                      <TouchableOpacity
                        onPress={() => setSelectedItem(null)}
                        className="absolute -right-1 -top-1 z-10 p-2 opacity-60"
                        activeOpacity={0.7}>
                        <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                      </TouchableOpacity>

                      {/* Header Section */}
                      <View className="pr-8">
                        <H3 className="mb-0.5 text-lg font-bold text-gray-900" numberOfLines={1}>
                          {selectedItem.title}
                        </H3>

                        {/* Provider & Rating Row */}
                        <View className="flex-row items-center gap-1.5">
                          {selectedItem.provider_name && (
                            <Caption className="text-sm font-medium text-gray-500" numberOfLines={1}>
                              {selectedItem.provider_name}
                            </Caption>
                          )}
                          <View className="h-1 w-1 rounded-full bg-gray-300" />
                          <View className="flex-row items-center gap-1">
                            <Ionicons name="star" size={12} color="#F59E0B" />
                            <Caption className="text-xs font-bold text-gray-700">
                              {selectedItem.rating > 0 ? selectedItem.rating.toFixed(1) : 'New'}
                            </Caption>
                          </View>
                        </View>
                      </View>

                      {/* Footer Section: Price, Distance, Action */}
                      <View className="flex-row items-end justify-between pt-3">
                        <View>
                          {selectedItem.price ? (
                            <Subtitle className="text-lg font-extrabold text-primary">${selectedItem.price}</Subtitle>
                          ) : (
                            <Subtitle className="text-lg font-extrabold text-gray-400">-</Subtitle>
                          )}
                          {selectedItem.distance && (
                            <Caption className="mt-0.5 text-xs text-gray-400">
                              <Ionicons name="location-sharp" size={10} color="#9CA3AF" />{' '}
                              {selectedItem.distance < 1000
                                ? `${Math.round(selectedItem.distance)}m`
                                : `${(selectedItem.distance / 1000).toFixed(1)}km`}
                            </Caption>
                          )}
                        </View>

                        <TouchableOpacity
                          onPress={() => {
                            const path = selectedItem.type === 'event' ? `/(user)/events/${selectedItem.id}` : `/(user)/services/${selectedItem.id}`;
                            setSelectedItem(null);
                            router.push(path as any);
                          }}
                          className="flex-row items-center gap-1 rounded-full bg-primary px-5 py-2.5 shadow-sm transition-transform active:scale-95"
                          activeOpacity={0.9}>
                          <Caption className="font-bold text-white">
                            {selectedItem.type === 'event' ? t('events.bookNow') : t('bookings.bookingDetails')}
                          </Caption>
                          <Ionicons name="arrow-forward" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
