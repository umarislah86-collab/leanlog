import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { RedCoinsAccount, RedCoinsEntry } from '../services/redcoins';
import {
  computeBalanceSheet,
  PRESET_OPTIONS,
  resolveComparisonDate,
  type AccountGroupSnapshot,
  type AccountItemSnapshot,
  type BalanceSheetData,
  type ComparisonPreset,
  type SectionSnapshot,
  type TrendDirection,
} from '../services/balanceSheet';

const C = {
  ink: '#111A2A',
  paper: '#FFF9EA',
  cream: '#F0E6D4',
  coral: '#F04444',
  mint: '#83D8B4',
  green: '#18A879',
  blue: '#528FF2',
  muted: '#7C8290',
  white: '#FFFFFF',
  gold: '#E7B84A',
  border: '#E7DECE',
};

const money = (n = 0) =>
  `RM ${Math.abs(n).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

interface BalanceSheetViewProps {
  accounts: RedCoinsAccount[];
  entries: RedCoinsEntry[];
  onSelectAccount?: (accountName: string) => void;
}

export default function BalanceSheetView({
  accounts,
  entries,
  onSelectAccount,
}: BalanceSheetViewProps) {
  const [referenceDate] = useState(() => new Date());
  const [preset, setPreset] = useState<ComparisonPreset>('same_time_last_month');
  const [customComparisonDate, setCustomComparisonDate] = useState<Date | null>(null);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  const activeComparisonDate = useMemo(() => {
    if (customComparisonDate) return customComparisonDate;
    return resolveComparisonDate(preset, referenceDate);
  }, [preset, referenceDate, customComparisonDate]);

  const data: BalanceSheetData = useMemo(() => {
    return computeBalanceSheet(accounts, entries, activeComparisonDate, referenceDate, preset);
  }, [accounts, entries, activeComparisonDate, referenceDate, preset]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentPresetLabel = useMemo(() => {
    if (customComparisonDate) {
      return 'Custom Date';
    }
    return PRESET_OPTIONS.find((p) => p.id === preset)?.label || 'Compare';
  }, [preset, customComparisonDate]);

  const selectPreset = (newPreset: ComparisonPreset) => {
    setPreset(newPreset);
    setCustomComparisonDate(null);
    setPresetModalVisible(false);
  };

  return (
    <View style={s.container}>
      {/* Top Controls: Timeline & Preset Dropdown */}
      <View style={s.topControls}>
        <TouchableOpacity
          style={s.timelineButton}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="trending-up-outline" size={16} color={C.coral} />
          <Text style={s.timelineText}>Timeline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.presetPill}
          onPress={() => setPresetModalVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar-outline" size={15} color={C.coral} />
          <Text style={s.presetPillText}>{currentPresetLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={C.coral} />
        </TouchableOpacity>
      </View>

      {/* Date Column Headers */}
      <View style={s.dateHeaderRow}>
        <TouchableOpacity
          style={s.dateColLeft}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Text style={s.dateHeaderText}>{formatDate(activeComparisonDate)}</Text>
        </TouchableOpacity>
        <View style={s.dateColRight}>
          <Text style={s.dateHeaderText}>{formatDate(referenceDate)}</Text>
        </View>
      </View>

      {/* Balance Sheet Groups */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {/* Assets Section */}
        <SectionBlock
          section={data.assets}
          isLiability={false}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          onSelectAccount={onSelectAccount}
        />

        {/* Liabilities Section */}
        <SectionBlock
          section={data.liabilities}
          isLiability={true}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          onSelectAccount={onSelectAccount}
        />

        {/* Net Worth Summary Card */}
        <View style={s.netWorthCard}>
          <View style={s.netWorthHeader}>
            <Text style={s.netWorthTitle}>Net Worth</Text>
            <View style={s.valuesRow}>
              <Text style={s.pastValue}>{money(data.netWorth.past)}</Text>
              <View style={s.currentValueWithTrend}>
                <Text style={[s.currentValue, data.netWorth.current < 0 && { color: C.coral }]}>
                  {money(data.netWorth.current)}
                </Text>
                <TrendBadge trend={data.netWorth.trend} isDebt={false} />
              </View>
            </View>
          </View>
          <View style={s.netWorthDeltaRow}>
            <Text style={s.netWorthDeltaLabel}>Change since comparison</Text>
            <Text
              style={[
                s.netWorthDeltaValue,
                { color: data.netWorth.delta >= 0 ? C.green : C.coral },
              ]}
            >
              {data.netWorth.delta >= 0 ? '+ ' : '− '}
              {money(data.netWorth.delta)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Preset Bottom Sheet Modal */}
      <Modal
        visible={presetModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPresetModalVisible(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setPresetModalVisible(false)}>
          <Pressable style={s.modalContent} onPress={() => {}}>
            <View style={s.modalGrabBar} />
            <Text style={s.modalHeaderTitle}>Compare balances to:</Text>
            <View style={s.modalDivider} />

            <ScrollView style={s.optionsList}>
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = !customComparisonDate && preset === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.optionRow, isSelected && s.optionRowActive]}
                    onPress={() => selectPreset(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.optionLabel, isSelected && s.optionLabelActive]}>
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={C.coral} />
                    )}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[s.optionRow, !!customComparisonDate && s.optionRowActive]}
                onPress={() => {
                  setPresetModalVisible(false);
                  setShowDatePicker(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[s.optionLabel, !!customComparisonDate && s.optionLabelActive]}>
                  Custom Date Picker…
                </Text>
                {!!customComparisonDate && (
                  <Ionicons name="checkmark-circle" size={18} color={C.coral} />
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Custom Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={activeComparisonDate}
          mode="date"
          maximumDate={new Date()}
          onChange={(_: any, selected?: Date) => {
            setShowDatePicker(false);
            if (selected) {
              setCustomComparisonDate(selected);
            }
          }}
        />
      )}
    </View>
  );
}

function SectionBlock({
  section,
  isLiability,
  collapsedGroups,
  onToggleGroup,
  onSelectAccount,
}: {
  section: SectionSnapshot;
  isLiability: boolean;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onSelectAccount?: (name: string) => void;
}) {
  return (
    <View style={s.sectionContainer}>
      {/* Main Section Header (Assets / Liabilities) */}
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, isLiability && { color: C.coral }]}>
          {section.title}
        </Text>
        <View style={s.valuesRow}>
          <Text style={s.pastValueMain}>{money(section.pastTotal)}</Text>
          <View style={s.currentValueWithTrend}>
            <Text
              style={[
                s.currentValueMain,
                { color: isLiability ? (section.currentTotal > 0 ? C.coral : C.ink) : C.green },
              ]}
            >
              {money(section.currentTotal)}
            </Text>
            <TrendBadge trend={section.trend} isDebt={isLiability} />
          </View>
        </View>
      </View>

      {/* Sub-groups (Bank, Cash, Investment, Credit card, Liability) */}
      {section.groups.map((group) => {
        const groupKey = `${section.title}-${group.type}`;
        const isCollapsed = collapsedGroups[groupKey] ?? false;

        return (
          <View key={groupKey} style={s.groupContainer}>
            {/* Group Header Row */}
            <TouchableOpacity
              style={s.groupHeader}
              onPress={() => onToggleGroup(groupKey)}
              activeOpacity={0.7}
            >
              <View style={s.groupLabelWrap}>
                <Ionicons
                  name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                  size={14}
                  color={C.muted}
                  style={{ marginRight: 4 }}
                />
                <Text style={s.groupTitle}>{group.type}</Text>
                <View style={s.percentBadge}>
                  <Text style={s.percentBadgeText}>{group.percentOfSection}%</Text>
                </View>
              </View>

              <View style={s.valuesRow}>
                <Text style={s.pastValueSub}>{money(group.pastTotal)}</Text>
                <View style={s.currentValueWithTrend}>
                  <Text
                    style={[
                      s.currentValueSub,
                      { color: isLiability ? (group.currentTotal > 0 ? C.coral : C.ink) : C.green },
                    ]}
                  >
                    {money(group.currentTotal)}
                  </Text>
                  <TrendBadge trend={group.trend} isDebt={isLiability} />
                </View>
              </View>
            </TouchableOpacity>

            {/* Individual Accounts in Group */}
            {!isCollapsed && (
              <View style={s.accountsCard}>
                {group.accounts.map((acc, index) => (
                  <AccountRow
                    key={acc.id}
                    account={acc}
                    isLiability={isLiability}
                    isLast={index === group.accounts.length - 1}
                    onPress={() => onSelectAccount?.(acc.name)}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}

      {section.groups.length === 0 && (
        <View style={s.emptySection}>
          <Text style={s.emptySectionText}>No {section.title.toLowerCase()} accounts found</Text>
        </View>
      )}
    </View>
  );
}

function AccountRow({
  account,
  isLiability,
  isLast,
  onPress,
}: {
  account: AccountItemSnapshot;
  isLiability: boolean;
  isLast: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.accountRow, !isLast && s.accountRowBorder]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={s.accountNameWrap}>
        <Text style={s.accountName} numberOfLines={1}>
          {account.name}
        </Text>
        <View style={s.accountPercentBadge}>
          <Text style={s.accountPercentBadgeText}>{account.percentOfSection}%</Text>
        </View>
      </View>

      <View style={s.valuesRow}>
        <Text style={s.pastValueAccount}>{money(account.pastBalance)}</Text>
        <View style={s.currentValueWithTrend}>
          <Text
            style={[
              s.currentValueAccount,
              { color: isLiability ? (account.currentBalance > 0 ? C.coral : C.ink) : C.green },
            ]}
          >
            {money(account.currentBalance)}
          </Text>
          <TrendBadge trend={account.trend} isDebt={isLiability} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TrendBadge({ trend, isDebt }: { trend: TrendDirection; isDebt: boolean }) {
  if (trend === 'same') {
    return <Text style={s.trendSame}>—</Text>;
  }

  // If debt: up arrow is bad (coral), down arrow is good (green)
  // If asset: up arrow is good (green), down arrow is bad (coral)
  const isUp = trend === 'up';
  const color = isDebt ? (isUp ? C.coral : C.green) : isUp ? C.green : C.coral;

  return (
    <Text style={[s.trendArrow, { color }]}>
      {isUp ? '▲' : '▼'}
    </Text>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  timelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  timelineText: {
    color: C.coral,
    fontSize: 12,
    fontWeight: '800',
  },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E6C6BC',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFF2EE',
  },
  presetPillText: {
    color: C.coral,
    fontSize: 11,
    fontWeight: '800',
  },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE5D6',
    gap: 16,
  },
  dateColLeft: {
    minWidth: 110,
    alignItems: 'flex-end',
  },
  dateColRight: {
    minWidth: 125,
    alignItems: 'flex-end',
  },
  dateHeaderText: {
    color: C.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 110,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    color: C.coral,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  groupContainer: {
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  groupLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupTitle: {
    color: C.coral,
    fontSize: 13,
    fontWeight: '800',
    marginRight: 6,
  },
  percentBadge: {
    backgroundColor: '#F5ECE1',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  percentBadgeText: {
    color: C.muted,
    fontSize: 8,
    fontWeight: '800',
  },
  accountsCard: {
    backgroundColor: '#FAF5EA',
    borderRadius: 16,
    marginTop: 4,
    marginHorizontal: 2,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EFE7D7',
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  accountRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EBE2D0',
  },
  accountNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  accountName: {
    color: C.ink,
    fontSize: 12,
    fontWeight: '800',
    marginRight: 6,
    maxWidth: 120,
  },
  accountPercentBadge: {
    backgroundColor: '#EEE3D3',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  accountPercentBadgeText: {
    color: C.muted,
    fontSize: 7,
    fontWeight: '800',
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pastValueMain: {
    color: C.green,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 95,
    textAlign: 'right',
  },
  currentValueMain: {
    fontSize: 12,
    fontWeight: '900',
    minWidth: 95,
    textAlign: 'right',
  },
  pastValueSub: {
    color: C.green,
    fontSize: 11,
    fontWeight: '800',
    minWidth: 95,
    textAlign: 'right',
  },
  currentValueSub: {
    fontSize: 11,
    fontWeight: '900',
    minWidth: 95,
    textAlign: 'right',
  },
  pastValueAccount: {
    color: C.green,
    fontSize: 10,
    fontWeight: '800',
    minWidth: 95,
    textAlign: 'right',
  },
  currentValueAccount: {
    fontSize: 10,
    fontWeight: '900',
    minWidth: 95,
    textAlign: 'right',
  },
  currentValueWithTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 115,
    justifyContent: 'flex-end',
  },
  pastValue: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 95,
    textAlign: 'right',
  },
  currentValue: {
    color: C.ink,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 95,
    textAlign: 'right',
  },
  trendArrow: {
    fontSize: 10,
    fontWeight: '900',
    width: 14,
    textAlign: 'center',
  },
  trendSame: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '900',
    width: 14,
    textAlign: 'center',
  },
  emptySection: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptySectionText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  netWorthCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 8,
  },
  netWorthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE5D6',
  },
  netWorthTitle: {
    color: C.ink,
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '900',
  },
  netWorthDeltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  netWorthDeltaLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  netWorthDeltaValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,10,18,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FAF5EB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  modalGrabBar: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1C7B8',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderTitle: {
    color: C.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E8DECة'.slice(0, 7) || '#E8DEC0',
    marginBottom: 6,
  },
  optionsList: {
    maxHeight: 380,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  optionRowActive: {
    backgroundColor: '#F0E5D4',
  },
  optionLabel: {
    color: C.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  optionLabelActive: {
    color: C.coral,
    fontWeight: '900',
  },
});
