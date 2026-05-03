import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, ScrollView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    const insets = useSafeAreaInsets();
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
            const response = await API.get('/value-cards');
            const cards = response.data || [];
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
        
        onSuccess(amount, remainingAmount, selectedCard);
        setProcessing(false);
        setStep('search');
        setSelectedCard(null);
        setUseAmount('');
        setSearchText('');
        onClose();
    };

    return (
        <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.fullScreenModal, { backgroundColor: theme.background }]}>
                
                {/* Header */}
                <View style={[styles.fullScreenHeader, { backgroundColor: theme.primary, paddingTop: insets.top + 15 }]}>
                    <TouchableOpacity onPress={() => {
                        if (step === 'amount') {
                            setStep('search');
                        } else {
                            onBack();
                        }
                    }} style={styles.fullScreenBackBtn}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>
                        {step === 'search' ? 'Select Value Card' : 'Enter Amount'}
                    </Text>
                    <TouchableOpacity onPress={onClose} style={styles.fullScreenClose}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView 
                    style={styles.fullScreenScroll}
                    contentContainerStyle={styles.fullScreenContent}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 'search' ? (
                        <>
                            {/* Search Bar */}
                            <View style={[styles.fullSearchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <Ionicons name="search" size={20} color={theme.textSecondary} />
                                <TextInput
                                    style={[styles.fullSearchInput, { color: theme.text }]}
                                    placeholder="Search by name, mobile or card number..."
                                    placeholderTextColor={theme.textSecondary}
                                    value={searchText}
                                    onChangeText={setSearchText}
                                    autoFocus={true}
                                    returnKeyType="search"
                                />
                                {searchText !== '' && (
                                    <TouchableOpacity onPress={() => setSearchText('')}>
                                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Bill Total Display */}
                            <View style={[styles.fullTotalContainer, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={[styles.fullTotalLabel, { color: theme.textSecondary }]}>Bill Total</Text>
                                <Text style={[styles.fullTotalValue, { color: theme.primary }]}>{formatPrice(totalAmount)}</Text>
                            </View>

                            {/* Cards List */}
                            {loading ? (
                                <View style={styles.fullLoadingContainer}>
                                    <ActivityIndicator size="large" color={theme.primary} />
                                </View>
                            ) : filteredMembers.length === 0 ? (
                                <View style={styles.fullEmptyContainer}>
                                    <Ionicons name="card-outline" size={50} color={theme.textSecondary} />
                                    <Text style={[styles.fullEmptyText, { color: theme.textSecondary }]}>
                                        {searchText ? 'No matching cards found' : 'No active value cards available'}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.fullListContainer}>
                                    {filteredMembers.map((card) => (
                                        <TouchableOpacity
                                            key={card.Id}
                                            style={[styles.fullCardItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                                            onPress={() => handleSelectCard(card)}
                                        >
                                            <View style={styles.fullCardIcon}>
                                                <Ionicons name="card" size={24} color={theme.primary} />
                                            </View>
                                            <View style={styles.fullCardInfo}>
                                                <Text style={[styles.fullCardNumber, { color: theme.primary }]}>{card.CardNumber}</Text>
                                                <Text style={[styles.fullCardMember, { color: theme.text }]}>{card.MemberName}</Text>
                                                <Text style={[styles.fullCardMobile, { color: theme.textSecondary }]}>{card.MemberMobile}</Text>
                                            </View>
                                            <View style={styles.fullCardBalance}>
                                                <Text style={[styles.fullBalanceLabel, { color: theme.textSecondary }]}>Balance</Text>
                                                <Text style={[styles.fullBalanceValue, { color: theme.success }]}>{formatPrice(card.Balance)}</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        // Amount Selection Step
                        <>
                            <View style={[styles.fullSelectedCardContainer, { backgroundColor: theme.surface }]}>
                                <Text style={[styles.fullSelectedCardLabel, { color: theme.textSecondary }]}>Selected Card</Text>
                                <Text style={[styles.fullSelectedCardNumber, { color: theme.primary }]}>{selectedCard?.CardNumber}</Text>
                                <Text style={[styles.fullSelectedCardMember, { color: theme.text }]}>{selectedCard?.MemberName}</Text>
                                <Text style={[styles.fullSelectedCardBalance, { color: theme.success }]}>
                                    Available: {formatPrice(selectedCard?.Balance || 0)}
                                </Text>
                            </View>

                            <View style={styles.fullAmountInputContainer}>
                                <Text style={[styles.fullAmountLabel, { color: theme.text }]}>Amount to pay using card</Text>
                                <View style={[styles.fullAmountInputWrapper, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
                                    <Text style={[styles.fullCurrencySymbol, { color: theme.primary }]}>₹</Text>
                                    <TextInput
                                        style={[styles.fullAmountInput, { color: theme.text }]}
                                        placeholder="0.00"
                                        placeholderTextColor={theme.textSecondary}
                                        keyboardType="numeric"
                                        value={useAmount}
                                        onChangeText={setUseAmount}
                                        autoFocus={true}
                                    />
                                </View>
                            </View>

                            <View style={styles.fullQuickAmountContainer}>
                                <Text style={[styles.fullQuickLabel, { color: theme.textSecondary }]}>Quick Select</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fullQuickScroll}>
                                    {[100, 200, 500, 1000].map(amount => (
                                        <TouchableOpacity
                                            key={amount}
                                            style={[styles.fullQuickBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                                            onPress={() => setUseAmount(Math.min(amount, totalAmount, selectedCard?.Balance || 0).toString())}
                                        >
                                            <Text style={[styles.fullQuickBtnText, { color: theme.text }]}>{formatPrice(amount)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    <TouchableOpacity
                                        style={[styles.fullQuickBtn, styles.fullMaxBtn, { backgroundColor: theme.primary }]}
                                        onPress={() => setUseAmount(Math.min(totalAmount, selectedCard?.Balance || 0).toString())}
                                    >
                                        <Text style={[styles.fullQuickBtnText, { color: '#fff' }]}>Max</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>

                            <View style={[styles.fullPreviewContainer, { backgroundColor: theme.primary + '10' }]}>
                                <View style={styles.fullPreviewRow}>
                                    <Text style={[styles.fullPreviewLabel, { color: theme.textSecondary }]}>Bill Total:</Text>
                                    <Text style={[styles.fullPreviewValue, { color: theme.text }]}>{formatPrice(totalAmount)}</Text>
                                </View>
                                <View style={styles.fullPreviewRow}>
                                    <Text style={[styles.fullPreviewLabel, { color: theme.textSecondary }]}>Card Payment:</Text>
                                    <Text style={[styles.fullPreviewValue, { color: theme.success }]}>-{formatPrice(parseFloat(useAmount) || 0)}</Text>
                                </View>
                                <View style={[styles.fullPreviewDivider, { backgroundColor: theme.border }]} />
                                <View style={styles.fullPreviewRow}>
                                    <Text style={[styles.fullPreviewLabel, { color: theme.text, fontWeight: '700' }]}>Remaining to Pay:</Text>
                                    <Text style={[styles.fullPreviewValue, { color: theme.warning, fontWeight: '700' }]}>
                                        {formatPrice(totalAmount - (parseFloat(useAmount) || 0))}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.fullPayButton, { backgroundColor: theme.success }]}
                                onPress={handleUseCard}
                                disabled={processing}
                            >
                                {processing ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.fullPayButtonText}>
                                        Use Card - {formatPrice(parseFloat(useAmount) || 0)}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                    
                    <View style={{ height: 30 }} />
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fullScreenModal: {
        flex: 1,
    },
    fullScreenHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 15,
    },
    fullScreenBackBtn: {
        padding: 8,
    },
    fullScreenTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
    },
    fullScreenClose: {
        padding: 8,
    },
    fullScreenScroll: {
        flex: 1,
    },
    fullScreenContent: {
        padding: 20,
        paddingBottom: 40,
    },
    fullSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 20,
    },
    fullSearchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
    },
    fullTotalContainer: {
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 20,
    },
    fullTotalLabel: {
        fontSize: 14,
        marginBottom: 6,
    },
    fullTotalValue: {
        fontSize: 32,
        fontWeight: '700',
    },
    fullLoadingContainer: {
        padding: 50,
        alignItems: 'center',
    },
    fullEmptyContainer: {
        padding: 50,
        alignItems: 'center',
    },
    fullEmptyText: {
        fontSize: 15,
        marginTop: 12,
        textAlign: 'center',
    },
    fullListContainer: {
        marginBottom: 20,
    },
    fullCardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    fullCardIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    fullCardInfo: {
        flex: 1,
    },
    fullCardNumber: {
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'monospace',
        marginBottom: 3,
    },
    fullCardMember: {
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 2,
    },
    fullCardMobile: {
        fontSize: 12,
    },
    fullCardBalance: {
        alignItems: 'flex-end',
        marginRight: 10,
    },
    fullBalanceLabel: {
        fontSize: 10,
    },
    fullBalanceValue: {
        fontSize: 15,
        fontWeight: '700',
    },
    fullSelectedCardContainer: {
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 25,
    },
    fullSelectedCardLabel: {
        fontSize: 12,
        marginBottom: 5,
    },
    fullSelectedCardNumber: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'monospace',
        marginBottom: 5,
    },
    fullSelectedCardMember: {
        fontSize: 16,
        marginBottom: 5,
    },
    fullSelectedCardBalance: {
        fontSize: 15,
        fontWeight: '600',
    },
    fullAmountInputContainer: {
        marginBottom: 25,
    },
    fullAmountLabel: {
        fontSize: 15,
        marginBottom: 10,
        fontWeight: '500',
    },
    fullAmountInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 14,
        paddingHorizontal: 18,
        height: 70,
    },
    fullCurrencySymbol: {
        fontSize: 28,
        fontWeight: '600',
        marginRight: 14,
    },
    fullAmountInput: {
        flex: 1,
        fontSize: 28,
        padding: 0,
    },
    fullQuickAmountContainer: {
        marginBottom: 25,
    },
    fullQuickLabel: {
        fontSize: 14,
        marginBottom: 12,
        fontWeight: '500',
    },
    fullQuickScroll: {
        maxHeight: 55,
    },
    fullQuickBtn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        borderWidth: 1,
        marginRight: 10,
        minWidth: 80,
        alignItems: 'center',
    },
    fullMaxBtn: {
        borderWidth: 0,
    },
    fullQuickBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    fullPreviewContainer: {
        padding: 18,
        borderRadius: 14,
        marginBottom: 25,
    },
    fullPreviewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    fullPreviewLabel: {
        fontSize: 14,
    },
    fullPreviewValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    fullPreviewDivider: {
        height: 1,
        marginVertical: 10,
    },
    fullPayButton: {
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    fullPayButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
});

export default ValueCardPaymentModal;