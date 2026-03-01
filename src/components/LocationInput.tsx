import React, {useState} from 'react';
import {Body, Caption} from './Typography';
import {Feather} from '@expo/vector-icons';
import {View, TouchableOpacity, TextInput} from 'react-native';
import {LocationPickerModal} from './modals/LocationPickerModal';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {Control, Controller, UseFormWatch, UseFormSetValue} from 'react-hook-form';
import {useUserLocation} from '@/hooks';
import {useTranslation} from 'react-i18next';

type Props = {
  label: string;
  error?: string;
  control: Control<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
};

export function LocationInput({control, setValue, watch, label, error}: Props) {
  const {t} = useTranslation();
  const {location: deviceLocation} = useUserLocation();
  const [isLocationPickerVisible, setLocationPickerVisible] = useState(false);
  const lat = watch('lat');
  const lng = watch('lng');

  // Compose the initial location: prefer existing form value, fall back to device GPS
  const pickerInitialLocation = lat && lng ? {lat, lng} : deviceLocation ? {lat: deviceLocation.latitude, lng: deviceLocation.longitude} : null;

  return (
    <View className="mb-6">
      <Body className="mb-2 font-nunito-bold text-sm text-gray-700">{label}</Body>
      <View className="mb-4">
        <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('common.address')}</Body>
        <Controller
          control={control}
          name="address"
          render={({field: {onChange, value}}) => (
            <View className="rounded-lg border border-gray-300 bg-white p-3">
              <TextInput
                className="font-nunito text-base text-gray-900"
                placeholder={t('common.addressPlaceholder')}
                value={value}
                onChangeText={onChange}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{minHeight: 100}}
              />
            </View>
          )}
        />
      </View>

      <Controller
        name="lat"
        control={control}
        render={() => (
          <View>
            {lat && lng ? (
              <View className="mb-3 h-40 overflow-hidden rounded-xl bg-gray-100">
                <MapView
                  style={{flex: 1}}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  scrollEnabled={false}
                  rotateEnabled={false}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={{latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01}}>
                  <Marker coordinate={{latitude: lat, longitude: lng}} />
                </MapView>
                <TouchableOpacity
                  className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center bg-black/10"
                  onPress={() => setLocationPickerVisible(true)}>
                  <View className="items-center justify-center rounded-full bg-white/90 p-2 shadow-sm">
                    <Feather name="edit-2" size={20} color="#00594f" />
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={() => setLocationPickerVisible(true)}
              className={`flex-row items-center justify-center rounded-xl border border-dashed p-4 ${
                lat ? 'border-primary/30 bg-primary/5' : 'border-gray-300 bg-gray-50'
              }`}>
              <Feather name="map-pin" size={20} color={lat ? '#00594f' : '#9CA3AF'} />
              <Body className={`ml-2 font-nunito-bold ${lat ? 'text-primary' : 'text-gray-500'}`}>
                {lat ? t('map.changeLocation') : t('map.selectLocation')}
              </Body>
            </TouchableOpacity>
          </View>
        )}
      />
      {error && <Caption className="mt-1 text-red-500">{error}</Caption>}

      <LocationPickerModal
        visible={isLocationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        initialLocation={pickerInitialLocation}
        onConfirm={(loc) => {
          setValue('lat', loc.lat, {shouldValidate: true});
          setValue('lng', loc.lng, {shouldValidate: true});
        }}
      />
    </View>
  );
}
