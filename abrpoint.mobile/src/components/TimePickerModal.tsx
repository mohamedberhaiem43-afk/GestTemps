import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS } from '../config/env';

interface TimePickerModalProps {
  visible: boolean;
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  title?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export default function TimePickerModal({ visible, value, onChange, onClose, title = 'Sélectionner l\'heure' }: TimePickerModalProps) {
  const [hour, setHour] = useState(value.getHours());
  const [minute, setMinute] = useState(value.getMinutes());

  const handleConfirm = () => {
    const newDate = new Date(value);
    newDate.setHours(hour, minute, 0, 0);
    onChange(newDate);
    onClose();
  };

  const PickerColumn = ({ items, selectedValue, onSelect, itemWidth }: any) => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.pickerColumn}
      contentContainerStyle={styles.pickerContent}
    >
      {items.map((item: number) => (
        <TouchableOpacity
          key={item}
          style={[
            styles.pickerItem,
            { width: itemWidth || 70 },
            selectedValue === item && styles.pickerItemSelected,
          ]}
          onPress={() => onSelect(item)}
        >
          <Text style={[
            styles.pickerItemText,
            selectedValue === item && styles.pickerItemTextSelected,
          ]}>
            {String(item).padStart(2, '0')}
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
            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>Heure</Text>
              <PickerColumn
                items={HOURS}
                selectedValue={hour}
                onSelect={setHour}
                itemWidth={80}
              />
            </View>
            <Text style={styles.colonSeparator}>:</Text>
            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>Minute</Text>
              <PickerColumn
                items={MINUTES}
                selectedValue={minute}
                onSelect={setMinute}
                itemWidth={80}
              />
            </View>
          </View>

          <View style={styles.previewRow}>
            <Text style={styles.previewText}>
              🕐 {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
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
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '60%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: 16 },
  pickerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 200 },
  pickerSection: { alignItems: 'center' },
  pickerLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  colonSeparator: { fontSize: 32, fontWeight: 'bold', color: COLORS.text, marginHorizontal: 8, marginTop: 20 },
  pickerColumn: { maxHeight: 170 },
  pickerContent: { alignItems: 'center', paddingVertical: 4 },
  pickerItem: { paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', marginVertical: 1 },
  pickerItemSelected: { backgroundColor: COLORS.primary },
  pickerItemText: { fontSize: 16, color: COLORS.textSecondary },
  pickerItemTextSelected: { color: '#fff', fontWeight: 'bold' },
  previewRow: { alignItems: 'center', paddingVertical: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  previewText: { fontSize: 18, fontWeight: '600', color: COLORS.primary },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
});