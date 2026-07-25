// frontend/src/components/StaffManagement.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    ScrollView,
    Switch,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../api';

interface Staff {
    Id: number;
    Name: string;
    IsActive: boolean;
}

interface StaffManagementProps {
    visible: boolean;
    onClose: () => void;
    onStaffUpdate: () => void;
    currentTheme: any;
    t: any;
}

const StaffManagement: React.FC<StaffManagementProps> = ({
    visible,
    onClose,
    onStaffUpdate,
    currentTheme,
    t
}) => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(false);
    const [isStaffMandatory, setIsStaffMandatory] = useState(false);
    const [formName, setFormName] = useState('');
    const [saving, setSaving] = useState(false);
    const staffLoadedRef = useRef(false);

    useEffect(() => {
        if (visible) {
            staffLoadedRef.current = false;
            loadStaffData();
        }
    }, [visible]);

    const loadStaffData = async () => {
        if (staffLoadedRef.current) return;
        setLoading(true);
        try {
            // Load staff list
            const staffResponse = await API.get('/staff');
            setStaffList(staffResponse.data || []);

            // Load staff settings
            const settingsResponse = await API.get('/staff/settings/info');
            if (settingsResponse.data) {
                setIsStaffMandatory(settingsResponse.data.isStaffMandatory);
            }
            staffLoadedRef.current = true;
        } catch (error) {
            console.log('Error loading staff data:', error);
            Alert.alert('Error', 'Failed to load staff data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddStaff = async () => {
        if (!formName.trim()) {
            Alert.alert('Error', 'Please enter staff name');
            return;
        }

        setSaving(true);
        try {
            const response = await API.post('/staff', {
                name: formName.trim()
            });

            if (response.data) {
                setFormName('');
                staffLoadedRef.current = false;
                await loadStaffData();
                onStaffUpdate();
                Alert.alert('Success', 'Staff member added successfully');
            }
        } catch (error) {
            console.log('Error adding staff:', error);
            Alert.alert('Error', 'Failed to add staff member');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteStaff = async (id: number, name: string) => {
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to delete staff member "${name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await API.delete(`/staff/${id}`);
                            staffLoadedRef.current = false;
                            await loadStaffData();
                            onStaffUpdate();
                            Alert.alert('Success', 'Staff member deleted');
                        } catch (error) {
                            console.log('Error deleting staff:', error);
                            Alert.alert('Error', 'Failed to delete staff member');
                        }
                    }
                }
            ]
        );
    };

    const handleToggleMandatory = async (value: boolean) => {
        setIsStaffMandatory(value);
        try {
            await API.post('/staff/settings/info', {
                isStaffMandatory: value
            });
            onStaffUpdate();
        } catch (error) {
            console.log('Error updating staff settings:', error);
            Alert.alert('Error', 'Failed to update mandatory setting');
            // Revert state on error
            setIsStaffMandatory(!value);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
            >
                <View style={[styles.modalContainer, { backgroundColor: currentTheme.card }]}>
                    
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: currentTheme.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={24} color={currentTheme.text} style={{ marginRight: 8 }} />
                            <Text style={[styles.headerTitle, { color: currentTheme.text }]}>Staff Management</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={currentTheme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
                        {/* Toggle Settings */}
                        <View style={[styles.settingsContainer, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
                            <View style={styles.settingsRow}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <Text style={[styles.settingsLabel, { color: currentTheme.text }]}>Mandatory at Checkout</Text>
                                    <Text style={[styles.settingsSub, { color: currentTheme.textSecondary }]}>
                                        Force cashier to select a staff member during checkout.
                                    </Text>
                                </View>
                                <Switch
                                    value={isStaffMandatory}
                                    onValueChange={handleToggleMandatory}
                                    trackColor={{ false: currentTheme.border, true: currentTheme.primary }}
                                    thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                                />
                            </View>
                        </View>

                        {/* Add Staff Form */}
                        <View style={styles.addFormContainer}>
                            <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Add New Staff</Text>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: currentTheme.surface,
                                        color: currentTheme.text,
                                        borderColor: currentTheme.border
                                    }]}
                                    placeholder="Staff Name"
                                    placeholderTextColor={currentTheme.textSecondary}
                                    value={formName}
                                    onChangeText={setFormName}
                                />
                                <TouchableOpacity
                                    style={[styles.addButton, { backgroundColor: currentTheme.primary }]}
                                    onPress={handleAddStaff}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.addButtonText}>Add Staff</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Staff List */}
                        <Text style={[styles.sectionTitle, { color: currentTheme.text, marginHorizontal: 16, marginTop: 12 }]}>
                            Staff List ({staffList.length})
                        </Text>

                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={currentTheme.primary} />
                            </View>
                        ) : staffList.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="people" size={48} color={currentTheme.textSecondary} />
                                <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>No staff members added yet</Text>
                            </View>
                        ) : (
                            <View style={{ marginHorizontal: 16 }}>
                                {staffList.map((staff) => (
                                    <View
                                        key={staff.Id}
                                        style={[styles.staffRow, {
                                            borderBottomColor: currentTheme.border,
                                            backgroundColor: currentTheme.surface
                                        }]}
                                    >
                                        <View style={styles.staffInfo}>
                                            <View style={[styles.avatar, { backgroundColor: currentTheme.primary + '20' }]}>
                                                <Text style={[styles.avatarText, { color: currentTheme.primary }]}>
                                                    {staff.Name.substring(0, 2).toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={[styles.staffName, { color: currentTheme.text }]}>{staff.Name}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteStaff(staff.Id, staff.Name)}
                                            style={styles.deleteButton}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={currentTheme.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    modalContainer: {
        width: '100%',
        height: '100%',
        flex: 1,
        borderRadius: 0,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    closeButton: {
        padding: 4
    },
    settingsContainer: {
        margin: 16,
        padding: 12,
        borderWidth: 1,
        borderRadius: 8
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    settingsLabel: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2
    },
    settingsSub: {
        fontSize: 12,
        lineHeight: 16
    },
    addFormContainer: {
        paddingHorizontal: 16,
        marginBottom: 12
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 0.5
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    input: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 15,
        marginRight: 10
    },
    addButton: {
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    addButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold'
    },
    listContainer: {
        flex: 1,
        marginHorizontal: 16,
        marginBottom: 16
    },
    staffRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderBottomWidth: 1
    },
    staffInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    avatarText: {
        fontSize: 13,
        fontWeight: 'bold'
    },
    staffName: {
        fontSize: 15,
        fontWeight: '500'
    },
    deleteButton: {
        padding: 6
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14
    }
});

export default StaffManagement;
