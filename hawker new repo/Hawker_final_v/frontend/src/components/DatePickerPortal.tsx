// components/DatePickerPortal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet, Platform, TextInput } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

// ✅ Date picker in its own modal - completely isolated!
const DatePickerPortal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  currentDate: Date;
  theme: any;
  title: string;
}> = ({ visible, onClose, onConfirm, currentDate, theme, title }) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    return currentDate instanceof Date && !isNaN(currentDate.getTime()) ? currentDate : new Date();
  });

  useEffect(() => {
    if (visible) {
      setSelectedDate(currentDate instanceof Date && !isNaN(currentDate.getTime()) ? currentDate : new Date());
    }
  }, [visible, currentDate]);

  if (!visible) return null;

  // Web custom modal (Centered card dialog matching user's request)
  if (Platform.OS === 'web') {
    // Safely get ISO date string format
    const isoString = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) 
      ? selectedDate.toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0];

    return (
      <Modal
        transparent={true}
        animationType="fade"
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.webModalOverlay}>
          <View style={[styles.webModalContent, { backgroundColor: theme.card || '#ffffff' }]}>
            <View style={styles.webModalHeader}>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.webModalButton, { color: '#888888', fontWeight: '500' }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.webModalTitle, { color: theme.text || '#000000' }]}>{title}</Text>
              <TouchableOpacity onPress={() => onConfirm(selectedDate)}>
                <Text style={[styles.webModalButton, { color: '#FF3B30', fontWeight: '600' }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.webPickerContainer}>
              <input
                type="date"
                value={isoString}
                onChange={(e: any) => {
                  const val = e.target.value;
                  if (val) {
                    const parsed = new Date(val);
                    if (parsed instanceof Date && !isNaN(parsed.getTime())) {
                      setSelectedDate(parsed);
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border || '#e0e0e0'}`,
                  backgroundColor: theme.surface || '#f5f5f5',
                  color: theme.text || '#000000',
                  textAlign: 'center',
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={selectedDate}
        mode="date"
        display="default"
        onChange={(event, date) => {
          if (event.type === 'set' && date) {
            onConfirm(date);
          }
          onClose();
        }}
      />
    );
  }

  // iOS - custom modal with picker
  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.iosModalOverlay}>
        <View style={[styles.iosModalContent, { backgroundColor: theme.card }]}>
          <View style={styles.iosModalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.iosModalButton, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.iosModalTitle, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity onPress={() => onConfirm(selectedDate)}>
              <Text style={[styles.iosModalButton, { color: theme.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => date && setSelectedDate(date)}
            style={styles.iosPicker}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iosModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iosModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  iosModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  iosModalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  iosModalButton: {
    fontSize: 16,
    padding: 8,
  },
  iosPicker: {
    height: 200,
  },
  // Web specific styles
  webModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  webModalContent: {
    width: 320,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  webModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  webModalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  webModalButton: {
    fontSize: 15,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  webCancelButton: {
    fontSize: 15,
    color: '#888888',
  },
  webDoneButton: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '600',
  },
  webPickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  webDatePickerInput: {
    width: '100%',
    padding: 12,
    fontSize: 15,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    outlineStyle: 'none',
  } as any
});

export default React.memo(DatePickerPortal);