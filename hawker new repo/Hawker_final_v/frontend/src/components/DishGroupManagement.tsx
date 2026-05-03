// src/components/DishGroupManagement.tsx
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import API from '../api';

interface DishGroup {
  id: number;
  name: string;
  itemCount: number;
  active: boolean;
  order?: number;
  isDynamic?: boolean;  // ✅ NEW: Mark dynamic groups like Favourites
  departmentId?: number; 
  departmentName?: string;
}
interface Department {
  Id: number;
  Name: string;
  IsActive: boolean;
  DisplayOrder: number;
}
interface DishGroupManagementProps {
  dishGroups: DishGroup[];
  setDishGroups: (groups: DishGroup[]) => void;
  categories: string[];
  setCategories: (categories: string[]) => void;
  setActiveCategory: (category: string) => void;
  currentTheme: any;
  t: any;
  onGroupUpdate: () => void;
  departments: Department[];
  selectedDepartmentId?: number;
    onDepartmentChange?: (deptId: number) => void;
    is3LayerMode: boolean; 
}

export const DishGroupManagement: React.FC<DishGroupManagementProps> = ({
  dishGroups,
  setDishGroups,
  categories,
  setCategories,
  setActiveCategory,
  currentTheme,
  t,
  onGroupUpdate,

   departments = [],           // Add this
  selectedDepartmentId,       // Add this
  onDepartmentChange, 
  is3LayerMode,
}) => {
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DishGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
const [selectedDeptId, setSelectedDeptId] = useState<number | null>(selectedDepartmentId || null);
const [filterDepartmentId, setFilterDepartmentId] = useState<number | null>(null);
  // ✅ Filter groups for display (hide empty Favourites)
const displayGroups = useMemo(() => {
    let groups = [...dishGroups];
    
    // Filter by department
    if (filterDepartmentId) {
        groups = groups.filter(g => g.departmentId === filterDepartmentId);
    }
    
    // Hide empty Favourites
    return groups.filter(group => {
        if (group.name === 'Favourites' && group.itemCount === 0 && group.isDynamic) {
            return false;
        }
        return true;
    });
}, [dishGroups, filterDepartmentId]);
// Add this after displayGroups or replace displayGroups
const filteredGroups = useMemo(() => {
    console.log('🔍 Filtering - selected deptId:', filterDepartmentId);
    console.log('🔍 All groups with deptId:', dishGroups.map(g => ({ name: g.name, deptId: g.departmentId })));
    
    let groups = [...dishGroups];
    
    if (filterDepartmentId) {
        groups = groups.filter(g => g.departmentId === filterDepartmentId);
        console.log('🔍 Filtered groups:', groups.map(g => g.name));
    }
    
    // Hide empty Favourites
    return groups.filter(group => {
        if (group.name === 'Favourites' && group.itemCount === 0 && group.isDynamic) {
            return false;
        }
        return true;
    });
}, [dishGroups, filterDepartmentId]);
  // Add Group - Prevent manual creation of Favourites
  const handleAddGroup = async (): Promise<void> => {
    console.log('📤 Sending group with departmentId:', selectedDeptId);  // ✅ Add debug
    if (!newGroupName.trim()) {
      Alert.alert(t.error, 'Please enter group name');
      return;
    }

    // ✅ Prevent manual creation of Favourites group
    if (newGroupName.trim().toLowerCase() === 'favourites') {
      Alert.alert('Error', 'Favourites group is automatically managed');
      return;
    }

    setLoading(true);
    try {
      const response = await API.post('/dishgroups', {
        name: newGroupName.trim(),
        active: formActive,
        departmentId: selectedDeptId || null 
      });
console.log('✅ Response:', response.data);
      const newGroup = {
        id: response.data.Id,
        name: response.data.Name,
        itemCount: 0,
        active: response.data.active ?? formActive,
        isDynamic: false,  // ✅ Manual groups are not dynamic
         departmentId: selectedDeptId || null,  // ✅ Add this
      };

      const updatedGroups = [...dishGroups, newGroup];
      setDishGroups(updatedGroups);
      
      // ✅ Update categories (include Favourites only if it has items)
      const updatedCategories = updatedGroups
        .filter(g => g.active !== false && (g.name !== 'Favourites' || g.itemCount > 0))
        .map(g => g.name);
      setCategories(updatedCategories);
      
      setNewGroupName('');
      setFormActive(true);
      setShowAddGroup(false);
      
      await saveOrderToBackend(updatedGroups);
      onGroupUpdate();
      
    } catch (error) {
      Alert.alert(t.error, 'Failed to add dish group');
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = async (): Promise<void> => {
    if (!editingGroup || !newGroupName.trim()) return;
    
    // ✅ Prevent editing Favourites group name
    if (editingGroup.name === 'Favourites') {
      Alert.alert('Error', 'Favourites group cannot be edited');
      return;
    }

    setLoading(true);
    try {
      const oldName = editingGroup.name;
      
      await API.put(`/dishgroups/${editingGroup.id}`, {
        name: newGroupName.trim(),
        active: formActive,
        departmentId: selectedDeptId || null 
      });

      const updatedGroups = dishGroups.map(group =>
    group.id === editingGroup.id
        ? { ...group, name: newGroupName.trim(), active: formActive, departmentId: selectedDeptId || null }
        : group
);
      setDishGroups(updatedGroups);

      // ✅ Update categories (preserve Favourites if it has items)
      const updatedCategories = updatedGroups
        .filter(g => g.active !== false && (g.name !== 'Favourites' || g.itemCount > 0))
        .map(g => g.name);
      setCategories(updatedCategories);

      if (oldName === categories[0]) {
        setActiveCategory(newGroupName.trim());
      }

      setEditingGroup(null);
      setNewGroupName('');
      setFormActive(true);
      setShowEditGroup(false);
      
      onGroupUpdate();
      
    } catch (error: any) {
      Alert.alert(t.error || '❌ Error', 'Failed to edit dish group');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (group: DishGroup) => {
    // ✅ Prevent deactivating Favourites
    if (group.name === 'Favourites') {
      Alert.alert('Error', 'Favourites group cannot be deactivated');
      return;
    }
    
    setLoading(true);
    try {
      const newActiveState = !group.active;
      
      await API.put(`/dishgroups/${group.id}`, {
        name: group.name,
        active: newActiveState
      });

const updatedGroups = dishGroups.map(g =>
    g.id === group.id ? { ...g, active: newActiveState } : g
);
      
      // ✅ Update categories display
      const updatedCategories = updatedGroups
        .filter(g => g.active !== false && (g.name !== 'Favourites' || g.itemCount > 0))
        .map(g => g.name);
      setCategories(updatedCategories);
      
      onGroupUpdate();
      
    } catch (error) {
      Alert.alert(t.error, 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = (group: DishGroup): void => {
    // ✅ Prevent deleting Favourites group
    if (group.name === 'Favourites') {
      Alert.alert('Error', 'Favourites group cannot be deleted');
      return;
    }
    
    Alert.alert(
      t.delete,
      `${t.confirmDelete} "${group.name}"? ${t.thisWillDelete}`,
      [
        { text: t.no, style: 'cancel' },
        {
          text: t.yes,
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await API.delete(`/dishgroups/${group.id}`);

              const updatedGroups = dishGroups.filter(g => g.id !== group.id);
              const updatedCategories = updatedGroups
                .filter(g => g.active !== false && (g.name !== 'Favourites' || g.itemCount > 0))
                .map(g => g.name);

              setDishGroups(updatedGroups);
              setCategories(updatedCategories);

              if (group.name === categories[0] && updatedCategories.length > 0) {
                setActiveCategory(updatedCategories[0]);
              }

              await saveOrderToBackend(updatedGroups);
              onGroupUpdate();
              
            } catch (error) {
              Alert.alert(t.error, 'Failed to delete dish group');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
// Add this useEffect after state declarations
useEffect(() => {
    // When filter department changes, update selectedDeptId for new group
    if (filterDepartmentId) {
        setSelectedDeptId(filterDepartmentId);
    }
}, [filterDepartmentId]);
  const saveOrderToBackend = async (groups: DishGroup[]) => {
    try {
      // ✅ Filter out dynamic groups from order saving? Or keep them at bottom
      const orderData = groups
        .filter(g => g.name !== 'Favourites') // Favourites always at bottom?
        .map((group, index) => ({
          id: group.id,
          order: index
        }));
      
      await API.post('/dishgroups/update-order', { groups: orderData });
      
    } catch (error) {
      console.log('❌ Failed to save order:', error);
    }
  };

  const handleDragEnd = async ({ data }: { data: DishGroup[] }) => {
    // ✅ Ensure Favourites stays at bottom if it exists
    const favourites = data.find(g => g.name === 'Favourites');
    const otherGroups = data.filter(g => g.name !== 'Favourites');
    
    let finalData = otherGroups;
    if (favourites && favourites.itemCount > 0) {
      finalData = [...otherGroups, favourites];
    }
    
    setDishGroups(finalData);
    await saveOrderToBackend(finalData);
    setIsDragging(false);
    onGroupUpdate();
  };

  const openEditForm = (group: DishGroup) => {
    // ✅ Prevent editing Favourites
    if (group.name === 'Favourites') {
      Alert.alert('Info', 'Favourites group is automatically managed');
      return;
    }
    setEditingGroup(group);
    setNewGroupName(group.name);
    setFormActive(group.active);
     setSelectedDeptId(group.departmentId || null); 
    setShowEditGroup(true);
  };

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<DishGroup>) => {
    // ✅ Disable drag for Favourites
    const canDrag = item.name !== 'Favourites';
    
    return (
      <ScaleDecorator>
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={!loading && canDrag ? drag : null}
          delayLongPress={200}
          style={[
            styles.groupCard,
            {
              backgroundColor: currentTheme.card,
              borderColor: currentTheme.border,
              opacity: item.active ? 1 : 0.6,
              transform: [{ scale: isActive ? 1.02 : 1 }],
              ...(item.name === 'Favourites' && styles.favouritesGroup)
            }
          ]}
        >
          <View style={styles.groupInfo}>
            <Ionicons 
              name={item.name === 'Favourites' ? "star" : "menu"} 
              size={24} 
              color={item.name === 'Favourites' ? currentTheme.warning : (isActive ? currentTheme.primary : currentTheme.textSecondary)} 
              style={styles.dragIcon}
            />
            
            <View style={styles.groupNameContainer}>
              <Text style={[styles.groupName, { color: currentTheme.text }]}>
                {item.name} {item.name === 'Favourites' && '⭐'}
              </Text>
              <Text style={[styles.groupCount, { color: currentTheme.textSecondary }]}>
                {item.itemCount || 0} {t.items_lower}
              </Text>
            </View>
          </View>

          <View style={styles.groupActions}>
            {/* ✅ Hide actions for Favourites */}
            {item.name !== 'Favourites' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { 
                    backgroundColor: item.active ? currentTheme.success : currentTheme.inactive 
                  }]}
                  onPress={() => toggleActive(item)}
                  disabled={loading}
                >
                  <Ionicons name={item.active ? "eye" : "eye-off"} size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: currentTheme.primary }]}
                  onPress={() => openEditForm(item)}
                  disabled={loading}
                >
                  <Ionicons name="pencil" size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: currentTheme.danger }]}
                  onPress={() => handleDeleteGroup(item)}
                  disabled={loading}
                >
                  <Ionicons name="trash" size={18} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  }, [currentTheme, loading, t]);

  return (
     <GestureHandlerRootView style={{ flex: 1 }}>
       <SafeAreaView style={{ flex: 1, backgroundColor: currentTheme.background }}>
    <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
          
          {/* Header Section */}
         <View>
    <Text style={[styles.title, { color: currentTheme.text }]}>
        {t.dishGroupManagement}
    </Text>

    <Text style={[styles.dragHint, { color: currentTheme.textSecondary }]}>
        👆 Long press and drag to reorder groups
    </Text>

    {/* ✅ ADD DEPARTMENT FILTER HERE */}
    {is3LayerMode && departments && departments.length > 0 && (
    <View style={styles.filterContainer}>
        <Text style={[styles.filterLabel, { color: currentTheme.textSecondary }]}>
            Filter by Department:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
                style={[
                    styles.filterChip,
                    !filterDepartmentId && { backgroundColor: currentTheme.primary }
                ]}
                onPress={() => setFilterDepartmentId(null)}
            >
                <Text style={{ color: !filterDepartmentId ? '#fff' : currentTheme.text }}>
                    All
                </Text>
            </TouchableOpacity>
            {departments.map(dept => (
                <TouchableOpacity
                    key={dept.Id}
                    style={[
                        styles.filterChip,
                        filterDepartmentId === dept.Id && { backgroundColor: currentTheme.primary }
                    ]}
                    onPress={() => setFilterDepartmentId(dept.Id)}
                >
                    <Text style={{ color: filterDepartmentId === dept.Id ? '#fff' : currentTheme.text }}>
                        {dept.Name}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    </View>
)}

    <TouchableOpacity
        style={[styles.addButton, { backgroundColor: currentTheme.secondary }]}
        onPress={() => {
            setFormActive(true);
            setShowAddGroup(true);
        }}
        disabled={loading}
    >
        <Text style={styles.addButtonText}>{t.addNewGroup}</Text>
    </TouchableOpacity>
</View>

          {/* Loading Indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={currentTheme.primary} />
            </View>
          )}

          {/* Draggable List */}
          <View style={{ flex: 1, marginTop: 10 }}>
            <DraggableFlatList
             data={filteredGroups} 
              onDragEnd={handleDragEnd}
              keyExtractor={(item) => `group-${item.id}`}
              renderItem={renderItem}
              contentContainerStyle={{ 
                paddingBottom: 20,
                flexGrow: 1
              }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              alwaysBounceVertical={true}
              onDragBegin={() => setIsDragging(true)}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={{ color: currentTheme.textSecondary }}>
                    No groups yet. Tap "Add New Group" to create one.
                  </Text>
                </View>
              }
            />
          </View>

          {/* Add Group Modal */}
{/* Add Group Modal - Full Screen Scrollable */}
<Modal visible={showAddGroup} animationType="slide" onRequestClose={() => setShowAddGroup(false)}>
    <SafeAreaView style={{ flex: 1, backgroundColor: currentTheme.background }}>
        {/* Header */}
        <View style={[styles.fullScreenHeader, { backgroundColor: currentTheme.primary }]}>
            <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>{t.addNewGroup}</Text>
            <TouchableOpacity onPress={() => setShowAddGroup(false)} style={styles.fullScreenClose}>
                <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={styles.fullScreenFormContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
        >
            {/* Department Selector */}
            {is3LayerMode && departments && departments.length > 0 && (
                <View style={styles.formField}>
                    <Text style={[styles.formLabel, { color: currentTheme.textSecondary }]}>
                        Department (Optional)
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <TouchableOpacity
                            style={[
                                styles.deptChip,
                                !selectedDeptId && { backgroundColor: currentTheme.primary }
                            ]}
                            onPress={() => setSelectedDeptId(null)}
                        >
                            <Text style={{ color: !selectedDeptId ? '#fff' : currentTheme.text }}>
                                No Department
                            </Text>
                        </TouchableOpacity>
                        {departments.map(dept => (
                            <TouchableOpacity
                                key={dept.Id}
                                style={[
                                    styles.deptChip,
                                    selectedDeptId === dept.Id && { backgroundColor: currentTheme.primary }
                                ]}
                                onPress={() => {
                                    console.log('📂 Selected department:', dept.Id, dept.Name);
                                    setSelectedDeptId(dept.Id);
                                    if (onDepartmentChange) onDepartmentChange(dept.Id);
                                }}
                            >
                                <Text style={{ color: selectedDeptId === dept.Id ? '#fff' : currentTheme.text }}>
                                    {dept.Name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Group Name */}
            <Text style={[styles.formLabel, { color: currentTheme.textSecondary }]}>Category Name *</Text>
            <TextInput
                style={[styles.formInput, {
                    backgroundColor: currentTheme.surface,
                    borderColor: currentTheme.border,
                    color: currentTheme.text
                }]}
                placeholder="Enter Category name"
                placeholderTextColor={currentTheme.textSecondary}
                value={newGroupName}
                onChangeText={setNewGroupName}
                editable={!loading}
            />

            {/* Active Switch */}
            <View style={styles.activeRow}>
                <Text style={[styles.activeLabel, { color: currentTheme.text }]}>Active</Text>
                <Switch
                    value={formActive}
                    onValueChange={setFormActive}
                    trackColor={{ false: currentTheme.inactive, true: currentTheme.success }}
                    thumbColor="#fff"
                />
            </View>

            {/* Buttons */}
            <View style={styles.formButtons}>
                <TouchableOpacity
                    style={[styles.formCancelBtn, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}
                    onPress={() => {
                        setShowAddGroup(false);
                        setNewGroupName('');
                        setFormActive(true);
                        setSelectedDeptId(filterDepartmentId || null);
                    }}
                    disabled={loading}
                >
                    <Text style={[styles.formCancelText, { color: currentTheme.text }]}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                    style={[styles.formSaveBtn, { backgroundColor: currentTheme.primary }]}
                    onPress={handleAddGroup}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator size="small" color="#fff" /> :
                        <Text style={styles.formSaveText}>Save</Text>}
                </TouchableOpacity>
            </View>
            
            <View style={{ height: 30 }} />
        </ScrollView>
    </SafeAreaView>
</Modal>
          {/* Edit Group Modal */}
         {/* Edit Group Modal - Full Screen Scrollable */}
<Modal visible={showEditGroup} animationType="slide" onRequestClose={() => setShowEditGroup(false)}>
    <SafeAreaView style={{ flex: 1, backgroundColor: currentTheme.background }}>
        {/* Header */}
        <View style={[styles.fullScreenHeader, { backgroundColor: currentTheme.primary }]}>
            <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>{t.edit}</Text>
            <TouchableOpacity onPress={() => setShowEditGroup(false)} style={styles.fullScreenClose}>
                <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={styles.fullScreenFormContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
        >
            {/* Department Selector */}
            {is3LayerMode && departments && departments.length > 0 && (
                <View style={styles.formField}>
                    <Text style={[styles.formLabel, { color: currentTheme.textSecondary }]}>
                        Department
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <TouchableOpacity
                            style={[
                                styles.deptChip,
                                !selectedDeptId && { backgroundColor: currentTheme.primary }
                            ]}
                            onPress={() => setSelectedDeptId(null)}
                        >
                            <Text style={{ color: !selectedDeptId ? '#fff' : currentTheme.text }}>
                                No Department
                            </Text>
                        </TouchableOpacity>
                        {departments.map(dept => (
                            <TouchableOpacity
                                key={dept.Id}
                                style={[
                                    styles.deptChip,
                                    selectedDeptId === dept.Id && { backgroundColor: currentTheme.primary }
                                ]}
                                onPress={() => {
                                    console.log('📂 Selected department:', dept.Id, dept.Name);
                                    setSelectedDeptId(dept.Id);
                                    if (onDepartmentChange) onDepartmentChange(dept.Id);
                                }}
                            >
                                <Text style={{ color: selectedDeptId === dept.Id ? '#fff' : currentTheme.text }}>
                                    {dept.Name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Group Name */}
            <Text style={[styles.formLabel, { color: currentTheme.textSecondary }]}>Category Name *</Text>
            <TextInput
                style={[styles.formInput, {
                    backgroundColor: currentTheme.surface,
                    borderColor: currentTheme.border,
                    color: currentTheme.text
                }]}
                placeholder="Enter Category name"
                placeholderTextColor={currentTheme.textSecondary}
                value={newGroupName}
                onChangeText={setNewGroupName}
                editable={!loading}
            />

            {/* Active Switch */}
            <View style={styles.activeRow}>
                <Text style={[styles.activeLabel, { color: currentTheme.text }]}>Active</Text>
                <Switch
                    value={formActive}
                    onValueChange={setFormActive}
                    trackColor={{ false: currentTheme.inactive, true: currentTheme.success }}
                    thumbColor="#fff"
                />
            </View>

            {/* Buttons */}
            <View style={styles.formButtons}>
                <TouchableOpacity
                    style={[styles.formCancelBtn, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}
                    onPress={() => {
                        setShowEditGroup(false);
                        setEditingGroup(null);
                        setNewGroupName('');
                        setFormActive(true);
                    }}
                    disabled={loading}
                >
                    <Text style={[styles.formCancelText, { color: currentTheme.text }]}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                    style={[styles.formSaveBtn, { backgroundColor: currentTheme.primary }]}
                    onPress={handleEditGroup}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator size="small" color="#fff" /> :
                        <Text style={styles.formSaveText}>Update</Text>}
                </TouchableOpacity>
            </View>
            
            <View style={{ height: 30 }} />
        </ScrollView>
    </SafeAreaView>
</Modal>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16 
  },
  title: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 8, 
    includeFontPadding: false 
  },
  dragHint: { 
    fontSize: 12, 
    marginBottom: 12, 
    fontStyle: 'italic',
    includeFontPadding: false 
  },
  addButton: { 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginBottom: 16, 
    minHeight: 50, 
    justifyContent: 'center' 
  },
  addButtonText: { 
    color: '#ffffff', 
    fontSize: 15, 
    fontWeight: '600', 
    includeFontPadding: false 
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    zIndex: 1000,
  },
  groupCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 10, 
    marginBottom: 8, 
    borderWidth: 1,
    minHeight: 70,
  },
  favouritesGroup: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderColor: '#FFC107',
  },
  groupInfo: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragIcon: {
    padding: 4,
    marginRight: 8,
  },
  groupNameContainer: {
    flex: 1,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  departmentSelector: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    minHeight: 50,
    marginBottom: 16,
  },
  departmentChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  departmentChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  groupName: { 
    fontSize: 15, 
    fontWeight: '600', 
    marginBottom: 2,
    includeFontPadding: false 
  },
  groupCount: { 
    fontSize: 12,
    includeFontPadding: false 
  },
  groupActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    padding: 16 
  },
  modalContent: { 
    borderRadius: 16, 
    padding: 20 
  },
  filterContainer: {
    marginBottom: 16,
    marginTop: 8,
},
filterLabel: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
},
filterScroll: {
    flexDirection: 'row',
    marginBottom: 8,
},
filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
},
filterChipText: {
    fontSize: 13,
    fontWeight: '500',
},
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 16, 
    textAlign: 'center', 
    includeFontPadding: false 
  },
  modalInput: { 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    fontSize: 14, 
    marginBottom: 16, 
    minHeight: 50 
  },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activeLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 8 
  },
  modalBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginHorizontal: 4, 
    minHeight: 48, 
    justifyContent: 'center' 
  },
  cancelBtn: { 
    borderWidth: 1 
  },
  cancelBtnText: { 
    fontSize: 14, 
    fontWeight: '600', 
    includeFontPadding: false 
  },
  saveBtn: { 
    backgroundColor: '#4CAF50' 
  },
  saveBtnText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600', 
    includeFontPadding: false 
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
},
fullScreenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
},
fullScreenClose: {
    padding: 5,
},
fullScreenFormContent: {
    padding: 20,
    paddingBottom: 40,
},
deptChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
},

formInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 20,
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
formSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
},
});

export default DishGroupManagement;