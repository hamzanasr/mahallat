import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatMoney, formatCaloriesDisplay } from "@mahallat/shared";
import { useLanguage } from "../context/LanguageContext";

export interface MenuItemSize {
  id: string;
  name_ar: string;
  name_en: string;
  price_delta_halalas: number;
  customer_price_halalas: number;
  calories_value?: number | null;
  is_default?: boolean;
}

export interface MenuItemOption {
  id: string;
  name_ar: string;
  name_en: string;
  price_delta_halalas: number;
  calories_delta?: number | null;
}

export interface MenuItemOptionGroup {
  id: string;
  name_ar: string;
  name_en: string;
  is_required: boolean;
  min_selectable: number;
  max_selectable: number;
  options: MenuItemOption[];
}

export interface MenuItemData {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
  description_en?: string | null;
  image_url?: string | null;
  calories?: number | null;
  calories_value?: number | null;
  is_calories_exempt?: boolean | null;
  is_sfda_exempt?: boolean | null;
  is_high_salt?: boolean | null;
  caffeine_mg?: number | null;
  allergens?: string[] | null;
  base_price_halalas?: number;
  customer_price_halalas: number;
  sizes?: MenuItemSize[];
  option_groups?: MenuItemOptionGroup[];
}

export interface SelectedCustomization {
  item: MenuItemData;
  size: MenuItemSize | null;
  options: MenuItemOption[];
  quantity: number;
  note: string;
  totalPriceHalalas: number;
}

interface ItemCustomizationModalProps {
  visible: boolean;
  item: MenuItemData | null;
  onClose: () => void;
  onAddToCart: (customization: SelectedCustomization) => void;
}

export default function ItemCustomizationModal({
  visible,
  item,
  onClose,
  onAddToCart,
}: ItemCustomizationModalProps) {
  const { lang, isRTL } = useLanguage();

  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState<string>("");

  // إعادة ضبط الحالة عند فتح صنف جديد
  useEffect(() => {
    if (item) {
      setQuantity(1);
      setNote("");
      // تحديد الحجم الافتراضي إن وجد
      if (item.sizes && item.sizes.length > 0) {
        const defaultSize = item.sizes.find((s) => s.is_default) || item.sizes[0];
        setSelectedSizeId(defaultSize.id);
      } else {
        setSelectedSizeId(null);
      }

      // ضبط خيارات المجموعات
      const initialOptions: Record<string, string[]> = {};
      if (item.option_groups) {
        item.option_groups.forEach((grp) => {
          initialOptions[grp.id] = [];
        });
      }
      setSelectedOptionIds(initialOptions);
    }
  }, [item, visible]);

  if (!item) return null;

  const itemName = lang === "ar" ? item.name_ar : item.name_en;
  const itemDesc = lang === "ar" ? item.description_ar : item.description_en;

  // السعرات المنسقة عبر دالة الشيرد المعتمدة من هيئة الغذاء والدواء SFDA (CUS-019)
  const caloriesText = formatCaloriesDisplay({
    caloriesValue: item.calories_value ?? item.calories,
    variantsCalories: item.sizes?.map((s) => s.calories_value),
    isSfdaExempt: Boolean(item.is_sfda_exempt ?? item.is_calories_exempt),
    lang: lang === "ar" ? "ar" : "en",
  });

  // الحجم المختار
  const selectedSize = useMemo(() => {
    if (!item.sizes || item.sizes.length === 0) return null;
    return item.sizes.find((s) => s.id === selectedSizeId) || null;
  }, [item.sizes, selectedSizeId]);

  // قائمة كل الخيارات المختارة
  const allSelectedOptions = useMemo(() => {
    const list: MenuItemOption[] = [];
    if (!item.option_groups) return list;

    item.option_groups.forEach((grp) => {
      const selectedIds = selectedOptionIds[grp.id] || [];
      grp.options.forEach((opt) => {
        if (selectedIds.includes(opt.id)) {
          list.push(opt);
        }
      });
    });
    return list;
  }, [item.option_groups, selectedOptionIds]);

  // حساب سعر الوحدة الإجمالي (للعرض والجمع التقديري)
  const unitPriceHalalas = useMemo(() => {
    // السعر الأساسي للعميل من الخادم
    let base = item.customer_price_halalas;
    if (selectedSize) {
      base = selectedSize.customer_price_halalas;
    }
    // إضافة رسوم الخيارات
    const optionsCost = allSelectedOptions.reduce((acc, opt) => acc + (opt.price_delta_halalas || 0), 0);
    return base + optionsCost;
  }, [item.customer_price_halalas, selectedSize, allSelectedOptions]);

  const totalPriceHalalas = unitPriceHalalas * quantity;

  // التحقق من صحة الاختيارات (CUS-005)
  const validationError = useMemo(() => {
    // 1. فحص الحجم الإلزامي
    if (item.sizes && item.sizes.length > 0 && !selectedSizeId) {
      return lang === "ar" ? "يرجى اختيار الحجم المطلوب" : "Please select a size";
    }

    // 2. فحص المجموعات الإلزامية والحد الأدنى
    if (item.option_groups) {
      for (const grp of item.option_groups) {
        const grpName = lang === "ar" ? grp.name_ar : grp.name_en;
        const count = (selectedOptionIds[grp.id] || []).length;

        if (grp.is_required && count < grp.min_selectable) {
          const diff = grp.min_selectable - count;
          return lang === "ar"
            ? `يرجى اختيار ${grp.min_selectable === 1 ? "" : grp.min_selectable + " من"} «${grpName}»`
            : `Please select ${grp.min_selectable} from "${grpName}"`;
        }
      }
    }

    return null;
  }, [item.sizes, selectedSizeId, item.option_groups, selectedOptionIds, lang]);

  const isValid = validationError === null;

  // التعامل مع اختيار خيار من مجموعة
  const toggleOption = (groupId: string, optionId: string, maxSelectable: number) => {
    setSelectedOptionIds((prev) => {
      const current = prev[groupId] || [];
      if (current.includes(optionId)) {
        return {
          ...prev,
          [groupId]: current.filter((id) => id !== optionId),
        };
      } else {
        if (maxSelectable === 1) {
          return {
            ...prev,
            [groupId]: [optionId],
          };
        } else if (current.length < maxSelectable) {
          return {
            ...prev,
            [groupId]: [...current, optionId],
          };
        }
        return prev;
      }
    });
  };

  const handleAdd = () => {
    if (!isValid) return;
    onAddToCart({
      item,
      size: selectedSize,
      options: allSelectedOptions,
      quantity,
      note: note.trim(),
      totalPriceHalalas,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* شريط الإغلاق */}
        <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {itemName}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* صورة الصنف إن وجدت */}
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="cover" />
          ) : null}

          {/* تفاصيل الصنف الأساسية */}
          <View style={styles.infoSection}>
            <Text style={[styles.nameText, { textAlign: isRTL ? "right" : "left" }]}>{itemName}</Text>

            {itemDesc ? (
              <Text style={[styles.descText, { textAlign: isRTL ? "right" : "left" }]}>{itemDesc}</Text>
            ) : null}

            {/* صف السعر والسعرات: شرط CUS-019 (السعرات بجوار السعر بخط لا يصغر عن خطهما) */}
            <View style={[styles.priceCaloriesRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text style={styles.priceHighlight}>
                {formatMoney(item.customer_price_halalas)}
              </Text>

              {caloriesText ? (
                <View style={[styles.caloriesBadge, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Ionicons name="flame" size={18} color="#EA580C" />
                  <Text style={styles.caloriesText}>{caloriesText}</Text>
                </View>
              ) : null}
            </View>

            {/* شارات الصحة والتحذيرات (SFDA) */}
            <View style={[styles.badgesRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {item.is_high_salt && (
                <View style={styles.saltBadge}>
                  <Text style={styles.badgeText}>
                    🧂 {lang === "ar" ? "عالي الملح" : "High Salt"}
                  </Text>
                </View>
              )}

              {item.caffeine_mg && item.caffeine_mg > 0 ? (
                <View style={styles.caffeineBadge}>
                  <Text style={styles.badgeText}>
                    ☕ {item.caffeine_mg} {lang === "ar" ? "ملغ كافيين" : "mg caffeine"}
                  </Text>
                </View>
              ) : null}

              {item.allergens && item.allergens.length > 0 && (
                <View style={styles.allergenBadge}>
                  <Text style={styles.badgeText}>
                    ⚠️ {lang === "ar" ? "مسببات حساسية: " : "Allergens: "}
                    {item.allergens.join(", ")}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* خيارات الأحجام (إلزامية إن وجدت) */}
          {item.sizes && item.sizes.length > 0 && (
            <View style={styles.groupCard}>
              <View style={[styles.groupHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={styles.groupTitle}>{lang === "ar" ? "الحجم" : "Size"}</Text>
                <View style={styles.requiredTag}>
                  <Text style={styles.requiredTagText}>
                    {lang === "ar" ? "إلزامي (اختر 1)" : "Required (1)"}
                  </Text>
                </View>
              </View>

              {item.sizes.map((sz) => {
                const isSelected = selectedSizeId === sz.id;
                const sizeName = lang === "ar" ? sz.name_ar : sz.name_en;

                return (
                  <TouchableOpacity
                    key={sz.id}
                    style={[
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                      { flexDirection: isRTL ? "row-reverse" : "row" },
                    ]}
                    onPress={() => setSelectedSizeId(sz.id)}
                  >
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>

                    <View style={{ flex: 1, marginHorizontal: 12, alignItems: isRTL ? "flex-end" : "flex-start" }}>
                      <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                        {sizeName}
                      </Text>
                      {sz.calories_value && !item.is_calories_exempt ? (
                        <Text style={styles.optionCalories}>
                          {sz.calories_value} {lang === "ar" ? "سعرة" : "cal"}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.optionPrice}>
                      {formatMoney(sz.customer_price_halalas)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* مجموعات الإضافات والخيارات */}
          {item.option_groups &&
            item.option_groups.map((grp) => {
              const grpName = lang === "ar" ? grp.name_ar : grp.name_en;
              const selectedList = selectedOptionIds[grp.id] || [];

              return (
                <View key={grp.id} style={styles.groupCard}>
                  <View style={[styles.groupHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
                      <Text style={styles.groupTitle}>{grpName}</Text>
                      <Text style={styles.groupSub}>
                        {grp.max_selectable === 1
                          ? lang === "ar"
                            ? grp.is_required
                              ? "اختر 1 (إلزامي)"
                              : "اختر 1 (اختياري)"
                            : grp.is_required
                            ? "Choose 1 (Required)"
                            : "Choose 1 (Optional)"
                          : lang === "ar"
                          ? `اختر حتى ${grp.max_selectable}`
                          : `Choose up to ${grp.max_selectable}`}
                      </Text>
                    </View>

                    {grp.is_required && (
                      <View style={styles.requiredTag}>
                        <Text style={styles.requiredTagText}>
                          {lang === "ar" ? "إلزامي" : "Required"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {grp.options.map((opt) => {
                    const isSelected = selectedList.includes(opt.id);
                    const optName = lang === "ar" ? opt.name_ar : opt.name_en;

                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.optionRow,
                          isSelected && styles.optionRowSelected,
                          { flexDirection: isRTL ? "row-reverse" : "row" },
                        ]}
                        onPress={() => toggleOption(grp.id, opt.id, grp.max_selectable)}
                      >
                        {grp.max_selectable === 1 ? (
                          <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                            {isSelected && <View style={styles.radioDot} />}
                          </View>
                        ) : (
                          <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxActive]}>
                            {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                          </View>
                        )}

                        <View style={{ flex: 1, marginHorizontal: 12, alignItems: isRTL ? "flex-end" : "flex-start" }}>
                          <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                            {optName}
                          </Text>
                          {opt.calories_delta && !item.is_calories_exempt ? (
                            <Text style={styles.optionCalories}>
                              +{opt.calories_delta} {lang === "ar" ? "سعرة" : "cal"}
                            </Text>
                          ) : null}
                        </View>

                        {opt.price_delta_halalas > 0 ? (
                          <Text style={styles.optionPrice}>
                            +{formatMoney(opt.price_delta_halalas)}
                          </Text>
                        ) : (
                          <Text style={styles.freeOptionText}>
                            {lang === "ar" ? "مجاناً" : "Free"}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}

          {/* حقل الملاحظات */}
          <View style={styles.groupCard}>
            <Text style={[styles.groupTitle, { textAlign: isRTL ? "right" : "left" }]}>
              {lang === "ar" ? "ملاحظات إضافية (اختياري)" : "Special Instructions (Optional)"}
            </Text>
            <TextInput
              style={[styles.noteInput, { textAlign: isRTL ? "right" : "left" }]}
              placeholder={lang === "ar" ? "مثال: بدون طماطم، صوص جانبي..." : "e.g., No tomato, extra napkin..."}
              placeholderTextColor="#94A3B8"
              value={note}
              onChangeText={setNote}
              maxLength={200}
              multiline
            />
          </View>
        </ScrollView>

        {/* الشريط السفلي: محدد الكمية وزر الإضافة */}
        <View style={styles.footer}>
          {/* رسالة النقص إن وجدت (CUS-005) */}
          {validationError && (
            <View style={styles.errorNotice}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorNoticeText}>{validationError}</Text>
            </View>
          )}

          <View style={[styles.actionRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {/* عداد الكمية */}
            <View style={[styles.qtySelector, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Ionicons name="remove" size={18} color={quantity <= 1 ? "#CBD5E1" : "#0F172A"} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => Math.min(99, q + 1))}
              >
                <Ionicons name="add" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* زر الإضافة */}
            <TouchableOpacity
              style={[styles.addBtn, !isValid && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!isValid}
            >
              <Text style={styles.addBtnText}>
                {lang === "ar" ? "إضافة للسلة" : "Add to Cart"} · {formatMoney(totalPriceHalalas)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    maxWidth: 240,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  itemImage: {
    width: "100%",
    height: 220,
  },
  infoSection: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  nameText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  descText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 6,
    lineHeight: 20,
  },
  priceCaloriesRow: {
    marginTop: 12,
    alignItems: "center",
    gap: 12,
  },
  priceHighlight: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2563EB",
  },
  caloriesBadge: {
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFEDD5",
    gap: 4,
  },
  caloriesText: {
    fontSize: 18, // خط لا يصغر عن خط السعر والاسم (CUS-019)
    fontWeight: "700",
    color: "#EA580C",
  },
  badgesRow: {
    marginTop: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  saltBadge: {
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  caffeineBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  allergenBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  groupCard: {
    backgroundColor: "#FFFFFF",
    marginTop: 8,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  groupHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  groupSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  requiredTag: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  requiredTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  optionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  optionRowSelected: {
    backgroundColor: "#F8FAFC",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleActive: {
    borderColor: "#2563EB",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  optionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  optionNameSelected: {
    color: "#0F172A",
    fontWeight: "700",
  },
  optionCalories: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  freeOptionText: {
    fontSize: 13,
    color: "#16A34A",
    fontWeight: "600",
  },
  noteInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    fontSize: 14,
    color: "#0F172A",
    minHeight: 64,
  },
  footer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  errorNoticeText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },
  actionRow: {
    alignItems: "center",
    gap: 12,
  },
  qtySelector: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    paddingHorizontal: 8,
  },
  addBtn: {
    flex: 1,
    backgroundColor: "#2563EB",
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnDisabled: {
    backgroundColor: "#94A3B8",
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
