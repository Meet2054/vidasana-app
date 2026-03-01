import {useState, useEffect} from 'react';
import {requestForegroundPermissionsAsync, getCurrentPositionAsync, watchPositionAsync, Accuracy, PermissionStatus} from 'expo-location';

export const useUserLocation = () => {
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cleanup = () => {};

    const start = async () => {
      try {
        const {granted, status: permStatus} = await requestForegroundPermissionsAsync();
        setStatus(permStatus);

        if (!granted) {
          setErrorMsg('Permission to access location was denied');
          setIsLoading(false);
          return;
        }

        // Get an immediate fix first so the UI isn't blank while the watcher settles
        const initial = await getCurrentPositionAsync({accuracy: Accuracy.Balanced});
        setLocation({latitude: initial.coords.latitude, longitude: initial.coords.longitude});
        setIsLoading(false);

        // Then keep tracking for live updates
        const subscription = await watchPositionAsync({accuracy: Accuracy.High}, ({coords}) => {
          setLocation({latitude: coords.latitude, longitude: coords.longitude});
        });

        cleanup = subscription.remove;
      } catch (e) {
        console.log('useUserLocation error:', e);
        setErrorMsg('Error fetching location');
        setIsLoading(false);
      }
    };

    start();

    return () => cleanup();
  }, []);

  return {location, errorMsg, status, isLoading};
};
