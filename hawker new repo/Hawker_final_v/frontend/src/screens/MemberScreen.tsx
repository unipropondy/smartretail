import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, RefreshControl, FlatList,
    KeyboardAvoidingView, Platform, ScrollView, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import API from '../api';

interface Member {
    Id: number;
    Name: string;
    Mobile: string;
    Address: string;
    Email: string;
    JoinedDate: string;
    TotalSpent: number;
    TotalVisits: number;
    CurrentBalance: number;
    IsActive: boolean;
}

interface MemberScreenProps {
    visible: boolean;
    onClose: () => void;
    theme: any;
    t: any;
    outletId?: number;
}

const MemberScreen: React.FC<MemberScreenProps> = ({ visible, onClose, theme, t, outletId }) => {
    const insets = useSafeAreaInsets();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    
    // Form state
    const [formName, setFormName] = useState('');
    const [formMobile, setFormMobile] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Track keyboard visibility
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setKeyboardVisible(true);
        });
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardVisible(false);
        });

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);
    useEffect(() => {
        if (visible) {
            loadMembers();
        }
    }, [visible, searchText]);

    const loadMembers = async () => {
        setLoading(true);
        try {
            const url = searchText 
                ? `/members?search=${encodeURIComponent(searchText)}`
                : '/members';
            const response = await API.get(url);
            setMembers(response.data || []);
        } catch (error) {
            console.log('❌ Error loading members:', error);
            Alert.alert('Error', 'Failed to load members');
        } finally {
            setLoading(false);
        }
    };

   const handleAddMember = async () => {
    if (!formName.trim() || !formMobile.trim()) {
        Alert.alert('Error', 'Name and mobile number are required');
        return;
    }
    
    // ✅ Flexible mobile validation - Support 8 to 15 digits
    const mobileRegex = /^\d{8,15}$/;
    if (!mobileRegex.test(formMobile.trim())) {
        Alert.alert('Error', 'Please enter valid mobile number (8-15 digits)');
        return;
    }
    
    setSaving(true);
    try {
        const response = await API.post('/members', {
            name: formName.trim(),
            mobile: formMobile.trim(),
            address: formAddress.trim(),
            email: formEmail.trim(),
            notes: formNotes.trim()
        });
        
        if (response.data.success) {
            Alert.alert('Success', 'Member added successfully');
            setShowAddForm(false);
            resetForm();
            loadMembers();
        }
    } catch (error: any) {
        Alert.alert('Error', error.response?.data?.error || 'Failed to add member');
    } finally {
        setSaving(false);
    }
};

    const resetForm = () => {
        setFormName('');
        setFormMobile('');
        setFormAddress('');
        setFormEmail('');
        setFormNotes('');
        Keyboard.dismiss();
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const formatCurrency = (amount: number) => {
        return `₹${(amount || 0).toFixed(2)}`;
    };

return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: theme.background, flex: 1 }]}>
            
            {/* Header - Fixed at top */}
            <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + 10 }]}>
                <View style={styles.headerLeft}>
                    <Ionicons name="people" size={24} color="#fff" />
                    <Text style={styles.headerTitle}>Member Management</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* ✅ Scrollable content - This will scroll when keyboard appears */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                >
                    {/* Search Bar */}
                    <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Ionicons name="search" size={20} color={theme.textSecondary} />
                        <TextInput
                            style={[styles.searchInput, { color: theme.text }]}
                            placeholder="Search by name or mobile..."
                            placeholderTextColor={theme.textSecondary}
                            value={searchText}
                            onChangeText={setSearchText}
                            returnKeyType="search"
                            onSubmitEditing={() => Keyboard.dismiss()}
                        />
                        {searchText !== '' && (
                            <TouchableOpacity onPress={() => setSearchText('')}>
                                <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Add Member Button */}
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: theme.success }]}
                        onPress={() => setShowAddForm(true)}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                        <Text style={styles.addButtonText}>Add New Member</Text>
                    </TouchableOpacity>

                    {/* Members List - No need for FlatList scrolling separately */}
                    {members.map((member) => (
                        <TouchableOpacity
                            key={member.Id}
                            style={[styles.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                            onPress={() => setSelectedMember(member)}
                        >
                            <View style={styles.memberAvatar}>
                                <Text style={styles.memberAvatarText}>
                                    {member.Name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            
                            <View style={styles.memberInfo}>
                                <Text style={[styles.memberName, { color: theme.text }]}>{member.Name}</Text>
                                <Text style={[styles.memberMobile, { color: theme.textSecondary }]}>
                                    📱 {member.Mobile}
                                </Text>
                                <Text style={[styles.memberStats, { color: theme.textSecondary }]}>
                                    💰 {formatCurrency(member.TotalSpent)} | 🎟️ {member.TotalVisits} visits
                                </Text>
                            </View>
                            
                            <View style={styles.memberBalance}>
                                <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Balance</Text>
                                <Text style={[styles.balanceValue, { color: theme.success }]}>
                                    {formatCurrency(member.CurrentBalance || 0)}
                                </Text>
                            </View>
                            
                            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                        </TouchableOpacity>
                    ))}

                    {loading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    )}

                    {!loading && members.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={50} color={theme.textSecondary} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                {searchText ? 'No members found' : 'No members yet'}
                            </Text>
                            {!searchText && (
                                <TouchableOpacity onPress={() => setShowAddForm(true)}>
                                    <Text style={[styles.emptyAddText, { color: theme.primary }]}>
                                        Add your first member
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    
                    {/* Extra bottom space for better scrolling */}
                    <View style={{ height: 30 }} />
                </ScrollView>
            </KeyboardAvoidingView>
                {/* ✅ FIXED: Add Member Modal with proper keyboard handling */}
{/* ✅ FIXED: Add Member Modal */}
{/* ✅ FIXED: Add Member Modal with proper keyboard handling */}
{/* ✅ FULL SCREEN ADD MEMBER MODAL */}
<Modal 
    visible={showAddForm} 
    transparent={false}  // ✅ Change to false for full screen
    animationType="slide" 
    onRequestClose={() => setShowAddForm(false)}
>
    <View style={[styles.fullScreenModal, { backgroundColor: theme.background }]}>
        
        {/* Header */}
        <View style={[styles.fullScreenHeader, { backgroundColor: theme.primary }]}>
            <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>Add New Member</Text>
            <TouchableOpacity onPress={() => {
                setShowAddForm(false);
                resetForm();
            }} style={styles.fullScreenClose}>
                <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
            style={styles.fullScreenScroll}
            contentContainerStyle={styles.fullScreenContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
        >
            <Text style={[styles.fullScreenLabel, { color: theme.textSecondary }]}>Name *</Text>
            <TextInput
                style={[styles.fullScreenInput, { 
                    backgroundColor: theme.surface, 
                    borderColor: theme.border, 
                    color: theme.text 
                }]}
                placeholder="Enter member name"
                placeholderTextColor={theme.textSecondary}
                value={formName}
                onChangeText={setFormName}
            />

            <Text style={[styles.fullScreenLabel, { color: theme.textSecondary }]}>Mobile Number *</Text>
            <TextInput
    style={[styles.fullScreenInput, { 
        backgroundColor: theme.surface, 
        borderColor: theme.border, 
        color: theme.text 
    }]}
    placeholder="Enter mobile number (8-15 digits)"
    placeholderTextColor={theme.textSecondary}
    keyboardType="phone-pad"
    maxLength={15}  // ✅ Changed from 10 to 15
    value={formMobile}
    onChangeText={setFormMobile}
/>

            <Text style={[styles.fullScreenLabel, { color: theme.textSecondary }]}>Address (Optional)</Text>
            <TextInput
                style={[styles.fullScreenInput, styles.fullScreenTextArea, { 
                    backgroundColor: theme.surface, 
                    borderColor: theme.border, 
                    color: theme.text 
                }]}
                placeholder="Enter address"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                value={formAddress}
                onChangeText={setFormAddress}
            />

            <Text style={[styles.fullScreenLabel, { color: theme.textSecondary }]}>Email (Optional)</Text>
            <TextInput
                style={[styles.fullScreenInput, { 
                    backgroundColor: theme.surface, 
                    borderColor: theme.border, 
                    color: theme.text 
                }]}
                placeholder="Enter email"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                value={formEmail}
                onChangeText={setFormEmail}
            />

            {/* Buttons at bottom */}
            <View style={styles.fullScreenButtons}>
                <TouchableOpacity
                    style={[styles.fullScreenCancelBtn, { borderColor: theme.border }]}
                    onPress={() => {
                        setShowAddForm(false);
                        resetForm();
                    }}
                >
                    <Text style={[styles.fullScreenCancelText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                    style={[styles.fullScreenSaveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleAddMember}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.fullScreenSaveText}>Save Member</Text>
                    )}
                </TouchableOpacity>
            </View>
            
            {/* Extra bottom space */}
            <View style={{ height: 30 }} />
        </ScrollView>
    </View>
</Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 50,
    },
    keyboardAvoidingView: {
        flex: 1,
    },
  formScroll: {
    maxHeight: 400,
},
formScrollContent: {
    paddingBottom: 10,
},

textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
},

  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 1,
},
   formModalContent: {
    width: '120%',
    maxWidth: 800,
    maxHeight: '110%',
    borderRadius: 30,
    padding: 30,
    backgroundColor: '#fff', // Will be overridden by theme
},
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    closeBtn: { padding: 5 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 14,
        borderRadius: 12,
    },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    listContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    loadingContainer: { padding: 40, alignItems: 'center' },
    emptyContainer: { padding: 50, alignItems: 'center' },
    emptyText: { fontSize: 16, marginTop: 10 },
    emptyAddText: { fontSize: 14, marginTop: 10, fontWeight: '600' },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
    },
    memberAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FF4444',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    memberAvatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    memberMobile: { fontSize: 12, marginBottom: 2 },
    memberStats: { fontSize: 11 },
    memberBalance: { alignItems: 'flex-end', marginRight: 8 },
    balanceLabel: { fontSize: 10 },
    balanceValue: { fontSize: 14, fontWeight: '700' },
   
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 1,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    
},
    formTitle: {
    fontSize: 20,
    fontWeight: '700',
},

   
    formLabel: {
    fontSize: 14,
    marginBottom: 5,
    marginTop: 10,
},
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    minHeight: 48,
},

 formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
     flexShrink: 0,
},
  formCancelBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
},
    formCancelText: {
    fontSize: 16,
    fontWeight: '600',
},
// Full Screen Modal Styles
fullScreenModal: {
    flex: 1,
    
},
fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 1,
    borderRadius: 10,
},
fullScreenTitle: {
    fontSize: 20,
    fontWeight: '400',
    
},
fullScreenClose: {
    padding: 5,
},
fullScreenScroll: {
    flex: 1,
},
fullScreenContent: {
    padding: 10,
    paddingBottom: 10,
    
},
fullScreenLabel: {
    fontSize: 14,
    marginBottom: 1,
    marginTop: 1,
    
},
fullScreenInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 7,
    minHeight: 40,
},
fullScreenTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    
},
fullScreenButtons: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 30,
    
},
fullScreenCancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
},
fullScreenCancelText: {
    fontSize: 16,
    fontWeight: '600',
},
fullScreenSaveBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
},
fullScreenSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
},
    formSaveBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    formSaveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default MemberScreen;