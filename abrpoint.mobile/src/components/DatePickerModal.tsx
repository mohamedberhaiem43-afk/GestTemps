import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { COLORS } from '../config/env';

interface DatePickerModalProps {
  visible: boolean;
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  title?: string;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function DatePickerModal({ visible, value, onChange, onClose, title = 'Sélectionner une date' }: DatePickerModalProps) {
  const [day, setDay] = useState(value.getDate());
  const [month, setMonth] = useState(value.getMonth());
  const [year, setYear] = useState(value.getFullYear());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const handleConfirm = () => {
    onChange(new Date(year, month, day));
    onClose();
  };

  const PickerColumn = ({ items, selectedValue, onSelect, itemWidth }: any) => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.pickerColumn}
      contentContainerStyle={styles.pickerContent}
    >
      {items.map((item: any) => (
        <TouchableOpacity
          key={String(item.value !== undefined ? item.value : item)}
          style={[
            styles.pickerItem,
            { width: itemWidth || 80 },
            selectedValue === (item.value !== undefined ? item.value : item) && styles.pickerItemSelected,
          ]}
          onPress={() => onSelect(item.value !== undefined ? item.value : item)}
        >
          <Text style={[
            styles.pickerItemText,
            selectedValue === (item.value !== undefined ? item.value : item) && styles.pickerItemTextSelected,
          ]}>
            {item.label || item}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{title}</Text>

          <View style={styles.pickerRow}>
            <PickerColumn
              items={DAYS.map(d => ({ value: d, label: String(d).padStart(2, '0') }))}
              selectedValue={day}
              onSelect={setDay}
              itemWidth={70}
            />
            <PickerColumn
              items={MONTHS.map((m, i) => ({ value: i, label: m.substring(0, 3) }))}
              selectedValue={month}
              onSelect={setMonth}
              itemWidth={90}
            />
            <PickerColumn
              items={years.map(y => String(y))}
              selectedValue={String(year)}
              onSelect={(y: string) => setYear(Number(y))}
              itemWidth={80}
            />
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewText}>
              📅 {String(day).padStart(2, '0')} {MONTHS[month]} {year}
            </Text>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f5f5f5' }]} onPress={onClose}>
              <Text style={[styles.modalBtnText, { color: COLORS.textSecondary }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.primary }]} onPress={handleConfirm}>
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: 16,
  },
  pickerRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8, height: 200,
  },
  pickerColumn: {
    flex: 1, maxHeight: 200,
  },
  pickerContent: {
    alignItems: 'center', paddingVertical: 4,
  },
  pickerItem: {
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', marginVertical: 1,
  },
  pickerItemSelected: {
    backgroundColor: COLORS.primary,
  },
  pickerItemText: {
    fontSize: 14, color: COLORS.textSecondary,
  },
  pickerItemTextSelected: {
    color: '#fff', fontWeight: 'bold',
  },
  previewRow: {
    alignItems: 'center', paddingVertical: 12, marginTop: 8,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  previewText: {
    fontSize: 16, fontWeight: '600', color: COLORS.primary,
  },
  modalButtons: {
    flexDirection: 'row', gap: 12, marginTop: 16,
  },
  modalBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 15, fontWeight: '600',
  },
});