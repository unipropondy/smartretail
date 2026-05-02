// frontend/src/components/DepartmentManagement.tsx

import React, { useState, useEffect } from 'react';
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
import DraggableFlatList from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import API from '../api';

interface Department {
    Id: number;
    Name: string;
    IsActive: boolean;
    DisplayOrder: number;
}

interface DepartmentManagementProps {
    visible: boolean;
    onClose: () => void;
    onDepartmentUpdate: () => void;
    currentTheme: any;
    t: any;
}

const DepartmentManagement: React.FC<DepartmentManagementProps> = ({
    visible,
    onClose,
    onDepartmentUpdate,
    currentTheme,
    t
}) => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [formName, setFormName] = useState('');
    const [formActive, setFormActive] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) {
            loadDepartments();
        }
    }, [visible]);

    const loadDepartments = async () => {
        setLoading(true);
        try {
            const response = await API.get('/departments');
            setDepartments(response.data || []);
        } catch (error) {
            console.log('Error loading departments:', error);
            Alert.alert('Error', 'Failed to load departments');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDepartment = async () => {
        if (!formName.trim()) {
            Alert.alert('Error', 'Please enter department name');
            return;
        }

        setSaving(true);
        try {
            const response = await API.post('/departments', {
                name: formName.trim(),
                active: formActive
            });

            if (response.data) {
                await loadDepartments();
                setShowAddForm(false);
                setFormName('');
                setFormActive(true);
                onDepartmentUpdate();
                Alert.alert('Success', 'Department added successfully');
            }
        } catch (error: any) {
            console.log('Error:', error.response?.data);
            Alert.alert('Error', error.response?.data?.error || 'Failed to add department');
        } finally {
            setSaving(false);
        }
    };

    const handleEditDepartment = async () => {
        if (!editingDept || !formName.trim()) return;

        setSaving(true);
        try {
            const response = await API.put(`/departments/${editingDept.Id}`, {
                name: formName.trim(),
                active: formActive,
                displayOrder: editingDept.DisplayOrder
            });

            if (response.data) {
                await loadDepartments();
                setShowEditForm(false);
                setEditingDept(null);
                setFormName('');
                onDepartmentUpdate();
                Alert.alert('Success', 'Department updated');
            }
        } catch (error: any) {
            console.log('Error:', error.response?.data);
            Alert.alert('Error', error.response?.data?.error || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDepartment = (dept: Department) => {
        Alert.alert(
            'Delete Department',
            `Delete "${dept.Name}"?\n\nAll categories under this department will be unassigned.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await API.delete(`/departments/${dept.Id}`);
                            await loadDepartments();
                            onDepartmentUpdate();
                            Alert.alert('Success', 'Department deleted');
                        } catch (error: any) {
                            console.log('Error:', error.response?.data);
                            Alert.alert('Error', error.response?.data?.error || 'Failed to delete');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const toggleActive = async (dept: Department) => {
        try {
            await API.put(`/departments/${dept.Id}`, {
                name: dept.Name,
                active: !dept.IsActive,
                displayOrder: dept.DisplayOrder
            });
            await loadDepartments();
            onDepartmentUpdate();
        } catch (error) {
            Alert.alert('Error', 'Failed to update status');
        }
    };

    const handleDragEnd = async ({ data }: { data: Department[] }) => {
        setDepartments(data);
        const orderData = data.map((dept, index) => ({
            id: dept.Id,
            order: index
        }));
        try {
            await API.post('/departments/update-order', { departments: orderData });
        } catch (error) {
            console.log('Failed to save order');
        }
    };

    const renderItem = ({ item, drag, isActive }: any) => (
        <TouchableOpacity
            activeOpacity={1}
            onLongPress={drag}
            style={[
                styles.departmentCard,
                {
                    backgroundColor: currentTheme.card,
                    borderColor: currentTheme.border,
                    opacity: item.IsActive ? 1 : 0.6
                }
            ]}
        >
            <View style={styles.departmentInfo}>
                <Ionicons name="grid" size={24} color={currentTheme.primary} />
                <View style={styles.departmentTextContainer}>
                    <Text style={[styles.departmentName, { color: currentTheme.text }]}>
                        {item.Name}
                        {!item.IsActive && (
                            <Text style={[styles.inactiveBadge, { color: currentTheme.danger }]}>
                                {' (Inactive)'}
                            </Text>
                        )}
                    </Text>
                    <Text style={[styles.departmentStatus, { color: currentTheme.textSecondary }]}>
                        {item.IsActive ? 'Active' : 'Inactive'}
                    </Text>
                </View>
            </View>

            <View style={styles.departmentActions}>
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: currentTheme.success }]}
                    onPress={() => toggleActive(item)}
                >
                    <Ionicons name={item.IsActive ? "eye" : "eye-off"} size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: currentTheme.primary }]}
                    onPress={() => {
                        setEditingDept(item);
                        setFormName(item.Name);
                        setFormActive(item.IsActive);
                        setShowEditForm(true);
                    }}
                >
                    <Ionicons name="pencil" size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: currentTheme.danger }]}
                    onPress={() => handleDeleteDepartment(item)}
                >
                    <Ionicons name="trash" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
                <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: currentTheme.background }]}>
                    
                    {/* Header - Fixed at top */}
                    <View style={[styles.fullScreenHeader, { backgroundColor: currentTheme.primary }]}>
                        <View style={styles.headerLeft}>
                            <Ionicons name="business-outline" size={24} color="#fff" />
                            <Text style={styles.headerTitle}>Manage Departments</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Scrollable Content */}
                    {/* Scrollable Content - REPLACE THIS SECTION */}
{/* Content - Full flex with proper height */}
<View style={{ flex: 1, padding: 20 }}>
  

    <TouchableOpacity
        style={[styles.addButton, { backgroundColor: currentTheme.primary }]}
        onPress={() => {
            setFormName('');
            setFormActive(true);
            setShowAddForm(true);
        }}
    >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Add New Department</Text>
    </TouchableOpacity>

    {loading ? (
        <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={currentTheme.primary} />
        </View>
    ) : (
        <View style={{ flex: 1, minHeight: 400 }}>
            <DraggableFlatList
                data={departments}
                onDragEnd={handleDragEnd}
                keyExtractor={(item) => item.Id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={true}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={{ color: currentTheme.textSecondary, textAlign: 'center' }}>
                            No departments yet. Tap "Add New Department" to create one.
                        </Text>
                    </View>
                }
            />
        </View>
    )}
</View>
                </SafeAreaView>
            </Modal>

            {/* Add Department Modal - Full Screen */}
            <Modal visible={showAddForm} animationType="slide" onRequestClose={() => setShowAddForm(false)}>
                <SafeAreaView style={[styles.fullScreenModalContainer, { backgroundColor: currentTheme.background }]}>
                    <View style={[styles.formHeader, { backgroundColor: currentTheme.primary }]}>
                        <Text style={[styles.formHeaderTitle, { color: '#fff' }]}>Add Department</Text>
                        <TouchableOpacity onPress={() => setShowAddForm(false)} style={styles.formCloseBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={styles.formScroll}
                        contentContainerStyle={styles.formContent}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={[styles.formLabel, { color: currentTheme.textSecondary }]}>
                            Department Name *
                        </Text>
                        <TextInput
                            style={[styles.formInput, {
                                backgroundColor: currentTheme.surface,
                                borderColor: currentTheme.border,
                                color: currentTheme.text
                            }]}
                            placeholder="e.g., Indian Kitchen, Western Food"
                            placeholderTextColor={currentTheme.textSecondary}
                            value={formName}
                            onChangeText={setFormName}
                            autoFocus={true}
                        />

                        <View style={styles.activeRow}>
                            <Text style={[styles.activeLabel, { color: currentTheme.text }]}>Active</Text>
                            <Switch
                                value={formActive}
                                onValueChange={setFormActive}
                                trackColor={{ false: currentTheme.inactive, true: currentTheme.success }}
                                thumbColor="#fff"
                            />
                        </View>

                        <View style={styles.formButtons}>
                            <TouchableOpacity
                                style={[styles.formCancelBtn, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}
                                onPress={() => {
                                    setShowAddForm(false);
                                    setFormName('');
                                    setFormActive(true);
                                }}
                            >
                                <Text style={[styles.formCancelText, { color: currentTheme.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={[styles.formSaveBtn, { backgroundColor: currentTheme.primary }]}
                                onPress={handleAddDepartment}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator size="small" color="#fff" /> :
                                    <Text style={styles.formSaveText}>Add Department</Text>}
                            </TouchableOpacity>
                        </View>
                        
                        <View style={{ height: 30 }} />
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Edit Department Modal - Full Screen */}
            <Modal visible={showEditForm} animationType="slide" onRequestClose={() => setShowEditForm(false)}>
                <SafeAreaView style={[styles.fullScreenModalContainer, { backgroundColor: currentTheme.background }]}>
                    <View style={[styles.formHeader, { backgroundColor: currentTheme.primary }]}>
                        <Text style={[styles.formHeaderTitle, { color: '#fff' }]}>Edit Department</Text>
                        <TouchableOpacity onPress={() => setShowEditForm(false)} style={styles.formCloseBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={styles.formScroll}
                        contentContainerStyle={styles.formContent}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={[styles.formLabel, { color: currentTheme.textSecondary }]}>
                            Department Name *
                        </Text>
                        <TextInput
                            style={[styles.formInput, {
                                backgroundColor: currentTheme.surface,
                                borderColor: currentTheme.border,
                                color: currentTheme.text
                            }]}
                            value={formName}
                            onChangeText={setFormName}
                        />

                        <View style={styles.activeRow}>
                            <Text style={[styles.activeLabel, { color: currentTheme.text }]}>Active</Text>
                            <Switch
                                value={formActive}
                                onValueChange={setFormActive}
                                trackColor={{ false: currentTheme.inactive, true: currentTheme.success }}
                                thumbColor="#fff"
                            />
                        </View>

                        <View style={styles.formButtons}>
                            <TouchableOpacity
                                style={[styles.formCancelBtn, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}
                                onPress={() => {
                                    setShowEditForm(false);
                                    setEditingDept(null);
                                    setFormName('');
                                }}
                            >
                                <Text style={[styles.formCancelText, { color: currentTheme.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={[styles.formSaveBtn, { backgroundColor: currentTheme.primary }]}
                                onPress={handleEditDepartment}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator size="small" color="#fff" /> :
                                    <Text style={styles.formSaveText}>Update Department</Text>}
                            </TouchableOpacity>
                        </View>
                        
                        <View style={{ height: 30 }} />
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    fullScreenContainer: {
        flex: 1,
    },
    fullScreenHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    closeBtn: {
        padding: 5,
    },
    fullScreenScroll: {
        flex: 1,
    },
 fullScreenContent: {
    padding: 20,
    paddingBottom: 20,  // ✅ Reduce from 40 to 20
},

    subtitle: {
        fontSize: 12,
        marginBottom: 16,
        fontStyle: 'italic',
        textAlign: 'center',
    },
      loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 12,
        marginBottom: 20,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    loader: {
        marginTop: 40,
    },
   listContainer: {
    paddingBottom: 20,
    flexGrow: 1,  // ✅ Add this
},
    departmentCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
    },
    departmentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    departmentTextContainer: {
        flex: 1,
    },
    departmentName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    inactiveBadge: {
        fontSize: 12,
        fontWeight: '400',
    },
    departmentStatus: {
        fontSize: 11,
    },
    departmentActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        width: 38,
        height: 38,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenModalContainer: {
        flex: 1,
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    formHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    formCloseBtn: {
        padding: 5,
    },
    formScroll: {
        flex: 1,
    },
    formContent: {
        padding: 20,
        paddingBottom: 40,
    },
    formLabel: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '500',
    },
    formInput: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        fontSize: 15,
        marginBottom: 20,
    },
    activeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    activeLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    formButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
    },
    formCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    formCancelText: {
        fontSize: 16,
        fontWeight: '600',
    },
    formSaveBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
},
    formSaveText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default DepartmentManagement;