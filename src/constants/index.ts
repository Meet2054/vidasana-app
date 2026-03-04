export * from './LegalContent';
import {Enums} from '@/types/supabase';

export type WeekDay = Enums<'week_day'>;
export type LanguageCode = 'en' | 'es' | 'fr';

export const LANGUAGES: {code: LanguageCode; label: string}[] = [
  {code: 'en', label: 'English'},
  {code: 'es', label: 'Spanish'},
  {code: 'fr', label: 'French'},
];

export const getDays = (t: any): {label: string; value: WeekDay}[] => [
  {label: t('days.mon'), value: 'mon'},
  {label: t('days.tue'), value: 'tue'},
  {label: t('days.wed'), value: 'wed'},
  {label: t('days.thu'), value: 'thu'},
  {label: t('days.fri'), value: 'fri'},
  {label: t('days.sat'), value: 'sat'},
  {label: t('days.sun'), value: 'sun'},
];

export const ID_TYPES = [
  {label: 'SSN Proof', value: 'ssn'},
  {label: 'Passport', value: 'passport'},
  {label: 'State ID', value: 'state_id'},
  {label: "Driver's License", value: 'driver_license'},
];

export const PROVIDER_TYPES = [
  {label: 'Company', value: 'company'},
  {label: 'Individual', value: 'individual'},
];
