"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../context/LanguageContext";
import {
  MapPin,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Search,
  Compass,
  Layers,
  Sparkles,
  Map,
  X,
  AlertCircle,
} from "lucide-react";

interface CityItem {
  id: string;
  name_ar: string;
  name_en: string;
  is_active: boolean;
  geojson: string | null;
  created_at: string;
  updated_at: string;
}

const PRESET_POLYGONS = {
  riyadh: JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [46.50, 24.55],
        [46.90, 24.55],
        [46.90, 24.95],
        [46.50, 24.95],
        [46.50, 24.55],
      ],
    ],
  }, null, 2),
  jeddah: JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [39.10, 21.30],
        [39.35, 21.30],
        [39.35, 21.85],
        [39.10, 21.85],
        [39.10, 21.30],
      ],
    ],
  }, null, 2),
  dammam: JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [49.95, 26.25],
        [50.25, 26.25],
        [50.25, 26.55],
        [49.95, 26.55],
        [49.95, 26.25],
      ],
    ],
  }, null, 2),
};

export default function AdminCitiesPage() {
  const { t, isRTL } = useLanguage();

  const [cities, setCities] = useState<CityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // نموذج إضافة / تعديل المدينة
  const [showModal, setShowModal] = useState(false);
  const [editingCity, setEditingCity] = useState<CityItem | null>(null);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [geojsonInput, setGeojsonInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // أداة فحص إحداثية نقطة (city_for_point)
  const [testLat, setTestLat] = useState("24.7136");
  const [testLng, setTestLng] = useState("46.6753");
  const [pointResult, setPointResult] = useState<string | null>(null);
  const [checkingPoint, setCheckingPoint] = useState(false);

  const loadCities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_cities_geojson");
      if (error) throw error;
      setCities(data || []);
    } catch (err: any) {
      console.error("خطأ في جلب المدن:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCities();
  }, []);

  const handleOpenAdd = () => {
    setEditingCity(null);
    setNameAr("");
    setNameEn("");
    setIsActive(true);
    setGeojsonInput(PRESET_POLYGONS.riyadh);
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (city: CityItem) => {
    setEditingCity(city);
    setNameAr(city.name_ar);
    setNameEn(city.name_en);
    setIsActive(city.is_active);
    setGeojsonInput(city.geojson || PRESET_POLYGONS.riyadh);
    setModalError(null);
    setShowModal(true);
  };

  const handleSaveCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    try {
      // التحقق من صحة JSON
      try {
        JSON.parse(geojsonInput);
      } catch {
        throw new Error("صيغة GeoJSON غير صالحة. يرجى التأكد من كتابة JSON مضلع صحيح.");
      }

      const { data, error } = await (supabase as any).rpc("admin_save_city", {
        p_id: editingCity?.id || null,
        p_name_ar: nameAr.trim(),
        p_name_en: nameEn.trim(),
        p_is_active: isActive,
        p_geojson: geojsonInput.trim(),
      });

      if (error) throw error;

      setShowModal(false);
      await loadCities();
    } catch (err: any) {
      setModalError(err.message || "حدث خطأ أثناء حفظ المدينة");
    } finally {
      setSaving(false);
    }
  };

  // فحص نقطة في الخادم عبر ST_Covers
  const handleTestPoint = async () => {
    setCheckingPoint(true);
    setPointResult(null);

    try {
      const lat = parseFloat(testLat);
      const lng = parseFloat(testLng);

      if (isNaN(lat) || isNaN(lng)) {
        setPointResult("خطأ: يرجى إدخال أرقام صحيحة لخط العرض والطول");
        return;
      }

      const { data, error } = await supabase.rpc("city_for_point", { lat, lng });
      if (error) throw error;

      if (data && data.length > 0) {
        setPointResult(`✓ تقع داخل نطاق: ${data[0].name_ar} (${data[0].name_en})`);
      } else {
        setPointResult("✗ النقطة تقع خارج نطاق تغطية جميع المدن النشطة");
      }
    } catch (err: any) {
      setPointResult(`خطأ في الفحص: ${err.message}`);
    } finally {
      setCheckingPoint(false);
    }
  };

  const filteredCities = cities.filter(
    (c) =>
      c.name_ar.includes(searchQuery) ||
      c.name_en.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* الترويسة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            <span>{t.admin.cities.title}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            تحديد نطاقات التوصيل الجغرافية ومضلعات المدن طبقاً للمتطلب (DSP-002) باستخدام PostGIS ومكتبة Terra Draw.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.admin.cities.addCity}</span>
        </button>
      </div>

      {/* أداة فحص الإحداثيات (DSP-002 Verification) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">
            {t.admin.cities.testCoordinates} (DSP-002)
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          اختبار مباشر لدالة الخادم `city_for_point` باستخدام خوارزمية PostGIS `ST_Covers` للتحقق من شمول أي نقطة جغرافية.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">خط العرض (Latitude)</label>
            <input
              type="text"
              value={testLat}
              onChange={(e) => setTestLat(e.target.value)}
              placeholder="24.7136"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">خط الطول (Longitude)</label>
            <input
              type="text"
              value={testLng}
              onChange={(e) => setTestLng(e.target.value)}
              placeholder="46.6753"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleTestPoint}
              disabled={checkingPoint}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
            >
              {checkingPoint ? "جاري الفحص..." : "فحص التغطية الآن"}
            </button>
          </div>
        </div>

        {/* نقاط ديمو سريعة */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800/60 text-xs">
          <span className="text-slate-500 text-[11px] self-center">نقاط تجريبية سريعة:</span>
          <button
            onClick={() => {
              setTestLat("24.7136");
              setTestLng("46.6753");
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
          >
            برج المملكة (الرياض)
          </button>
          <button
            onClick={() => {
              setTestLat("21.5433");
              setTestLng("39.1728");
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
          >
            نافورة الملك فهد (جدة)
          </button>
          <button
            onClick={() => {
              setTestLat("28.0000");
              setTestLng("44.0000");
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
          >
            نقطة خارج التغطية
          </button>
        </div>

        {pointResult && (
          <div
            className={`mt-3 p-3 rounded-xl border text-xs font-medium ${
              pointResult.startsWith("✓")
                ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
                : "bg-amber-950/60 border-amber-800/60 text-amber-300"
            }`}
          >
            {pointResult}
          </div>
        )}
      </div>

      {/* قائمة المدن */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-white">المدن المسجلة في النظام ({cities.length})</span>
          </div>

          <div className="relative w-48">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في المدن..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2" />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">جاري تحميل المدن...</div>
        ) : filteredCities.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">لا توجد مدن مسجلة</div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredCities.map((city) => (
              <div key={city.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-white text-sm">{city.name_ar}</span>
                    <span className="text-xs text-slate-400 font-mono">({city.name_en})</span>
                    {city.is_active ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>نشطة</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-medium flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        <span>معطلة</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <Map className="w-3.5 h-3.5 text-blue-400" />
                    <span>المضلع الجغرافي:</span>
                    <span className="font-mono text-slate-300">
                      {city.geojson ? "مضلع محدد (MultiPolygon Geography)" : "غير محدد"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEdit(city)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t.common.edit}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* نافذة إضافة / تعديل المدينة */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingCity ? t.admin.cities.editCity : t.admin.cities.addCity}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCity} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">{t.admin.cities.cityNameAr}</label>
                  <input
                    type="text"
                    required
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="الرياض"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">{t.admin.cities.cityNameEn}</label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="Riyadh"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>{t.admin.cities.active}</span>
                </label>
              </div>

              {/* محرر المضلع الجغرافي */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-medium">{t.admin.cities.boundary}</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGeojsonInput(PRESET_POLYGONS.riyadh)}
                      className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-blue-400 hover:bg-slate-700"
                    >
                      مضلع الرياض
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeojsonInput(PRESET_POLYGONS.jeddah)}
                      className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-blue-400 hover:bg-slate-700"
                    >
                      مضلع جدة
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeojsonInput(PRESET_POLYGONS.dammam)}
                      className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-blue-400 hover:bg-slate-700"
                    >
                      مضلع الدمام
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  يتم تخزين المضلع كـ MultiPolygon داخل PostGIS. يمكنك تعديل الإحداثيات أو استيراد مضلعات تجريبية جاهزة.
                </p>

                <textarea
                  rows={6}
                  required
                  value={geojsonInput}
                  onChange={(e) => setGeojsonInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-emerald-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition"
                >
                  {saving ? "جاري الحفظ..." : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
