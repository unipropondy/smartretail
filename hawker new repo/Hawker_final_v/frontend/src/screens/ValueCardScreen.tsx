import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, RefreshControl,
    ScrollView, KeyboardAvoidingView, Platform, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../api';

interface Member {
    Id: number;
    Name: string;
    Mobile: string;
}

interface ValueCard {
    Id: number;
    MemberId: number;
    CardNumber: string;
    CardValue: number;
    ServiceValue: number;
    TotalValue: number;
    Balance: number;
    Status: string;
    PurchaseDate: string;
    ExpiryDate: string;
    MemberName?: string;
    MemberMobile?: string;
}

interface ValueCardScreenProps {
    visible: boolean;
    onClose: () => void;
    theme: any;
    t: any;
    outletId?: number;
}

const ValueCardScreen: React.FC<ValueCardScreenProps> = ({ visible, onClose, theme, t, outletId }) => {
    const [cards, setCards] = useState<ValueCard[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showTopupModal, setShowTopupModal] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    
    const [selectedCard, setSelectedCard] = useState<ValueCard | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    
    const [selectedCardForTopup, setSelectedCardForTopup] = useState<ValueCard | null>(null);
    const [topupAmount, setTopupAmount] = useState('');
    const [topupNotes, setTopupNotes] = useState('');
    const [topupLoading, setTopupLoading] = useState(false);
    
    const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
    const [cardValue, setCardValue] = useState('');
    const [serviceValue, setServiceValue] = useState('');
    const [showMemberDropdown, setShowMemberDropdown] = useState(false);
    const [saving, setSaving] = useState(false);

    const filteredCards = useMemo(() => {
        if (!searchText.trim()) return cards;
        const searchLower = searchText.toLowerCase();
        return cards.filter(card => 
            card.MemberName?.toLowerCase().includes(searchLower) ||
            card.MemberMobile?.includes(searchText) ||
            card.CardNumber?.toLowerCase().includes(searchLower)
        );
    }, [cards, searchText]);

    useEffect(() => {
        if (visible) {
            loadCards();
            loadMembers();
        }
    }, [visible]);

    const loadCards = async () => {
        setLoading(true);
        try {
            const response = await API.get('/value-cards');
            setCards(response.data || []);
        } catch (error) {
            console.log('Error loading cards:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMembers = async () => {
        try {
            const response = await API.get('/members');
            setMembers(response.data || []);
        } catch (error) {
            console.log('Error loading members:', error);
        }
    };

    const loadTransactions = async (cardId: number) => {
        try {
            const response = await API.get(`/value-cards/${cardId}/transactions`);
            setTransactions(response.data || []);
        } catch (error) {
            console.log('Error loading transactions:', error);
        }
    };

    const resetCreateForm = () => {
        setSelectedMemberId(null);
        setCardValue('');
        setServiceValue('');
        setShowMemberDropdown(false);
    };

    const handleCreateCard = async () => {
        if (!selectedMemberId) {
            Alert.alert('Error', 'Please select a member');
            return;
        }
        
        const cardVal = parseFloat(cardValue);
        if (isNaN(cardVal) || cardVal <= 0) {
            Alert.alert('Error', 'Please enter valid card value');
            return;
        }
        
        setSaving(true);
        try {
            const response = await API.post('/value-cards', {
                memberId: selectedMemberId,
                cardValue: cardVal,
                serviceValue: parseFloat(serviceValue) || 0,
                notes: 'Created via POS'
            });
            
            if (response.data.success) {
                Alert.alert('Success', `Value card created! Card #: ${response.data.card.CardNumber}`);
                setShowCreateForm(false);
                resetCreateForm();
                loadCards();
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to create card');
        } finally {
            setSaving(false);
        }
    };

    const handleTopup = async () => {
        if (!selectedCardForTopup) return;
        
        const amount = parseFloat(topupAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Error', 'Please enter valid amount');
            return;
        }
        
        setTopupLoading(true);
        try {
            const response = await API.post('/value-cards/topup', {
                cardId: selectedCardForTopup.Id,
                topupAmount: amount,
                notes: topupNotes || `Top-up of ₹${amount}`
            });
            
            if (response.data.success) {
                Alert.alert('Success', response.data.message);
                setShowTopupModal(false);
                setTopupAmount('');
                setTopupNotes('');
                setSelectedCardForTopup(null);
                loadCards();
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to topup');
        } finally {
            setTopupLoading(false);
        }
    };

    const handleCardPress = async (card: ValueCard) => {
        setSelectedCard(card);
        await loadTransactions(card.Id);
        setShowHistory(true);
    };

    const formatCurrency = (amount: number) => {
        return `₹${(amount || 0).toFixed(2)}`;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const renderCard = (card: ValueCard) => (
        <TouchableOpacity
            key={card.Id}
            style={[styles.cardContainer, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => handleCardPress(card)}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <View style={styles.cardType}>
                    <Ionicons name="card" size={20} color={theme.primary} />
                    <Text style={[styles.cardNumber, { color: theme.primary }]}>
                        {card.CardNumber}
                    </Text>
                </View>
                <View style={[styles.cardStatus, { 
                    backgroundColor: card.Status === 'ACTIVE' ? theme.success + '20' : theme.danger + '20' 
                }]}>
                    <Text style={[styles.cardStatusText, { 
                        color: card.Status === 'ACTIVE' ? theme.success : theme.danger 
                    }]}>
                        {card.Status}
                    </Text>
                </View>
            </View>

            <View style={styles.cardMember}>
                <Text style={[styles.memberName, { color: theme.text }]}>{card.MemberName || 'Member'}</Text>
                <Text style={[styles.memberMobile, { color: theme.textSecondary }]}>{card.MemberMobile || ''}</Text>
            </View>

            <View style={styles.cardDetails}>
                <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Card Value</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>{formatCurrency(card.CardValue)}</Text>
                </View>
                <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Service</Text>
                    <Text style={[styles.detailValue, { color: theme.success }]}>+{formatCurrency(card.ServiceValue)}</Text>
                </View>
                <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Balance</Text>
                    <Text style={[styles.detailValue, { color: theme.primary, fontWeight: '700' }]}>
                        {formatCurrency(card.Balance)}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                style={[styles.topupButton, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}
                onPress={() => {
                    setSelectedCardForTopup(card);
                    setTopupAmount('');
                    setTopupNotes('');
                    setShowTopupModal(true);
                }}
            >
                <Ionicons name="add-circle" size={18} color={theme.warning} />
                <Text style={[styles.topupButtonText, { color: theme.warning }]}>Top-up</Text>
            </TouchableOpacity>

            <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                💡 Card Fee: ₹{card.CardValue} | Service: ₹{card.ServiceValue}
            </Text>

            <View style={styles.cardFooter}>
                <Text style={[styles.purchaseDate, { color: theme.textSecondary }]}>
                    Purchased: {formatDate(card.PurchaseDate)}
                </Text>
                <TouchableOpacity onPress={() => handleCardPress(card)}>
                    <Text style={[styles.viewHistoryText, { color: theme.primary }]}>View History →</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.background, flex: 1 }]}>
                
                <View style={[styles.header, { backgroundColor: theme.primary }]}>
                    <View style={styles.headerLeft}>
                        <Ionicons name="card" size={24} color="#fff" />
                        <Text style={styles.headerTitle}>Value Cards</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    style={{ flex: 1 }}
                >
                    <ScrollView 
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 30 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={true}
                    >
                        {/* Search */}
                        <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Ionicons name="search" size={20} color={theme.textSecondary} />
                            <TextInput
                                style={[styles.searchInput, { color: theme.text }]}
                                placeholder="Search by member name, mobile or card number..."
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

                        {/* Create Button */}
                        <TouchableOpacity
                            style={[styles.createButton, { backgroundColor: theme.success }]}
                            onPress={() => {
                                resetCreateForm();
                                setShowCreateForm(true);
                            }}
                        >
                            <Ionicons name="add" size={24} color="#fff" />
                            <Text style={styles.createButtonText}>Create Value Card</Text>
                        </TouchableOpacity>

                        {/* Cards List */}
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={theme.primary} />
                            </View>
                        ) : filteredCards.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="card-outline" size={50} color={theme.textSecondary} />
                                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                    {searchText ? 'No matching cards found' : 'No value cards found'}
                                </Text>
                            </View>
                        ) : (
                            filteredCards.map(card => renderCard(card))
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Create Card Modal - FULL SCREEN like MemberScreen */}
                <Modal visible={showCreateForm} transparent={false} animationType="slide" onRequestClose={() => setShowCreateForm(false)}>
                    <View style={[styles.fullScreenModal, { backgroundColor: theme.background }]}>
                        
                        <View style={[styles.fullScreenHeader, { backgroundColor: theme.primary }]}>
                            <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>Create Value Card</Text>
                            <TouchableOpacity onPress={() => setShowCreateForm(false)} style={styles.fullScreenClose}>
                                <Ionicons name="close" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            style={styles.fullScreenScroll}
                            contentContainerStyle={styles.fullScreenContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={true}
                        >
                            <Text style={[styles.fullScreenLabel, { color: theme.textSecondary }]}>Select Member *</Text>
                            <TouchableOpacity
                                style={[styles.dropdownButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                                onPress={() => setShowMemberDropdown(!showMemberDropdown)}
                            >
                                <Text style={[styles.dropdownText, { color: selectedMemberId ? theme.text : theme.textSecondary }]}>
                                    {selectedMemberId 
                                        ? members.find(m => m.Id === selectedMemberId)?.Name || 'Select member'
                                        : 'Select member'}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>

                            {showMemberDropdown && (
                                <View style={[styles.dropdownList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                    <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
                                        {members.map(member => (
                                            <TouchableOpacity
                                                key={member.Id}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setSelectedMemberId(member.Id);
                                                    setShowMemberDropdown(false);
                                                }}
                                            >
                                                <Text style={[styles.dropdownItemName, { color: theme.text }]}>{member.Name}</Text>
                                                <Text style={[styles.dropdownItemMobile, { color: theme.textSecondary }]}>{member.Mobile}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <Text style={[styles.fullScreenLabel, { color: theme.textSecondary }]}>Card Value (₹) *</Text>
                            <TextInput
                                style={[styles.fullScreenInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                                placeholder="Enter card value (e.g., 500)"
                                placeholderTextColor={theme.textSecondary}
                                keyboardType="numeric"
                                value={cardValue}
                                onChangeText={setCardValue}
                            />

                            <Text style={[styles.fullScreenLabel, { color: theme.textSecondary }]}>Service Value (₹)</Text>
                            <TextInput
                                style={[styles.fullScreenInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                                placeholder="Enter service/bonus value (optional)"
                                placeholderTextColor={theme.textSecondary}
                                keyboardType="numeric"
                                value={serviceValue}
                                onChangeText={setServiceValue}
                            />

                            <View style={styles.fullScreenButtons}>
                                <TouchableOpacity
                                    style={[styles.fullScreenCancelBtn, { borderColor: theme.border }]}
                                    onPress={() => setShowCreateForm(false)}
                                >
                                    <Text style={[styles.fullScreenCancelText, { color: theme.text }]}>Cancel</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                    style={[styles.fullScreenSaveBtn, { backgroundColor: theme.primary }]}
                                    onPress={handleCreateCard}
                                    disabled={saving}
                                >
                                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.fullScreenSaveText}>Create Card</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </Modal>

                {/* Top-up Modal */}
                <Modal visible={showTopupModal} transparent={true} animationType="slide" onRequestClose={() => setShowTopupModal(false)}>
                    <View style={styles.formModalOverlay}>
                        <View style={[styles.formModalContent, { backgroundColor: theme.card }]}>
                            <View style={styles.formHeader}>
                                <Text style={[styles.formTitle, { color: theme.text }]}>Top-up Card</Text>
                                <TouchableOpacity onPress={() => setShowTopupModal(false)}>
                                    <Ionicons name="close" size={24} color={theme.text} />
                                </TouchableOpacity>
                            </View>

                            {selectedCardForTopup && (
                                <ScrollView>
                                    <Text style={[styles.fullScreenLabel, { color: theme.textSecondary }]}>Top-up Amount (₹) *</Text>
                                    <TextInput
                                        style={[styles.fullScreenInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                                        placeholder="Enter amount to add"
                                        placeholderTextColor={theme.textSecondary}
                                        keyboardType="numeric"
                                        value={topupAmount}
                                        onChangeText={setTopupAmount}
                                    />

                                    <View style={styles.fullScreenButtons}>
                                        <TouchableOpacity
                                            style={[styles.fullScreenCancelBtn, { borderColor: theme.border }]}
                                            onPress={() => setShowTopupModal(false)}
                                        >
                                            <Text style={[styles.fullScreenCancelText, { color: theme.text }]}>Cancel</Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity
                                            style={[styles.fullScreenSaveBtn, { backgroundColor: theme.warning }]}
                                            onPress={handleTopup}
                                            disabled={topupLoading}
                                        >
                                            {topupLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.fullScreenSaveText}>Add Top-up</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>

                {/* History Modal */}
                <Modal visible={showHistory} transparent={true} animationType="slide" onRequestClose={() => setShowHistory(false)}>
                    <View style={styles.historyModalOverlay}>
                        <View style={[styles.historyModalContent, { backgroundColor: theme.card }]}>
                            <View style={styles.formHeader}>
                                <Text style={[styles.formTitle, { color: theme.text }]}>Transaction History</Text>
                                <TouchableOpacity onPress={() => setShowHistory(false)}>
                                    <Ionicons name="close" size={24} color={theme.text} />
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.fullScreenLabel, { color: theme.textSecondary }]}>Coming soon...</Text>
                        </View>
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
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    closeBtn: { padding: 5 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 14,
        borderRadius: 12,
    },
    createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    loadingContainer: { padding: 40, alignItems: 'center' },
    emptyContainer: { padding: 50, alignItems: 'center' },
    emptyText: { fontSize: 16, marginTop: 10 },
    cardContainer: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        marginHorizontal: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardType: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardNumber: { fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
    cardStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    cardStatusText: { fontSize: 11, fontWeight: '600' },
    cardMember: { marginBottom: 12 },
    memberName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    memberMobile: { fontSize: 12 },
    cardDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    detailItem: { alignItems: 'center', flex: 1 },
    detailLabel: { fontSize: 10, marginBottom: 4 },
    detailValue: { fontSize: 14, fontWeight: '600' },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    purchaseDate: { fontSize: 11 },
    viewHistoryText: { fontSize: 12, fontWeight: '600' },
    noteText: {
        fontSize: 10,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 8,
        fontStyle: 'italic',
    },
    topupButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        alignSelf: 'center',
        minWidth: 100,
    },
    topupButtonText: { fontSize: 14, fontWeight: '600' },
    
    // Full Screen Modal Styles (like MemberScreen)
    fullScreenModal: { flex: 1 },
    fullScreenHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
    },
    fullScreenTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    fullScreenClose: { padding: 5 },
    fullScreenScroll: { flex: 1 },
    fullScreenContent: { padding: 20, paddingBottom: 40 },
    fullScreenLabel: { fontSize: 14, marginBottom: 5, marginTop: 15 },
    fullScreenInput: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        fontSize: 15,
        marginBottom: 10,
        minHeight: 50,
    },
    fullScreenButtons: { flexDirection: 'row', gap: 15, marginTop: 30 },
    fullScreenCancelBtn: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    fullScreenCancelText: { fontSize: 16, fontWeight: '600' },
    fullScreenSaveBtn: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    fullScreenSaveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
    },
    dropdownText: { fontSize: 14 },
    dropdownList: {
        borderWidth: 1,
        borderRadius: 10,
        marginTop: -5,
        marginBottom: 10,
        maxHeight: 200,
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    dropdownItemName: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
    dropdownItemMobile: { fontSize: 12 },
    
    formModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    formModalContent: {
        borderRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    formTitle: { fontSize: 20, fontWeight: '700' },
    historyModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    historyModalContent: {
        borderRadius: 20,
        padding: 20,
        maxHeight: '90%',
    },
});

export default ValueCardScreen;