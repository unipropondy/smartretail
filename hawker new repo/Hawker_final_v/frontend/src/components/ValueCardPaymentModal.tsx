import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../api';

interface ValueCardPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onBack: () => void;
    onSuccess: (amountUsed: number, remainingAmount: number, cardDetails: any) => void;
    totalAmount: number;
    theme: any;
    t: any;
    formatPrice: (amount: number) => string;
}

const ValueCardPaymentModal: React.FC<ValueCardPaymentModalProps> = ({
    visible,
    onClose,
    onBack,
    onSuccess,
    totalAmount,
    theme,
    t,
    formatPrice
}) => {
    const [step, setStep] = useState<'search' | 'amount'>('search');
    const [searchText, setSearchText] = useState('');
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCard, setSelectedCard] = useState<any>(null);
    const [useAmount, setUseAmount] = useState('');
    const [processing, setProcessing] = useState(false);
    const [filteredMembers, setFilteredMembers] = useState<any[]>([]);

    useEffect(() => {
        if (visible && step === 'search') {
            loadMembersWithCards();
        }
    }, [visible, step]);

    useEffect(() => {
        if (searchText.trim()) {
            const searchLower = searchText.toLowerCase();
            setFilteredMembers(members.filter(m => 
                m.MemberName?.toLowerCase().includes(searchLower) ||
                m.MemberMobile?.includes(searchText) ||
                m.CardNumber?.toLowerCase().includes(searchLower)
            ));
        } else {
            setFilteredMembers(members);
        }
    }, [searchText, members]);

    const loadMembersWithCards = async () => {
        setLoading(true);
        try {
            // Get all active value cards
            const response = await API.get('/value-cards');
            const cards = response.data || [];
            
            // Filter only cards with balance > 0
            const activeCards = cards.filter((c: any) => c.Balance > 0 && c.Status === 'ACTIVE');
            setMembers(activeCards);
            setFilteredMembers(activeCards);
        } catch (error) {
            console.log('Error loading cards:', error);
            Alert.alert('Error', 'Failed to load value cards');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectCard = (card: any) => {
        setSelectedCard(card);
        setStep('amount');
        // Suggest max amount (up to total or balance)
        const maxAmount = Math.min(totalAmount, card.Balance);
        setUseAmount(maxAmount.toString());
    };

const handleUseCard = async () => {
    if (!selectedCard) return;
    
    const amount = parseFloat(useAmount);
    if (isNaN(amount) || amount <= 0) {
        Alert.alert('Error', 'Please enter valid amount');
        return;
    }
    
    if (amount > selectedCard.Balance) {
        Alert.alert('Error', `Insufficient balance. Available: ${formatPrice(selectedCard.Balance)}`);
        return;
    }
    
    if (amount > totalAmount) {
        Alert.alert('Error', `Amount cannot exceed bill total: ${formatPrice(totalAmount)}`);
        return;
    }
    
    setProcessing(true);
    
    const remainingAmount = totalAmount - amount;
    
    // ✅ Close card modal and send back result
    onSuccess(amount, remainingAmount, selectedCard);
    setProcessing(false);
    setStep('search');
    setSelectedCard(null);
    setUseAmount('');
    setSearchText('');
    onClose();
};
    const resetModal = () => {
        setStep('search');
        setSelectedCard(null);
        setUseAmount('');
        setSearchText('');
        setMembers([]);
        setFilteredMembers([]);
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                    
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => {
                            if (step === 'amount') {
                                setStep('search');
                            } else {
                                onBack();
                            }
                        }}>
                            <Ionicons name="arrow-back" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: theme.text }]}>
                            {step === 'search' ? 'Select Value Card' : 'Enter Amount'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {step === 'search' ? (
                        <>
                            {/* Search Bar */}
                            <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <Ionicons name="search" size={20} color={theme.textSecondary} />
                                <TextInput
                                    style={[styles.searchInput, { color: theme.text }]}
                                    placeholder="Search by name, mobile or card number..."
                                    placeholderTextColor={theme.textSecondary}
                                    value={searchText}
                                    onChangeText={setSearchText}
                                    autoFocus={true}
                                />
                                {searchText !== '' && (
                                    <TouchableOpacity onPress={() => setSearchText('')}>
                                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Bill Total Display */}
                            <View style={[styles.totalContainer, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Bill Total</Text>
                                <Text style={[styles.totalValue, { color: theme.primary }]}>{formatPrice(totalAmount)}</Text>
                            </View>

                            {/* Members List */}
                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color={theme.primary} />
                                </View>
                            ) : filteredMembers.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="card-outline" size={50} color={theme.textSecondary} />
                                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                        {searchText ? 'No matching cards found' : 'No active value cards available'}
                                    </Text>
                                </View>
                            ) : (
                                <ScrollView style={styles.listContainer}>
                                    {filteredMembers.map((card) => (
                                        <TouchableOpacity
                                            key={card.Id}
                                            style={[styles.cardItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                                            onPress={() => handleSelectCard(card)}
                                        >
                                            <View style={styles.cardIcon}>
                                                <Ionicons name="card" size={24} color={theme.primary} />
                                            </View>
                                            <View style={styles.cardInfo}>
                                                <Text style={[styles.cardNumber, { color: theme.primary }]}>{card.CardNumber}</Text>
                                                <Text style={[styles.cardMember, { color: theme.text }]}>{card.MemberName}</Text>
                                                <Text style={[styles.cardMobile, { color: theme.textSecondary }]}>{card.MemberMobile}</Text>
                                            </View>
                                            <View style={styles.cardBalance}>
                                                <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Balance</Text>
                                                <Text style={[styles.balanceValue, { color: theme.success }]}>{formatPrice(card.Balance)}</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </>
                    ) : (
                        // Amount Selection Step
                        <>
                            <View style={[styles.selectedCardContainer, { backgroundColor: theme.surface }]}>
                                <Text style={[styles.selectedCardLabel, { color: theme.textSecondary }]}>Selected Card</Text>
                                <Text style={[styles.selectedCardNumber, { color: theme.primary }]}>{selectedCard?.CardNumber}</Text>
                                <Text style={[styles.selectedCardMember, { color: theme.text }]}>{selectedCard?.MemberName}</Text>
                                <Text style={[styles.selectedCardBalance, { color: theme.success }]}>
                                    Available: {formatPrice(selectedCard?.Balance || 0)}
                                </Text>
                            </View>

                            <View style={styles.amountInputContainer}>
                                <Text style={[styles.amountLabel, { color: theme.text }]}>Amount to pay using card</Text>
                                <View style={[styles.amountInputWrapper, { borderColor: theme.primary }]}>
                                    <Text style={[styles.currencySymbol, { color: theme.primary }]}>₹</Text>
                                    <TextInput
                                        style={[styles.amountInput, { color: theme.text }]}
                                        placeholder="0.00"
                                        placeholderTextColor={theme.textSecondary}
                                        keyboardType="numeric"
                                        value={useAmount}
                                        onChangeText={setUseAmount}
                                        autoFocus={true}
                                    />
                                </View>
                            </View>

                            <View style={styles.quickAmountContainer}>
                                <Text style={[styles.quickLabel, { color: theme.textSecondary }]}>Quick Select</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {[100, 200, 500, 1000].map(amount => (
                                        <TouchableOpacity
                                            key={amount}
                                            style={[styles.quickBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                                            onPress={() => setUseAmount(Math.min(amount, totalAmount, selectedCard?.Balance || 0).toString())}
                                        >
                                            <Text style={[styles.quickBtnText, { color: theme.text }]}>{formatPrice(amount)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    <TouchableOpacity
                                        style={[styles.quickBtn, styles.maxBtn, { backgroundColor: theme.primary }]}
                                        onPress={() => setUseAmount(Math.min(totalAmount, selectedCard?.Balance || 0).toString())}
                                    >
                                        <Text style={[styles.quickBtnText, { color: '#fff' }]}>Max</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>

                            <View style={[styles.previewContainer, { backgroundColor: theme.primary + '10' }]}>
                                <View style={styles.previewRow}>
                                    <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Bill Total:</Text>
                                    <Text style={[styles.previewValue, { color: theme.text }]}>{formatPrice(totalAmount)}</Text>
                                </View>
                                <View style={styles.previewRow}>
                                    <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Card Payment:</Text>
                                    <Text style={[styles.previewValue, { color: theme.success }]}>-{formatPrice(parseFloat(useAmount) || 0)}</Text>
                                </View>
                                <View style={[styles.previewDivider, { backgroundColor: theme.border }]} />
                                <View style={styles.previewRow}>
                                    <Text style={[styles.previewLabel, { color: theme.text, fontWeight: '700' }]}>Remaining to Pay:</Text>
                                    <Text style={[styles.previewValue, { color: theme.warning, fontWeight: '700' }]}>
                                        {formatPrice(totalAmount - (parseFloat(useAmount) || 0))}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.payButton, { backgroundColor: theme.success }]}
                                onPress={handleUseCard}
                                disabled={processing}
                            >
                                {processing ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.payButtonText}>
                                        Use Card - {formatPrice(parseFloat(useAmount) || 0)}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 20,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
    },
    totalContainer: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    totalLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    totalValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        marginTop: 10,
        textAlign: 'center',
    },
    listContainer: {
        maxHeight: 400,
    },
    cardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    cardIcon: {
        width: 45,
        height: 45,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardInfo: {
        flex: 1,
    },
    cardNumber: {
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'monospace',
        marginBottom: 2,
    },
    cardMember: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 2,
    },
    cardMobile: {
        fontSize: 11,
    },
    cardBalance: {
        alignItems: 'flex-end',
        marginRight: 8,
    },
    balanceLabel: {
        fontSize: 10,
    },
    balanceValue: {
        fontSize: 14,
        fontWeight: '700',
    },
    selectedCardContainer: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        alignItems: 'center',
    },
    selectedCardLabel: {
        fontSize: 11,
        marginBottom: 4,
    },
    selectedCardNumber: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'monospace',
        marginBottom: 4,
    },
    selectedCardMember: {
        fontSize: 14,
        marginBottom: 4,
    },
    selectedCardBalance: {
        fontSize: 14,
        fontWeight: '600',
    },
    amountInputContainer: {
        marginBottom: 20,
    },
    amountLabel: {
        fontSize: 14,
        marginBottom: 8,
    },
    amountInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 60,
    },
    currencySymbol: {
        fontSize: 24,
        fontWeight: '600',
        marginRight: 12,
    },
    amountInput: {
        flex: 1,
        fontSize: 24,
        padding: 0,
    },
    quickAmountContainer: {
        marginBottom: 20,
    },
    quickLabel: {
        fontSize: 12,
        marginBottom: 8,
    },
    quickBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
        minWidth: 70,
        alignItems: 'center',
    },
    maxBtn: {
        backgroundColor: '#4CAF50',
        borderWidth: 0,
    },
    quickBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    previewContainer: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    previewLabel: {
        fontSize: 14,
    },
    previewValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    previewDivider: {
        height: 1,
        marginVertical: 8,
    },
    payButton: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    payButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default ValueCardPaymentModal;