/**
 * دوال مساعدة لبيانات وتطبيقات المندوب
 */

export type DriverLevel = 'new' | 'under_probation' | 'silver' | 'gold' | 'platinum';
export type VehicleType = 'car' | 'motorcycle';
export type DriverStatus = 'incomplete' | 'pending_approval' | 'approved' | 'suspended' | 'rejected';

export function formatDriverLevel(level: DriverLevel | string, lang: 'ar' | 'en' = 'ar'): string {
  const translations: Record<string, { ar: string; en: string }> = {
    new: { ar: 'جديد', en: 'New' },
    under_probation: { ar: 'تحت المراقبة', en: 'Under Probation' },
    silver: { ar: 'فضي', en: 'Silver' },
    gold: { ar: 'ذهبي', en: 'Gold' },
    platinum: { ar: 'ماسي', en: 'Platinum' },
  };

  const item = translations[level];
  return item ? item[lang] : level;
}

export function formatVehicleType(type: VehicleType | string, lang: 'ar' | 'en' = 'ar'): string {
  const translations: Record<string, { ar: string; en: string }> = {
    car: { ar: 'سيارة', en: 'Car' },
    motorcycle: { ar: 'دراجة نارية', en: 'Motorcycle' },
  };

  const item = translations[type];
  return item ? item[lang] : type;
}

export function formatDriverStatus(status: DriverStatus | string, lang: 'ar' | 'en' = 'ar'): string {
  const translations: Record<string, { ar: string; en: string }> = {
    incomplete: { ar: 'غير مكتمل', en: 'Incomplete' },
    pending_approval: { ar: 'قيد المراجعة', en: 'Pending Approval' },
    approved: { ar: 'معتمد', en: 'Approved' },
    suspended: { ar: 'موقوف مؤقتاً', en: 'Suspended' },
    rejected: { ar: 'مرفوض', en: 'Rejected' },
  };

  const item = translations[status];
  return item ? item[lang] : status;
}

/**
 * رابط الانتقال لتطبيق الملاحة المفضل (DRV-021)
 */
export function getNavigationUrl(lat: number, lng: number, label?: string): string {
  const encodedLabel = encodeURIComponent(label || 'Delivery Point');
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving`;
}
