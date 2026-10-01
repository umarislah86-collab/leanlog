import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, InteractionManager, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import BluecoinsDriveReader from 'bluecoins-drive-reader';
import type { TransactionDetection } from 'bluecoins-drive-reader';
import { refreshBluecoinsSummary, setBluecoinsFixedCommitments, setBluecoinsMonthlyBudget, setBluecoinsPayday, setCashRealityAccounts, setCashRealitySafetyBuffer, type BluecoinsSummary } from '../services/bluecoins';
import { applyEntryBalance, confirmRedCoinsExport, createRedCoinsDeletion, exportRedCoinsBackup, exportRedCoinsCsv, loadRedCoins, mergeRedCoinsIntoBudgetCoach, saveRedCoins, type RedCoinsAccountType, type RedCoinsEntry, type RedCoinsState, type RedCoinsType } from '../services/redcoins';
import { deleteRedCoinsLedgerEntry, queryRedCoinsLedger, syncRedCoinsLedger, upsertRedCoinsLedgerEntry } from '../services/redcoinsLedger';
import { saveSpendingGuards, type GuardScope, type SpendingGuard } from '../services/spendingGuards';

const C = {
  ink: '#111A2A',
  paper: '#FFF9EA',
  cream: '#F0E6D4',
  coral: '#F04444',
  mint: '#83D8B4',
  blue: '#528FF2',
  muted: '#7C8290',
  white: '#FFFFFF',
  gold: '#E7B84A',
};
const money = (n = 0) => `RM ${Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const html = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const dayKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localDay = (value: string) => new Date(`${value}T00:00:00`);
const nextLocalDay = (value: string) => {
  const date = localDay(value);
  date.setDate(date.getDate() + 1);
  return date;
};
const reportDate = (value: Date) => value.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
const entryTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '--:--'
    : date.toLocaleTimeString('en-MY', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
};
const budgetKey = (category: string, subcategory: string) => `${category}\u0000${subcategory}`;
type Section = 'home' | 'activity' | 'accounts' | 'plan' | 'reports';
type ReportMode = 'salary-cycle' | 'custom';
type SalarySource = { key: string; label: string; entries: RedCoinsEntry[]; average: number };
const LEDGER_PAGE_SIZE = 120;
// Curated from the Ionicons set bundled by @expo/vector-icons. Keeping a curated
// catalogue gives broad coverage without mounting the entire font map at once.
const ICON_LIBRARY = [
  'wallet', 'cash', 'card', 'business', 'briefcase', 'trending-up', 'stats-chart', 'pie-chart', 'bar-chart', 'calculator', 'receipt', 'pricetag', 'ticket', 'storefront',
  'home', 'bed', 'key', 'lock-closed', 'shield-checkmark', 'construct', 'build', 'hammer', 'cut', 'color-palette', 'layers',
  'restaurant', 'fast-food', 'pizza', 'cafe', 'beer', 'wine', 'nutrition', 'fish', 'ice-cream', 'water', 'basket', 'cart', 'bag',
  'car', 'car-sport', 'bus', 'airplane', 'train', 'subway', 'bicycle', 'boat', 'walk', 'rocket', 'map', 'location', 'pin', 'compass',
  'medical', 'medkit', 'fitness', 'barbell', 'bandage', 'pulse', 'body', 'accessibility', 'glasses', 'eye',
  'school', 'book', 'library', 'newspaper', 'document-text', 'clipboard', 'pencil', 'language', 'ribbon', 'trophy',
  'game-controller', 'film', 'musical-notes', 'headset', 'mic', 'camera', 'images', 'videocam', 'tv', 'desktop', 'laptop',
  'phone-portrait', 'call', 'chatbubble', 'mail', 'wifi', 'cloud', 'download', 'print', 'save', 'qr-code', 'scan',
  'flash', 'bulb', 'battery-charging', 'thermometer', 'flame', 'partly-sunny', 'umbrella', 'earth', 'leaf', 'flower',
  'people', 'person', 'person-add', 'man', 'woman', 'heart', 'heart-circle', 'happy', 'paw', 'shirt', 'gift', 'diamond',
  'calendar', 'time', 'stopwatch', 'alarm', 'notifications', 'repeat', 'sync', 'checkmark-circle', 'warning', 'information-circle',
  'settings', 'options', 'filter', 'search', 'star', 'flag', 'bookmark', 'attach', 'link', 'ellipsis-horizontal-circle',
];

export default function RedCoinsScreen({ navigation, route }: any) {
  const [state, setState] = useState<RedCoinsState | null>(null);
  const [bluecoins, setBluecoins] = useState<BluecoinsSummary | null>(null);
  const [bluecoinsBase, setBluecoinsBase] = useState<BluecoinsSummary | null>(null);
  const [section, setSection] = useState<Section>('home');
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(new Date());
  const [manageOpen, setManageOpen] = useState<'account' | 'category' | 'sub' | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterTypes, setFilterTypes] = useState<RedCoinsType[]>([]);
  const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterSubcategories, setFilterSubcategories] = useState<string[]>([]);
  const [filterDay, setFilterDay] = useState('');
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [collapsedCards, setCollapsedCards] = useState<string[]>([]);
  const [expandedBudgetCategories, setExpandedBudgetCategories] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleLedgerCount, setVisibleLedgerCount] = useState(LEDGER_PAGE_SIZE);
  const [ledgerEntries, setLedgerEntries] = useState<RedCoinsEntry[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerReady, setLedgerReady] = useState(false);
  const [ledgerFallback, setLedgerFallback] = useState(false);
  const [ledgerRevision, setLedgerRevision] = useState(0);
  const ledgerQueryId = useRef(0);
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<RedCoinsType>('expense');
  const [account, setAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [note, setNote] = useState('');
  const [labels, setLabels] = useState('');
  const [repeat, setRepeat] = useState<RedCoinsEntry['repeat']>('none');
  const [installments, setInstallments] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<RedCoinsAccountType>('Bank');
  const [draftBalance, setDraftBalance] = useState('0');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftSub, setDraftSub] = useState('');
  const [draftParent, setDraftParent] = useState('');
  const [draftIcon, setDraftIcon] = useState('wallet');
  const [budgetEditor, setBudgetEditor] = useState<{
    category: string;
    subcategory: string;
  } | null>(null);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [cycleBudgetDraft, setCycleBudgetDraft] = useState('');
  const [paydayDraft, setPaydayDraft] = useState('25');
  const [safetyBufferDraft, setSafetyBufferDraft] = useState('0');
  const [notificationAccess, setNotificationAccess] = useState(false);
  const [detections, setDetections] = useState<TransactionDetection[]>([]);
  const [reviewingDetectionId, setReviewingDetectionId] = useState<string | null>(null);
  const [fixedPickerOpen, setFixedPickerOpen] = useState(false);
  const [guardEditorOpen, setGuardEditorOpen] = useState(false);
  const [expandedGuardId, setExpandedGuardId] = useState<string | null>(null);
  const [expandedGuardPart, setExpandedGuardPart] = useState<string | null>(null);
  const [guardDraft, setGuardDraft] = useState<{ id?: string; name: string; scope: GuardScope; target: string; limit: string }>({ name: '', scope: 'account', target: '', limit: '' });
  const [reportMode, setReportMode] = useState<ReportMode>('salary-cycle');
  const [reportSalarySource, setReportSalarySource] = useState('');
  const [reportCycleOffset, setReportCycleOffset] = useState(0);
  const [reportCustomStart, setReportCustomStart] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [reportCustomEnd, setReportCustomEnd] = useState(() => dayKey(new Date().toISOString()));
  const [reportPeriodOpen, setReportPeriodOpen] = useState(false);
  const [expandedReportCategory, setExpandedReportCategory] = useState<string | null>(null);
  const [reportExporting, setReportExporting] = useState(false);

  useEffect(() => {
    (async () => {
      let summary: BluecoinsSummary | null = null;
      try {
        summary = await refreshBluecoinsSummary();
        setBluecoinsBase(summary);
      } catch {}
      const loaded = await loadRedCoins(summary);
      if (summary) setBluecoins(await mergeRedCoinsIntoBudgetCoach(summary));
      setState(loaded);
      setLedgerEntries(loaded.entries.slice(0, LEDGER_PAGE_SIZE));
      setLedgerTotal(loaded.entries.length);
      setCycleBudgetDraft(String(loaded.monthlyBudget));
      setPaydayDraft(String(loaded.payday));
      setSafetyBufferDraft(String(loaded.safetyBuffer));
      if (loaded.reportPreferences) {
        setReportMode(loaded.reportPreferences.mode);
        setReportSalarySource(loaded.reportPreferences.salarySource);
        setReportCustomStart(loaded.reportPreferences.customStart);
        setReportCustomEnd(loaded.reportPreferences.customEnd);
      }
      const latest = loaded.entries.reduce<Date | null>((best, entry) => {
        const date = new Date(entry.date);
        return !best || date > best ? date : best;
      }, null);
      if (latest) setCalendarCursor(new Date(latest.getFullYear(), latest.getMonth(), 1));
      try {
        await syncRedCoinsLedger(loaded.entries);
        setLedgerReady(true);
      } catch (error) {
        console.warn('RedCoins SQLite migration failed', error);
        setLedgerFallback(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (section !== 'activity') return;
    if (!ledgerReady || ledgerFallback) {
      if (!state) return;
      const needle = search.trim().toLocaleLowerCase('en-MY');
      const filtered = state.entries.filter((entry) => (!needle || [entry.item, entry.category, entry.subcategory, entry.account, entry.toAccount, entry.note].filter(Boolean).join(' ').toLocaleLowerCase('en-MY').includes(needle)) && (!filterTypes.length || filterTypes.includes(entry.type)) && (!filterAccounts.length || filterAccounts.includes(entry.account) || !!entry.toAccount && filterAccounts.includes(entry.toAccount)) && (!filterCategories.length || filterCategories.includes(entry.category)) && (!filterSubcategories.length || filterSubcategories.includes(entry.subcategory)) && (!filterDay || dayKey(entry.date) === filterDay));
      setLedgerEntries(filtered.slice(0, visibleLedgerCount));
      setLedgerTotal(filtered.length);
      return;
    }
    const requestId = ++ledgerQueryId.current;
    queryRedCoinsLedger({
      search,
      types: filterTypes,
      accounts: filterAccounts,
      categories: filterCategories,
      subcategories: filterSubcategories,
      day: filterDay,
      limit: visibleLedgerCount,
    })
      .then((result) => {
        if (requestId === ledgerQueryId.current) {
          setLedgerEntries(result.entries);
          setLedgerTotal(result.total);
        }
      })
      .catch((error) => {
        console.warn('RedCoins ledger query failed', error);
        setLedgerFallback(true);
      });
  }, [ledgerReady, ledgerFallback, ledgerRevision, section, search, filterTypes, filterAccounts, filterCategories, filterSubcategories, filterDay, visibleLedgerCount, state]);

  useEffect(() => {
    const refreshDetector = () => {
      BluecoinsDriveReader?.isNotificationAccessEnabledAsync?.()
        .then(setNotificationAccess)
        .catch(() => setNotificationAccess(false));
      BluecoinsDriveReader?.getTransactionDetectionsAsync?.()
        .then(setDetections)
        .catch(() => setDetections([]));
    };
    refreshDetector();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshDetector();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const mode = route?.params?.mode;
    if (!state || !['expense', 'income', 'transfer'].includes(mode)) return;
    resetEntry(mode as RedCoinsType);
    if (route?.params?.item && !route?.params?.detected) setItem(String(route.params.item));
    if (route?.params?.amount) setAmount(String(route.params.amount));
    const hint = String(route?.params?.accountHint || '')
      .trim()
      .toLowerCase();
    if (hint) {
      const matched = state.accounts.find((candidate) => candidate.name.toLowerCase().includes(hint) || hint.includes(candidate.name.toLowerCase()));
      if (matched) setAccount(matched.name);
    }
    navigation.setParams({
      mode: undefined,
      item: undefined,
      amount: undefined,
      accountHint: undefined,
      detected: undefined,
      fingerprint: undefined,
      source: undefined,
    });
  }, [route?.params?.mode, route?.params?.fingerprint, state?.createdAt]);

  useEffect(() => {
    const target = route?.params?.section as Section | undefined;
    if (!target || !['home', 'activity', 'accounts', 'plan', 'reports'].includes(target)) return;
    setSection(target);
    navigation.setParams({ section: undefined });
  }, [route?.params?.section]);

  const persist = async (next: RedCoinsState, refreshSource = false) => {
    setState({ ...next });
    await saveRedCoins(next);
    if (refreshSource) await refreshLiveBluecoins();
    else if (bluecoinsBase) setBluecoins(await mergeRedCoinsIntoBudgetCoach(bluecoinsBase));
  };
  const refreshLiveBluecoins = async () => {
    const refreshed = await refreshBluecoinsSummary();
    setBluecoinsBase(refreshed);
    setBluecoins(await mergeRedCoinsIntoBudgetCoach(refreshed));
  };
  const resetEntry = (initialType: RedCoinsType = 'expense') => {
    if (!state) return;
    const recent = state.entries.find((entry) => entry.type === initialType);
    const defaults = state.entryDefaults?.[initialType];
    setEditingEntryId(null);
    setReviewingDetectionId(null);
    setEntryDate(new Date());
    setItem('');
    setAmount('');
    setType(initialType);
    setAccount(defaults?.account || recent?.account || state.accounts.find((a) => a.type === 'Credit card')?.name || state.accounts[0]?.name || '');
    setToAccount(defaults?.toAccount || recent?.toAccount || '');
    setCategory(defaults?.category || recent?.category || state.categories[0]?.name || 'General');
    setSubcategory(defaults?.subcategory || recent?.subcategory || state.categories[0]?.subcategories[0] || 'General');
    setNote('');
    setLabels('');
    setRepeat('none');
    setInstallments('');
    setAdvanced(false);
    setEntryOpen(true);
  };
  const suggestions = useMemo(() => {
    const query = item.trim().toLowerCase();
    if (!query) return [];
    const stats = new Map<string, { entry: RedCoinsEntry; count: number; lastIndex: number }>();
    (state?.entries || []).forEach((entry, index) => {
      const key = entry.item.trim().toLowerCase();
      if (!key) return;
      const current = stats.get(key);
      if (current) current.count += 1;
      else stats.set(key, { entry, count: 1, lastIndex: index });
    });
    const own = [...stats.values()]
      .filter(({ entry }) => entry.item.toLowerCase().includes(query))
      .sort((a, b) => {
        const score = (name: string) => (name === query ? 4 : name.startsWith(query) ? 3 : name.split(/\s+/).some((word) => word.startsWith(query)) ? 2 : 1);
        return score(b.entry.item.toLowerCase()) - score(a.entry.item.toLowerCase()) || b.count - a.count || a.lastIndex - b.lastIndex;
      })
      .slice(0, 6)
      .map(({ entry, count }) => ({ ...entry, usageCount: count }));
    return own;
  }, [item, state?.entries]);
  const applyEntryType = (nextType: RedCoinsType) => {
    setType(nextType);
    const defaults = state?.entryDefaults?.[nextType];
    const recent = state?.entries.find((entry) => entry.type === nextType);
    if (defaults?.account || recent?.account) setAccount(defaults?.account || recent!.account);
    setToAccount(defaults?.toAccount || recent?.toAccount || '');
    if (nextType !== 'transfer') {
      setCategory(defaults?.category || recent?.category || category);
      setSubcategory(defaults?.subcategory || recent?.subcategory || subcategory);
    }
  };
  const chooseSuggestion = (entry: any) => {
    setItem(entry.item);
    if (entry.account) setAccount(entry.account);
    setCategory(entry.category);
    setSubcategory(entry.subcategory);
  };
  const editEntry = (entry: RedCoinsEntry) => {
    setReviewingDetectionId(null);
    setEditingEntryId(entry.id);
    setItem(entry.item);
    setAmount(String(entry.amount));
    setType(entry.type);
    setAccount(entry.account);
    setToAccount(entry.toAccount || '');
    setEntryDate(new Date(entry.date));
    setCategory(entry.category);
    setSubcategory(entry.subcategory);
    setNote(entry.note || '');
    setLabels((entry.labels || []).join(', '));
    setRepeat(entry.repeat || 'none');
    setInstallments(entry.installments ? String(entry.installments) : '');
    setAdvanced(!!entry.note || !!entry.labels?.length || (!!entry.repeat && entry.repeat !== 'none'));
    setEntryOpen(true);
  };
  const saveEntry = async () => {
    if (!state || !item.trim() || !Number(amount) || !account || (type === 'transfer' && !toAccount)) return Alert.alert('Incomplete entry', 'Add item, amount and account first.');
    const original = editingEntryId ? state.entries.find((entry) => entry.id === editingEntryId) : undefined;
    const entry: RedCoinsEntry = {
      id: original?.id || `${Date.now()}`,
      item: item.trim(),
      amount: Number(amount),
      type,
      account,
      toAccount: type === 'transfer' ? toAccount : undefined,
      category: type === 'transfer' ? '(Transfer)' : category,
      subcategory: type === 'transfer' ? '(Transfer)' : subcategory,
      date: entryDate.toISOString(),
      note: note.trim(),
      labels: labels
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      status: original?.status || 'cleared',
      repeat,
      installments: Number(installments) || undefined,
      origin: original?.origin || 'redcoins',
      exportedAt: original?.exportedAt,
      editedAt: original?.origin === 'bluecoins' ? new Date().toISOString() : original?.editedAt,
      balanceEffectApplied: entryDate.getTime() <= Date.now(),
    };
    const next: RedCoinsState = {
      ...state,
      entries: original ? state.entries.map((row) => (row.id === original.id ? entry : row)) : [entry, ...state.entries],
      accounts: state.accounts.map((a) => ({ ...a })),
      entryDefaults: {
        ...(state.entryDefaults || {}),
        [type]: {
          account,
          toAccount: type === 'transfer' ? toAccount : undefined,
          category,
          subcategory,
        },
      },
    };
    if (original) applyEntryBalance(next, original, -1);
    applyEntryBalance(next, entry, 1);
    setEntryOpen(false);
    if (reviewingDetectionId) dismissDetection(reviewingDetectionId).catch(() => {});
    InteractionManager.runAfterInteractions(() => {
      setSection('activity');
      upsertRedCoinsLedgerEntry(entry)
        .then(() => setLedgerRevision((value) => value + 1))
        .catch((error) => console.warn('RedCoins ledger upsert failed', error));
      persist(next).catch(() => Alert.alert('Save failed', 'The transaction is still visible, but LeanLog could not write it to local storage. Please try again.'));
    });
  };
  const deleteEditingEntry = () => {
    if (!state || !editingEntryId) return;
    const original = state.entries.find((entry) => entry.id === editingEntryId);
    if (!original) return;
    Alert.alert('Delete transaction?', `${original.item} · ${money(original.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const next = {
            ...state,
            entries: state.entries.filter((entry) => entry.id !== original.id),
            deletedEntries: [createRedCoinsDeletion(original), ...(state.deletedEntries || [])],
            accounts: state.accounts.map((entry) => ({ ...entry })),
          };
          applyEntryBalance(next, original, -1);
          setEntryOpen(false);
          setEditingEntryId(null);
          InteractionManager.runAfterInteractions(() => {
            deleteRedCoinsLedgerEntry(original.id)
              .then(() => setLedgerRevision((value) => value + 1))
              .catch((error) => console.warn('RedCoins ledger delete failed', error));
            persist(next).catch(() => Alert.alert('Delete failed', 'LeanLog could not persist this change.'));
          });
        },
      },
    ]);
  };
  const removeEntry = (entry: RedCoinsEntry) =>
    Alert.alert('Delete transaction permanently?', `${entry.item} · This cannot be restored.`, [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!state) return;
          const next = {
            ...state,
            entries: state.entries.filter((e) => e.id !== entry.id),
            deletedEntries: [createRedCoinsDeletion(entry), ...(state.deletedEntries || [])],
            accounts: state.accounts.map((a) => ({ ...a })),
          };
          applyEntryBalance(next, entry, -1);
          await Promise.all([persist(next), deleteRedCoinsLedgerEntry(entry.id)]);
          setLedgerRevision((value) => value + 1);
        },
      },
    ]);

  const filtered = ledgerEntries;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const categoryIcons = useMemo(() => {
    const icons = new Map<string, { icon?: string; subcategoryIcons?: Record<string, string> }>();
    (state?.categories || []).forEach((category) => {
      icons.set(category.name, {
        icon: category.icon,
        subcategoryIcons: category.subcategoryIcons,
      });
    });
    return icons;
  }, [state?.categories]);
  const iconForEntry = useCallback((entry: RedCoinsEntry) => {
    if (entry.type !== 'expense') return transactionIcon(entry);
    const category = categoryIcons.get(entry.category);
    const savedIcon = category?.subcategoryIcons?.[entry.subcategory] || category?.icon;
    return savedIcon && ICON_LIBRARY.includes(savedIcon) ? savedIcon : transactionIcon(entry);
  }, [categoryIcons]);
  const ledgerExtraData = useMemo(() => ({ selectedIds, categoryIcons }), [selectedIds, categoryIcons]);
  const entryBalanceById = useMemo(() => {
    if (!state) return new Map<string, number>();
    const balances = new Map(state.accounts.map((account) => [account.name, account.balance]));
    const result = new Map<string, number>();
    const now = Date.now();
    const future = state.entries.filter((entry) => new Date(entry.date).getTime() > now).sort((a, b) => a.date.localeCompare(b.date));
    future.forEach((entry) => {
      if (entry.type === 'expense') balances.set(entry.account, (balances.get(entry.account) || 0) - entry.amount);
      if (entry.type === 'income') balances.set(entry.account, (balances.get(entry.account) || 0) + entry.amount);
      if (entry.type === 'transfer') {
        balances.set(entry.account, (balances.get(entry.account) || 0) - entry.amount);
        if (entry.toAccount) balances.set(entry.toAccount, (balances.get(entry.toAccount) || 0) + entry.amount);
      }
      result.set(entry.id, balances.get(entry.account) || 0);
    });
    const currentBalances = new Map(state.accounts.map((account) => [account.name, account.balance]));
    state.entries
      .filter((entry) => new Date(entry.date).getTime() <= now)
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((entry) => {
        result.set(entry.id, currentBalances.get(entry.account) || 0);
        if (entry.type === 'expense') currentBalances.set(entry.account, (currentBalances.get(entry.account) || 0) + entry.amount);
        if (entry.type === 'income') currentBalances.set(entry.account, (currentBalances.get(entry.account) || 0) - entry.amount);
        if (entry.type === 'transfer') {
          currentBalances.set(entry.account, (currentBalances.get(entry.account) || 0) + entry.amount);
          if (entry.toAccount) currentBalances.set(entry.toAccount, (currentBalances.get(entry.toAccount) || 0) - entry.amount);
        }
      });
    return result;
  }, [state]);
  const activitySections = useMemo(() => {
    const groups = new Map<string, RedCoinsEntry[]>();
    ledgerEntries.forEach((entry) => {
      const key = dayKey(entry.date);
      const rows = groups.get(key);
      if (rows) rows.push(entry);
      else groups.set(key, [entry]);
    });
    return [...groups].map(([date, data]) => ({
      date,
      title: new Date(`${date}T12:00:00`)
        .toLocaleDateString('en-MY', {
          weekday: 'short',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        .toUpperCase(),
      total: data.reduce((sum, entry) => sum + (entry.type === 'expense' ? -entry.amount : entry.type === 'income' ? entry.amount : 0), 0),
      data,
    }));
  }, [ledgerEntries]);
  const selectedTotal = useMemo(() => {
    if (!state || selectedSet.size === 0) return 0;
    return state.entries.reduce((sum, entry) => (selectedSet.has(entry.id) ? sum + (entry.type === 'expense' ? -entry.amount : entry.type === 'income' ? entry.amount : 0) : sum), 0);
  }, [state, selectedSet]);
  const toggleSelected = useCallback((entry: RedCoinsEntry) => setSelectedIds((ids) => (ids.includes(entry.id) ? ids.filter((id) => id !== entry.id) : [...ids, entry.id])), []);
  const updateLedgerSearch = useCallback((value: string) => {
    setVisibleLedgerCount(LEDGER_PAGE_SIZE);
    setSearch(value);
  }, []);
  const openDashboardFilter = (kind: 'day' | 'category' | 'account', value: string) => {
    setSearch('');
    setSelectedIds([]);
    setFilterTypes([]);
    setFilterDay(kind === 'day' ? value : '');
    setFilterCategories(kind === 'category' ? [value] : []);
    setFilterAccounts(kind === 'account' ? [value] : []);
    setFilterSubcategories([]);
    setSection('activity');
  };
  const applyLedgerFilters = useCallback((next: { types: RedCoinsType[]; accounts: string[]; categories: string[]; subcategories: string[]; day: string }) => {
    setVisibleLedgerCount(LEDGER_PAGE_SIZE);
    setFilterTypes(next.types);
    setFilterAccounts(next.accounts);
    setFilterCategories(next.categories);
    setFilterSubcategories(next.subcategories);
    setFilterDay(next.day);
    setFilterOpen(false);
  }, []);
  const toggleCard = (name: string) => setCollapsedCards((cards) => (cards.includes(name) ? cards.filter((card) => card !== name) : [...cards, name]));
  const dismissDetection = async (id: string) => {
    await BluecoinsDriveReader?.dismissTransactionDetectionAsync?.(id);
    setDetections((rows) => rows.filter((row) => row.id !== id));
  };
  const reviewDetection = (detection: TransactionDetection) => {
    resetEntry();
    setReviewingDetectionId(detection.id);
    setType('expense');
    setItem('');
    setAmount(String(detection.amount));
    const hint = detection.accountHint.toLowerCase();
    if (hint) {
      const matched = state?.accounts.find((candidate) => candidate.name.toLowerCase().includes(hint) || hint.includes(candidate.name.toLowerCase()));
      if (matched) setAccount(matched.name);
    }
  };
  const runDetectorTest = async () => {
    if (!BluecoinsDriveReader?.createTestTransactionDetectionAsync) return Alert.alert('Build required', 'The detector inbox needs the next native APK build.');
    const row = await BluecoinsDriveReader.createTestTransactionDetectionAsync();
    setDetections((current) => [row, ...current.filter((item) => item.id !== row.id)]);
  };
  const budgetCategories = useMemo(() => {
    if (!state) return [];
    const pairTypes = new Map<string, Set<RedCoinsType>>();
    state.entries.forEach((entry) => {
      const key = budgetKey(entry.category, entry.subcategory);
      const types = pairTypes.get(key) || new Set<RedCoinsType>();
      types.add(entry.type);
      pairTypes.set(key, types);
    });
    const reserved = /^\((?:new account|no category|transfer)\)$/i;
    return state.categories
      .map((group) => ({
        ...group,
        subcategories: group.subcategories.filter((subcategory) => {
          if (reserved.test(group.name.trim()) || reserved.test(subcategory.trim())) return false;
          const types = pairTypes.get(budgetKey(group.name, subcategory));
          return !types || types.has('expense');
        }),
      }))
      .filter((group) => group.subcategories.length > 0);
  }, [state?.categories, state?.entries]);
  const budgetKeys = useMemo(() => new Set(budgetCategories.flatMap((group) => group.subcategories.map((subcategory) => budgetKey(group.name, subcategory)))), [budgetCategories]);

  const salarySources = useMemo<SalarySource[]>(() => {
    if (!state) return [];
    const groups = new Map<string, RedCoinsEntry[]>();
    state.entries.filter((entry) => entry.type === 'income').forEach((entry) => {
      const key = entry.item.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!key) return;
      const rows = groups.get(key);
      if (rows) rows.push(entry);
      else groups.set(key, [entry]);
    });
    return [...groups].map(([key, entries]) => ({
      key,
      label: entries[0].item.trim(),
      entries: [...entries].sort((a, b) => a.date.localeCompare(b.date)),
      average: entries.reduce((sum, entry) => sum + entry.amount, 0) / entries.length,
    })).sort((a, b) => b.entries.length - a.entries.length || b.average - a.average);
  }, [state?.entries]);

  const report = useMemo(() => {
    if (!state) return null;
    const source = salarySources.find((item) => item.key === reportSalarySource) || salarySources[0];
    const maxOffset = Math.max(0, (source?.entries.length || 1) - 1);
    const safeOffset = Math.min(reportCycleOffset, maxOffset);
    const anchorIndex = source ? source.entries.length - 1 - safeOffset : -1;
    const anchor = anchorIndex >= 0 ? source!.entries[anchorIndex] : undefined;
    const nextAnchor = source && anchorIndex >= 0 ? source.entries[anchorIndex + 1] : undefined;
    const now = new Date();
    const start = reportMode === 'custom'
      ? localDay(reportCustomStart)
      : anchor ? new Date(anchor.date) : new Date(now.getFullYear(), now.getMonth() - (now.getDate() < state.payday ? 1 : 0), state.payday);
    const endExclusive = reportMode === 'custom'
      ? nextLocalDay(reportCustomEnd)
      : nextAnchor ? new Date(nextAnchor.date) : new Date(now.getTime() + 1);
    const rows = state.entries.filter((entry) => {
      const date = new Date(entry.date);
      return date >= start && date < endExclusive;
    });
    const actualRows = rows.filter((entry) => new Date(entry.date) <= now);
    const scheduledRows = rows.filter((entry) => new Date(entry.date) > now);
    const expenses = actualRows.filter((entry) => entry.type === 'expense');
    const incomes = actualRows.filter((entry) => entry.type === 'income');
    const transfers = actualRows.filter((entry) => entry.type === 'transfer');
    const expense = expenses.reduce((sum, entry) => sum + entry.amount, 0);
    const income = incomes.reduce((sum, entry) => sum + entry.amount, 0);
    const transfer = transfers.reduce((sum, entry) => sum + entry.amount, 0);
    const categories = new Map<string, { amount: number; subcategories: Map<string, number>; entries: RedCoinsEntry[] }>();
    expenses.forEach((entry) => {
      const group = categories.get(entry.category) || { amount: 0, subcategories: new Map<string, number>(), entries: [] };
      group.amount += entry.amount;
      group.subcategories.set(entry.subcategory, (group.subcategories.get(entry.subcategory) || 0) + entry.amount);
      group.entries.push(entry);
      categories.set(entry.category, group);
    });
    const accountMovement = new Map<string, { incoming: number; outgoing: number }>();
    const movement = (name: string | undefined, incoming: number, outgoing: number) => {
      if (!name) return;
      const row = accountMovement.get(name) || { incoming: 0, outgoing: 0 };
      row.incoming += incoming;
      row.outgoing += outgoing;
      accountMovement.set(name, row);
    };
    actualRows.forEach((entry) => {
      if (entry.type === 'income') movement(entry.account, entry.amount, 0);
      if (entry.type === 'expense') movement(entry.account, 0, entry.amount);
      if (entry.type === 'transfer') {
        movement(entry.account, 0, entry.amount);
        movement(entry.toAccount, entry.amount, 0);
      }
    });
    const cycleLabel = anchor
      ? `${source?.label || 'Salary'} · ${new Date(anchor.date).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })}`
      : 'Configured salary cycle';
    const displayEnd = new Date(endExclusive.getTime() - 1);
    return {
      source,
      maxOffset,
      safeOffset,
      start,
      endExclusive,
      displayEnd,
      rows: actualRows,
      scheduledRows,
      expense,
      income,
      transfer,
      net: income - expense,
      cycleLabel,
      categories: [...categories].sort((a, b) => b[1].amount - a[1].amount),
      accountMovement: [...accountMovement].sort((a, b) => (b[1].incoming + b[1].outgoing) - (a[1].incoming + a[1].outgoing)),
      ongoing: reportMode === 'salary-cycle' && !nextAnchor,
    };
  }, [state, salarySources, reportSalarySource, reportCycleOffset, reportMode, reportCustomStart, reportCustomEnd]);

  const finance = useMemo(() => {
    if (!state) return null;
    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth() - (now.getDate() < state.payday ? 1 : 0), state.payday);
    const cycleEnd = bluecoins?.monthly?.cycleEnd ? new Date(`${bluecoins.monthly.cycleEnd}T23:59:59`) : new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, cycleStart.getDate());
    const cycleRows = state.entries.filter((entry) => {
      const date = new Date(entry.date);
      return date >= cycleStart && date <= cycleEnd;
    });
    let spent = bluecoins?.monthly.spent || 0;
    let income = 0;
    const catSpend: Record<string, number> = Object.fromEntries((bluecoins?.monthly.topCategories || []).map((category) => [category.name, category.amount]));
    const subcategorySpend: Record<string, number> = Object.fromEntries((bluecoins?.monthly.topCategories || []).flatMap((category) => category.details.map((detail) => [budgetKey(category.name, detail.subcategory), detail.amount])));
    cycleRows.forEach((entry) => {
      if (entry.type === 'income') income += entry.amount;
      if (entry.type !== 'expense') return;
      // Entries already represented by the Bluecoins baseline must not be counted twice.
      if (!bluecoins && entry.origin !== 'bluecoins') {
        spent += entry.amount;
        catSpend[entry.category] = (catSpend[entry.category] || 0) + entry.amount;
        const key = budgetKey(entry.category, entry.subcategory);
        subcategorySpend[key] = (subcategorySpend[key] || 0) + entry.amount;
      }
    });
    const remaining = state.monthlyBudget - spent;
    const daysLeft = Math.max(1, Math.ceil((new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, state.payday).getTime() - now.getTime()) / 86400000));
    const cardDebt = bluecoins?.cashReality.cardOutstanding ?? state.accounts.filter((account) => account.type === 'Credit card').reduce((sum, account) => sum + Math.max(0, -account.balance), 0);
    const cash = bluecoins?.cashReality.liquidBalance ?? state.accounts.filter((account) => ['Bank', 'Cash'].includes(account.type)).reduce((sum, account) => sum + account.balance, 0);
    const allocatedBudget = Object.entries(state.subcategoryBudgets || {}).reduce((sum, [key, value]) => sum + (budgetKeys.has(key) ? Math.max(0, Number(value) || 0) : 0), 0);
    return {
      now,
      cycleStart,
      cycleRows,
      spent,
      income,
      remaining,
      daysLeft,
      cardDebt,
      cash,
      trueSpendable: bluecoins ? bluecoins.cashReality.trueSpendable : cash - cardDebt - state.safetyBuffer,
      catSpend,
      topCats: Object.entries(catSpend).sort((a, b) => b[1] - a[1]),
      allocatedBudget,
      unallocatedBudget: state.monthlyBudget - allocatedBudget,
      subcategorySpend,
    };
  }, [state, budgetKeys, bluecoins]);

  if (!state)
    return (
      <SafeAreaView style={s.loading}>
        <Text style={s.loadingText}>Opening your money room…</Text>
      </SafeAreaView>
    );

  const { now, cycleRows, spent, income, remaining, daysLeft, cardDebt, cash, trueSpendable, catSpend, topCats, allocatedBudget, unallocatedBudget, subcategorySpend } = finance!;
  const categoryBudget = (category: string) => budgetCategories.find((group) => group.name === category)?.subcategories.reduce((sum, subcategory) => sum + (state.subcategoryBudgets[budgetKey(category, subcategory)] || 0), 0) || 0;
  const openBudgetEditor = (category: string, subcategory: string) => {
    setBudgetEditor({ category, subcategory });
    setBudgetDraft(String(state.subcategoryBudgets[budgetKey(category, subcategory)] || ''));
  };
  const saveSubcategoryBudget = async () => {
    if (!budgetEditor) return;
    const amountValue = Math.max(0, Number(budgetDraft) || 0);
    const key = budgetKey(budgetEditor.category, budgetEditor.subcategory);
    const current = state.subcategoryBudgets[key] || 0;
    const available = Math.max(0, state.monthlyBudget - (allocatedBudget - current));
    if (amountValue > available) return Alert.alert('Not enough budget left', `Only ${money(available)} is unallocated. Reduce another subcategory budget or increase the salary-cycle budget first.`);
    const nextBudgets = { ...state.subcategoryBudgets };
    if (amountValue > 0) nextBudgets[key] = amountValue;
    else delete nextBudgets[key];
    await persist({ ...state, subcategoryBudgets: nextBudgets });
    setBudgetEditor(null);
  };
  const saveCycleBudget = async () => {
    const nextValue = Math.max(0, Number(cycleBudgetDraft) || 0);
    if (nextValue < allocatedBudget) {
      setCycleBudgetDraft(String(state.monthlyBudget));
      return Alert.alert('Budget already allocated', `${money(allocatedBudget)} is already assigned to subcategories. The cycle budget cannot be lower than that.`);
    }
    await setBluecoinsMonthlyBudget(nextValue);
    await persist({ ...state, monthlyBudget: nextValue }, true);
    setCycleBudgetDraft(String(nextValue));
  };

  const Home = () => {
    const today = new Date();
    const anchor = new Date(today);
    anchor.setHours(23, 59, 59, 999);
    const weekDays = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(anchor);
      date.setDate(anchor.getDate() - (6 - offset));
      const key = dayKey(date.toISOString());
      return {
        key,
        label: date.toLocaleDateString('en-MY', { weekday: 'short' }),
        amount: state.entries.filter((e) => e.type === 'expense' && dayKey(e.date) === key).reduce((sum, e) => sum + e.amount, 0),
      };
    });
    const weekMax = Math.max(1, ...weekDays.map((day) => day.amount));
    const lastThirtyStart = new Date(anchor);
    lastThirtyStart.setDate(anchor.getDate() - 29);
    lastThirtyStart.setHours(0, 0, 0, 0);
    const thirtyAverage = state.entries.filter((entry) => entry.type === 'expense' && new Date(entry.date) >= lastThirtyStart && new Date(entry.date) <= anchor).reduce((sum, entry) => sum + entry.amount, 0) / 30;
    const calendarStart = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const leading = calendarStart.getDay();
    const calendar = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1 - leading + index);
      const key = dayKey(date.toISOString());
      const types = new Set(state.entries.filter((entry) => dayKey(entry.date) === key).map((entry) => entry.type));
      return {
        key,
        date,
        types,
        muted: date.getMonth() !== calendarCursor.getMonth(),
      };
    });
    const months = Array.from({ length: 3 }, (_, offset) => {
      const date = new Date(anchor.getFullYear(), anchor.getMonth() - (2 - offset), 1);
      const rows = state.entries.filter((e) => {
        const value = new Date(e.date);
        return value.getFullYear() === date.getFullYear() && value.getMonth() === date.getMonth();
      });
      return {
        label: date.toLocaleDateString('en-MY', { month: 'short' }),
        incoming: rows.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0),
        outgoing: rows.filter((e) => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0),
      };
    });
    const flowMax = Math.max(1, ...months.flatMap((month) => [month.incoming, month.outgoing]));
    const palette = [C.coral, C.blue, '#18A879', C.gold, '#D943A8', '#8457C8'];
    const budgetSegments = topCats.slice(0, 6).map(([name, value], index) => ({
      name,
      value,
      color: palette[index],
      percent: spent ? (value / spent) * 100 : 0,
    }));
    const favoriteAccounts = state.accounts.filter((account) => ['Bank', 'Cash', 'Credit card'].includes(account.type)).slice(0, 6);
    return (
      <>
        <View style={s.dashboardIntro}>
          <View>
            <Text style={s.eyebrow}>REDCOINS / SALARY CYCLE</Text>
            <Text style={s.dashboardTitle}>Your money, clearly.</Text>
          </View>
          <Text style={s.dashboardDate}>
            {today.toLocaleDateString('en-MY', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>
        <View style={s.dashCard}>
          <TouchableOpacity style={s.dashHeadRow} onPress={() => toggleCard('daily')}>
            <Text style={s.dashHead}>Daily Summary</Text>
            <Ionicons name={collapsedCards.includes('daily') ? 'chevron-forward' : 'chevron-down'} size={16} color={C.ink} />
          </TouchableOpacity>
          {!collapsedCards.includes('daily') && (
            <>
              <View style={s.weekBars}>
                {weekDays.map((day) => (
                  <TouchableOpacity key={day.key} style={s.weekDay} onPress={() => openDashboardFilter('day', day.key)}>
                    <Text style={s.weekAmount}>{day.amount ? `RM${day.amount.toFixed(0)}` : '—'}</Text>
                    <View style={[s.weekBar, { height: Math.max(3, (day.amount / weekMax) * 92) }]} />
                    <Text style={s.weekLabel}>{day.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.summaryLine}>
                <Text style={s.summaryMuted}>
                  7 days average <Text style={s.summaryExpense}>{money(weekDays.reduce((sum, day) => sum + day.amount, 0) / 7)}</Text>
                </Text>
                <Text style={s.summaryMuted}>
                  30 days average <Text style={s.summaryExpense}>{money(thirtyAverage)}</Text>
                </Text>
              </View>
            </>
          )}
        </View>
        <View style={s.dashCard}>
          <View style={s.calendarHead}>
            <TouchableOpacity style={s.calendarArrow} onPress={() => setCalendarCursor((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>
              <Ionicons name="chevron-back" size={17} color={C.ink} />
            </TouchableOpacity>
            <Text style={s.dashHead}>
              {calendarCursor.toLocaleDateString('en-MY', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <TouchableOpacity style={s.calendarArrow} onPress={() => setCalendarCursor((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>
              <Ionicons name="chevron-forward" size={17} color={C.ink} />
            </TouchableOpacity>
          </View>
          <View style={s.calendarGrid}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <Text key={label} style={s.calendarWeek}>
                {label}
              </Text>
            ))}
            {calendar.map((day) => (
              <TouchableOpacity key={day.key} onPress={() => openDashboardFilter('day', day.key)} style={[s.calendarDay, day.key === dayKey(today.toISOString()) && s.calendarToday, day.muted && { opacity: 0.3 }]}>
                <Text style={s.calendarNumber}>{day.date.getDate()}</Text>
                <View style={s.calendarDots}>
                  {day.types.has('expense') && <View style={[s.calendarDot, { backgroundColor: C.coral }]} />}
                  {day.types.has('income') && <View style={[s.calendarDot, { backgroundColor: '#18A879' }]} />}
                  {day.types.has('transfer') && <View style={[s.calendarDot, { backgroundColor: C.blue }]} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.calendarKey}>
            <Text style={s.calendarKeyText}>● Expense</Text>
            <Text style={[s.calendarKeyText, { color: '#18A879' }]}>● Income</Text>
            <Text style={[s.calendarKeyText, { color: C.blue }]}>● Transfer</Text>
          </View>
        </View>
        <View style={s.dashCard}>
          <TouchableOpacity style={s.dashHeadRow} onPress={() => toggleCard('budget')}>
            <Text style={s.dashHead}>Budget Summary</Text>
            <Ionicons name={collapsedCards.includes('budget') ? 'chevron-forward' : 'chevron-down'} size={16} color={C.ink} />
          </TouchableOpacity>
          {!collapsedCards.includes('budget') && (
            <>
              <View style={s.budgetSummary}>
                <BudgetDonut segments={budgetSegments} spent={spent} />
                <View style={{ flex: 1 }}>
                  {budgetSegments.map((segment) => (
                    <TouchableOpacity key={segment.name} style={s.legendRow} onPress={() => openDashboardFilter('category', segment.name)}>
                      <View style={[s.legendDot, { backgroundColor: segment.color }]} />
                      <Text style={s.legendName} numberOfLines={1}>
                        {segment.name}
                      </Text>
                      <Text style={s.legendValue}>{segment.percent.toFixed(0)}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={s.budgetTrack}>
                <View
                  style={[
                    s.budgetFill,
                    {
                      width: `${Math.min(100, (spent / Math.max(1, state.monthlyBudget)) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <View style={s.summaryLine}>
                <Text style={s.summaryExpense}>
                  {Math.round((spent / Math.max(1, state.monthlyBudget)) * 100)}% · {money(spent)}
                </Text>
                <Text style={s.summaryMuted}>{remaining < 0 ? `${money(Math.abs(remaining))} over` : `${money(remaining)} remaining`}</Text>
              </View>
            </>
          )}
        </View>
        <View style={s.dashCard}>
          <TouchableOpacity style={s.dashHeadRow} onPress={() => toggleCard('favorites')}>
            <Text style={s.dashHead}>Favorite Accounts</Text>
            <Ionicons name={collapsedCards.includes('favorites') ? 'chevron-forward' : 'chevron-down'} size={16} color={C.ink} />
          </TouchableOpacity>
          {!collapsedCards.includes('favorites') && (
            <>
              {favoriteAccounts.map((account) => (
                <TouchableOpacity key={account.id} style={s.favoriteRow} onPress={() => openDashboardFilter('account', account.name)}>
                  <Text style={s.favoriteName}>{account.name}</Text>
                  <Text style={[s.favoriteBalance, account.balance < 0 && { color: C.coral }]}>
                    {account.balance < 0 ? '− ' : ''}
                    {money(account.balance)}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={s.favoriteTotal}>Total: {money(favoriteAccounts.reduce((sum, account) => sum + account.balance, 0))}</Text>
              <TouchableOpacity style={s.balanceSheetButton} onPress={() => setSection('accounts')}>
                <Text style={s.balanceSheetText}>BALANCE SHEET</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        <View style={s.dashCard}>
          <Text style={s.dashHead}>Cash Flow</Text>
          <View style={s.cashflowChart}>
            {months.map((month) => (
              <View key={month.label} style={s.cashMonth}>
                <View style={s.cashBars}>
                  <View
                    style={[
                      s.cashBar,
                      {
                        height: Math.max(3, (month.outgoing / flowMax) * 110),
                        backgroundColor: C.coral,
                      },
                    ]}
                  />
                  <View
                    style={[
                      s.cashBar,
                      {
                        height: Math.max(3, (month.incoming / flowMax) * 110),
                        backgroundColor: '#18A879',
                      },
                    ]}
                  />
                </View>
                <Text style={s.weekLabel}>{month.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={s.hero}>
          <Text style={s.kicker}>TRUE CASH AVAILABLE</Text>
          <Text style={[s.heroMoney, trueSpendable < 0 && { color: '#FF8069' }]}>
            {trueSpendable < 0 ? '− ' : ''}
            {money(trueSpendable)}
          </Text>
          <Text style={s.heroSub}>
            Selected cash {money(cash)} · cycle budget left {money(remaining)}
          </Text>
          <View style={s.formula}>
            <Mini label="SELECTED CASH" value={cash} />
            <Mini label="CARD OWED" value={-cardDebt} />
            <Mini label="CYCLE LEFT" value={remaining} />
          </View>
        </View>
      </>
    );
  };
  const activityHeader = (
    <View style={s.activityHeader}>
      {selectedIds.length > 0 && (
        <View style={s.selectedTotal}>
          <Text style={s.selectedTotalText}>
            {selectedTotal < 0 ? '− ' : '+ '}
            {money(selectedTotal)}
          </Text>
          <Text style={s.selectedTotalMeta}>{selectedIds.length} selected</Text>
        </View>
      )}
      <View style={s.ledgerTools}>
        <LedgerSearch value={search} onChange={updateLedgerSearch} />
        <TouchableOpacity style={s.filterButton} onPress={() => setFilterOpen(true)}>
          <Ionicons name="options" size={17} color={C.white} />
          {(filterTypes.length + filterAccounts.length + filterCategories.length + filterSubcategories.length + (filterDay ? 1 : 0)) > 0 && (
            <Text style={{ color: C.white, fontSize: 10, fontWeight: '900', marginLeft: 4 }}>{filterTypes.length + filterAccounts.length + filterCategories.length + filterSubcategories.length + (filterDay ? 1 : 0)}</Text>
          )}
        </TouchableOpacity>
      </View>
      {selectedIds.length > 0 && (
        <View style={s.selectionBar}>
          <Text style={s.selectionCount}>{selectedIds.length} selected</Text>
          <TouchableOpacity onPress={() => setSelectedIds(filtered.map((e) => e.id))}>
            <Text style={s.selectionLink}>SELECT ALL</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedIds([])}>
            <Text style={s.selectionLink}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
  const filterModal = (
    <LedgerFilterModal
      visible={filterOpen}
      current={{
        types: filterTypes,
        accounts: filterAccounts,
        categories: filterCategories,
        subcategories: filterSubcategories,
        day: filterDay,
      }}
      accounts={state.accounts.map((entry) => entry.name)}
      categories={state.categories.map((entry) => entry.name)}
      subcategories={[...new Set(state.categories.flatMap((entry) => entry.subcategories))]}
      close={() => setFilterOpen(false)}
      apply={applyLedgerFilters}
    />
  );
  const reportPeriodModal = (
    <ReportPeriodModal
      visible={reportPeriodOpen}
      mode={reportMode}
      salarySource={reportSalarySource || salarySources[0]?.key || ''}
      salarySources={salarySources}
      customStart={reportCustomStart}
      customEnd={reportCustomEnd}
      close={() => setReportPeriodOpen(false)}
      apply={(next) => {
        setReportMode(next.mode);
        setReportSalarySource(next.salarySource);
        setReportCustomStart(next.customStart);
        setReportCustomEnd(next.customEnd);
        setReportCycleOffset(0);
        setExpandedReportCategory(null);
        setReportPeriodOpen(false);
        persist({ ...state, reportPreferences: next }).catch(() => Alert.alert('Could not save report preference', 'The report still changed for this session.'));
      }}
    />
  );
  const Accounts = () => {
    const pending = state.entries.filter((e) => e.origin === 'redcoins' && !e.reconciledImportId && !e.exportedAt);
    const awaiting = [...(state.exportBatches || [])].reverse().find((batch) => !batch.confirmedAt);
    const runExport = async (mode: 'pending' | 'all') => {
      const batch = await exportRedCoinsCsv(state, mode);
      if (!batch) return Alert.alert('Nothing new to export', 'Every RedCoins entry is already marked as imported.');
      await persist({
        ...state,
        exportBatches: [batch, ...(state.exportBatches || [])],
      });
    };
    return (
      <>
        <Title
          eyebrow="MONEY LIBRARY"
          title="Your structure, your rules."
          action="＋ Account"
          onAction={() => {
            setEditingAccountId(null);
            setDraftName('');
            setDraftType('Bank');
            setDraftIcon('business');
            setDraftBalance('0');
            setManageOpen('account');
          }}
        />
        {(['Bank', 'Cash', 'Credit card', 'Liability', 'Investment'] as RedCoinsAccountType[]).map((type) => {
          const rows = state.accounts.filter((account) => account.type === type);
          if (!rows.length) return null;
          return <View key={type} style={s.accountGroup}>
            <View style={s.accountGroupHead}>
              <Text style={s.accountGroupTitle}>{type.toUpperCase()}</Text>
              <Text style={s.accountGroupTotal}>{money(rows.reduce((sum, account) => sum + account.balance, 0))}</Text>
            </View>
            {rows.map((a, index) => (
              <TouchableOpacity key={a.id} style={[s.accountListRow, index < rows.length - 1 && s.accountListDivider]} onPress={() => openDashboardFilter('account', a.name)} activeOpacity={0.72}>
                <FinanceAvatar name={a.name} kind={a.type} icon={a.icon} />
                <View style={{ flex: 1 }}>
                  <Text style={s.accountListName}>{a.name}</Text>
                  <Text style={s.accountListMeta}>{a.type} · tap to view ledger</Text>
                </View>
                <Text style={[s.accountListBalance, a.balance < 0 && { color: C.coral }]}>{a.balance < 0 ? '− ' : ''}{money(a.balance)}</Text>
                <TouchableOpacity style={s.accountEdit} onPress={() => {
                  setEditingAccountId(a.id);
                  setDraftName(a.name);
                  setDraftType(a.type);
                  setDraftBalance(String(a.balance));
                  setDraftIcon(a.icon || inferFinanceIcon(a.name, a.type));
                  setManageOpen('account');
                }} hitSlop={8}><Ionicons name="create-outline" size={17} color={C.muted} /></TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>;
        })}
        <Title
          eyebrow="CATEGORIES"
          title="Built around your life."
          action="＋ Category"
          onAction={() => {
            setEditingCategoryId(null);
            setDraftCategory('');
            setDraftSub('');
            setDraftIcon('grid');
            setManageOpen('category');
          }}
        />
        {state.categories.map((c) => (
          <View key={c.id} style={s.categoryCard}>
            <FinanceAvatar name={c.name} kind={c.name} icon={c.icon} round />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={s.categoryTitleRow}>
                <Text style={s.categoryName}>{c.name}</Text>
                <TouchableOpacity onPress={() => {
                  setEditingCategoryId(c.id);
                  setDraftCategory(c.name);
                  setDraftSub('');
                  setDraftIcon(c.icon || inferFinanceIcon(c.name, c.name));
                  setManageOpen('category');
                }} hitSlop={8}><Ionicons name="create-outline" size={16} color={C.muted} /></TouchableOpacity>
              </View>
              {c.subcategories.map((sub) => <TouchableOpacity key={sub} style={s.subcategoryManageRow} onPress={() => {
                setDraftParent(c.name);
                setEditingSubName(sub);
                setDraftSub(sub);
                setDraftIcon(c.subcategoryIcons?.[sub] || inferFinanceIcon(sub, c.name));
                setManageOpen('sub');
              }}><Text style={s.categorySubs}>{sub}</Text><Ionicons name="chevron-forward" size={14} color={C.muted} /></TouchableOpacity>)}
            </View>
            <TouchableOpacity
              onPress={() => {
                setDraftParent(c.name);
                setEditingSubName(null);
                setDraftSub('');
                setDraftIcon('grid');
                setManageOpen('sub');
              }}
              style={s.smallButton}
            >
              <Text style={s.smallButtonText}>＋ SUB</Text>
            </TouchableOpacity>
          </View>
        ))}
        <Title eyebrow="AUTOMATION" title="What comes back." />
        <View style={s.card}>
          {state.entries
            .filter((e) => e.repeat && e.repeat !== 'none')
            .slice(0, 8)
            .map((e) => (
              <EntryRow key={e.id} entry={e} icon={iconForEntry(e)} />
            ))}
          {!state.entries.some((e) => e.repeat && e.repeat !== 'none') && <Empty text="No scheduled RedCoins entries yet." />}
        </View>
        <Title eyebrow="DATA BRIDGE" title="RedCoins → Bluecoins." />
        <View style={s.exportCard}>
          <Text style={s.exportTitle}>Weekly hand-off</Text>
          <Text style={s.exportCopy}>{pending.length} new entries since the last confirmed import. Bluecoins baseline history is never exported again.</Text>
          <TouchableOpacity style={s.exportPrimary} onPress={() => runExport('pending')}>
            <Text style={s.exportPrimaryText}>EXPORT {pending.length} NEW ENTRIES</Text>
          </TouchableOpacity>
          {awaiting && (
            <TouchableOpacity style={s.confirmImport} onPress={async () => persist(confirmRedCoinsExport(state, awaiting.id))}>
              <Ionicons name="checkmark-circle" size={17} color={C.ink} />
              <Text style={s.confirmImportText}>MARK {awaiting.entryIds.length} AS IMPORTED</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.exportSecondary} onPress={() => runExport('all')}>
            <Text style={s.exportSecondaryText}>EXPORT ALL REDCOINS ENTRIES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.exportSecondary} onPress={() => exportRedCoinsBackup(state)}>
            <Text style={s.exportSecondaryText}>BACKUP REDCOINS</Text>
          </TouchableOpacity>
        </View>
        <Title eyebrow="EXPORT HISTORY" title="What crossed over." />
        <View style={s.card}>
          {(state.exportBatches || []).slice(0, 6).map((batch) => (
            <View key={batch.id} style={s.commitRow}>
              <View>
                <Text style={s.entryName}>{batch.entryIds.length} entries</Text>
                <Text style={s.entryMeta}>{new Date(batch.createdAt).toLocaleString('en-MY')}</Text>
              </View>
              <Text style={[s.exportStatus, batch.confirmedAt && { color: '#379B73' }]}>{batch.confirmedAt ? 'IMPORTED' : 'AWAITING'}</Text>
            </View>
          ))}
          {!state.exportBatches?.length && <Empty text="No export batches yet." />}
        </View>
      </>
    );
  };
  const Plan = () => (
    <>
      <Title eyebrow="SALARY-CYCLE PLAN" title="Give every ringgit a job." />
      <View style={s.detectorCard}>
        <View style={[s.detectorIcon, notificationAccess && { backgroundColor: C.mint }]}>
          <Ionicons name={notificationAccess ? 'notifications' : 'notifications-off'} size={20} color={C.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.detectorTitle}>Transaction detector</Text>
          <Text style={s.detectorCopy}>{notificationAccess ? 'Active · eligible payment alerts are checked locally.' : 'Enable Notification access to catch eligible payments.'}</Text>
        </View>
        <TouchableOpacity style={[s.detectorButton, notificationAccess && { backgroundColor: '#DDF1E7' }]} onPress={() => BluecoinsDriveReader?.openNotificationAccessSettingsAsync?.().catch(() => Alert.alert('Unavailable', 'Notification access settings could not be opened on this device.'))}>
          <Text style={s.detectorButtonText}>{notificationAccess ? 'MANAGE' : 'ENABLE'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.detectorPrivacy}>OTP, TAC and login alerts are ignored. Notification text never leaves this phone.</Text>
      <View style={s.detectorInbox}>
        <View style={s.detectorInboxHead}>
          <View>
            <Text style={s.eyebrow}>DETECTOR INBOX</Text>
            <Text style={s.detectorInboxTitle}>{detections.length ? `${detections.length} waiting for review` : 'Nothing waiting'}</Text>
          </View>
          <TouchableOpacity style={s.detectorTest} onPress={runDetectorTest}>
            <Text style={s.detectorTestText}>RUN TEST</Text>
          </TouchableOpacity>
        </View>
        {detections.slice(0, 10).map((detection) => (
          <View key={detection.id} style={s.detectionRow}>
            <View style={s.detectionAmount}>
              <Text style={s.detectionAmountText}>{money(detection.amount)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.detectionMerchant} numberOfLines={1}>
                {detection.merchant}
              </Text>
              <Text style={s.detectionMeta} numberOfLines={1}>
                {new Date(detection.createdAt).toLocaleString('en-MY')} · {detection.accountHint || detection.source}
              </Text>
            </View>
            <TouchableOpacity style={s.detectionReview} onPress={() => reviewDetection(detection)}>
              <Text style={s.detectionReviewText}>REVIEW</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => dismissDetection(detection.id)}>
              <Ionicons name="close-circle" size={20} color={C.muted} />
            </TouchableOpacity>
          </View>
        ))}
        {!detections.length && <Text style={s.detectorEmpty}>A matching bank, wallet or SMS notification will appear here before you save it as a transaction.</Text>}
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Budget pool</Text>
        <View style={s.budgetPoolRow}>
          <Mini label="CYCLE CEILING" value={state.monthlyBudget} />
          <Mini label="ALLOCATED" value={allocatedBudget} />
          <Mini label="UNALLOCATED" value={unallocatedBudget} />
        </View>
        <View style={s.budgetTrack}>
          <View
            style={[
              s.budgetFill,
              {
                width: `${Math.min(100, (allocatedBudget / Math.max(1, state.monthlyBudget)) * 100)}%`,
                backgroundColor: allocatedBudget > state.monthlyBudget ? C.coral : C.blue,
              },
            ]}
          />
        </View>
        <Text style={s.poolHint}>Subcategory budgets share this one pool. Category totals are calculated automatically.</Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Plan controls</Text>
        <View style={s.cycleBudgetEdit}>
          <View style={{ flex: 1 }}>
            <Field label="SALARY-CYCLE BUDGET" value={cycleBudgetDraft} onChange={setCycleBudgetDraft} numeric />
          </View>
          <TouchableOpacity style={s.cycleSave} onPress={saveCycleBudget}>
            <Text style={s.cycleSaveText}>UPDATE</Text>
          </TouchableOpacity>
        </View>
        <Field
          label="PAYDAY (1—28)"
          value={paydayDraft}
          onChange={setPaydayDraft}
          numeric
        />
        <TouchableOpacity style={s.planInlineSave} onPress={async () => { const payday = Math.max(1, Math.min(28, Number(paydayDraft) || 25)); await setBluecoinsPayday(payday); await persist({ ...state, payday }, true); }}><Text style={s.planInlineSaveText}>SAVE PAYDAY</Text></TouchableOpacity>
        <Field label="SAFETY BUFFER" value={safetyBufferDraft} onChange={setSafetyBufferDraft} numeric />
        <TouchableOpacity style={s.planInlineSave} onPress={async () => { const value = Math.max(0, Number(safetyBufferDraft) || 0); await setCashRealitySafetyBuffer(value); await persist({ ...state, safetyBuffer: value }, true); }}><Text style={s.planInlineSaveText}>SAVE SAFETY BUFFER</Text></TouchableOpacity>
      </View>
      <Title eyebrow="BUDGET BY SUBCATEGORY" title="Build the cycle from below." />
      {budgetCategories.map((group) => {
        const groupBudget = categoryBudget(group.name);
        const groupSpent = catSpend[group.name] || 0;
        const expanded = expandedBudgetCategories.includes(group.name);
        return (
          <View key={group.id} style={s.budgetCategoryCard}>
            <TouchableOpacity style={s.budgetCategoryHead} onPress={() => setExpandedBudgetCategories((current) => (current.includes(group.name) ? current.filter((name) => name !== group.name) : [...current, group.name]))}>
              <View style={{ flex: 1 }}>
                <Text style={s.budgetCategoryName}>
                  {ICON_LIBRARY.includes(group.icon) ? <Ionicons name={group.icon as any} size={14} color={C.ink} /> : group.icon} {group.name}
                </Text>
                <Text style={s.budgetCategoryMeta}>{money(groupSpent)} spent this cycle</Text>
              </View>
              <View style={s.budgetCategoryTotal}>
                <Text style={s.budgetCategoryAmount}>{money(groupBudget)}</Text>
                <Text style={s.budgetCategoryLabel}>CATEGORY BUDGET</Text>
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={C.muted} />
            </TouchableOpacity>
            <View style={s.categoryBudgetProgress}>
              <View style={s.subBudgetTrack}>
                <View
                  style={[
                    s.subBudgetFill,
                    {
                      width: `${groupBudget ? Math.min(100, (groupSpent / groupBudget) * 100) : 0}%`,
                      backgroundColor: groupBudget > 0 && groupSpent > groupBudget ? C.coral : C.blue,
                    },
                  ]}
                />
              </View>
              <Text style={s.categoryBudgetProgressText}>
                {groupBudget > 0 ? `${Math.round((groupSpent / groupBudget) * 100)}% · ${money(groupSpent)} of ${money(groupBudget)}` : 'No budget allocated'}
              </Text>
            </View>
            {expanded &&
              group.subcategories.map((sub) => {
                const key = budgetKey(group.name, sub);
                const limit = state.subcategoryBudgets[key] || 0;
                const used = subcategorySpend[key] || 0;
                const percent = limit ? (used / limit) * 100 : 0;
                return (
                  <TouchableOpacity key={sub} style={s.subBudgetRow} onPress={() => openBudgetEditor(group.name, sub)}>
                    <View style={s.subBudgetTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.subBudgetName}>{sub}</Text>
                        <Text style={s.subBudgetSpent}>{money(used)} spent</Text>
                      </View>
                      <Text style={[s.subBudgetLimit, !limit && { color: C.muted }]}>{limit ? money(limit) : 'SET BUDGET'}</Text>
                      <Ionicons name="chevron-forward" size={15} color={C.muted} />
                    </View>
                    {limit > 0 && (
                      <View style={s.subBudgetTrack}>
                        <View
                          style={[
                            s.subBudgetFill,
                            {
                              width: `${Math.min(100, percent)}%`,
                              backgroundColor: percent > 100 ? C.coral : C.blue,
                            },
                          ]}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
          </View>
        );
      })}
      <View style={s.card}>
        <Text style={s.cardTitle}>Cash reality</Text>
        <Text style={s.realityLabel}>TRUE CASH AVAILABLE</Text>
        <Text style={[s.realityNumber, trueSpendable < 0 && { color: C.coral }]}>
          {trueSpendable < 0 ? '− ' : ''}
          {money(trueSpendable)}
        </Text>
        <View style={s.grid}>
          <Mini label="SELECTED CASH" value={cash} />
          <Mini label="CARD OWED" value={-cardDebt} />
          <Mini label="CYCLE LEFT" value={remaining} />
        </View>
        <Text style={s.poolHint}>{money(cash)} selected cash − {money(cardDebt)} card owed − {money(state.safetyBuffer)} buffer{(bluecoins?.monthly.expectedFixedCommitments.items || []).some((item) => item.category === 'Debt commitment' && item.status === 'due') ? ' − unpaid loan reserve' : ''}. Cycle budget left is shown separately.</Text>
        {bluecoins?.cashReality.cashAccounts.map((candidate) => (
          <TouchableOpacity key={candidate.name} style={s.cashSelectRow} onPress={async () => {
            const selected = bluecoins.cashReality.cashAccounts.filter((item) => item.name === candidate.name ? !item.selected : item.selected).map((item) => item.name);
            setBluecoins((current) => current ? { ...current, cashReality: { ...current.cashReality, selectedAccounts: selected, cashAccounts: current.cashReality.cashAccounts.map((item) => ({ ...item, selected: selected.includes(item.name) })) } } : current);
            await setCashRealityAccounts(selected);
            await refreshLiveBluecoins();
          }}>
            <Ionicons name={candidate.selected ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={candidate.selected ? C.ink : C.muted} />
            <Text style={s.cashSelectName}>{candidate.name}</Text><Text style={s.cashSelectAmount}>{money(candidate.balance)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Title eyebrow="FIXED COMMITMENTS" title="Expected before payday." action={fixedPickerOpen ? 'DONE' : 'MANAGE'} onAction={() => setFixedPickerOpen((value) => !value)} />
      {fixedPickerOpen && <View style={s.fixedPickerCard}>
        {bluecoins?.monthly.fixedCommitmentOptions.map((option) => <TouchableOpacity key={option.key} style={s.cashSelectRow} onPress={async () => {
          const current = bluecoins.monthly.fixedCommitmentSelection;
          const next = option.selected ? current.filter((key) => key !== option.key) : [...current, option.key];
          setBluecoins((value) => value ? { ...value, monthly: { ...value.monthly, fixedCommitmentSelection: next, fixedCommitmentOptions: value.monthly.fixedCommitmentOptions.map((item) => ({ ...item, selected: next.includes(item.key) })) } } : value);
          await setBluecoinsFixedCommitments(next);
          await refreshLiveBluecoins();
        }}><Ionicons name={option.selected ? 'checkbox' : 'square-outline'} size={18} color={option.selected ? C.coral : C.muted} /><View style={{flex: 1}}><Text style={s.cashSelectName}>{option.label}</Text><Text style={s.guardMeta}>Last paid {option.lastUsed}</Text></View><Text style={s.cashSelectAmount}>{money(option.lastAmount)}</Text></TouchableOpacity>)}
      </View>}
      <View style={s.expectedCard}>
        <View style={s.expectedHero}>
          <View>
            <Text style={s.expectedEyebrow}>EXPECTED THIS CYCLE</Text>
            <Text style={s.expectedTotal}>{money(bluecoins?.monthly.expectedFixedCommitments.total || 0)}</Text>
          </View>
          <View style={s.expectedRight}>
            <Text style={s.expectedRemaining}>{money(bluecoins?.monthly.expectedFixedCommitments.remaining || 0)}</Text>
            <Text style={s.expectedRemainingLabel}>STILL EXPECTED</Text>
          </View>
        </View>
        <View style={s.expectedStats}>
          <Text style={s.expectedStat}>
            Paid now · <Text style={s.expectedStatStrong}>{money(bluecoins?.monthly.expectedFixedCommitments.paid || 0)}</Text>
          </Text>
          <Text style={s.expectedStat}>{bluecoins?.monthly.expectedFixedCommitments.items.length || 0} recurring items</Text>
        </View>
        {bluecoins?.monthly.expectedFixedCommitments.items.map((commitment) => (
          <View key={commitment.key} style={s.expectedRow}>
            <View style={[s.expectedStatus, commitment.status === 'paid' && s.expectedStatusPaid]}>
              <Ionicons name={commitment.status === 'paid' ? 'checkmark' : 'time-outline'} size={13} color={commitment.status === 'paid' ? '#168A65' : C.coral} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.expectedName}>{commitment.label.split(' | ').pop()}</Text>
              <Text style={s.expectedMeta}>
                {commitment.label.split(' | ')[0]} · last paid {commitment.lastUsed}
              </Text>
            </View>
            <View style={s.expectedAmounts}>
              <Text style={s.expectedAmount}>{money(commitment.expectedAmount)}</Text>
              <Text style={[s.expectedState, commitment.status === 'paid' && { color: '#168A65' }]}>{commitment.status === 'paid' ? `PAID ${money(commitment.currentAmount)}` : 'DUE'}</Text>
            </View>
          </View>
        ))}
        {!bluecoins?.monthly.expectedFixedCommitments.items.length && <Empty text="Pick recurring items in Budget Coach to build this list." />}
      </View>
      <Title eyebrow="SPENDING GUARDS" title="Boundaries before regret." action="＋ GUARD" onAction={() => { setGuardDraft({ name: '', scope: 'account', target: bluecoins?.guardOptions.accounts[0] || '', limit: '' }); setGuardEditorOpen(true); }} />
      <View style={s.guardList}>
        {bluecoins?.spendingGuards.map((guard) => (
          <View key={guard.id} style={s.guardCardRow}>
          <TouchableOpacity style={s.guardRow} onPress={() => { setExpandedGuardPart(null); setExpandedGuardId((value) => value === guard.id ? null : guard.id); }} activeOpacity={0.8}>
            <View style={[s.guardDot, { backgroundColor: guard.level === 'breached' || guard.level === 'slow-down' ? C.coral : guard.level === 'heads-up' ? C.gold : C.mint }]} />
            <View style={{ flex: 1 }}>
              <View style={s.guardLine}><Text style={s.guardName}>{guard.name}</Text><Text style={s.guardPercent}>{guard.percent.toFixed(0)}%</Text></View>
              <Text style={s.guardMeta}>{guard.scope.toUpperCase()} · {money(guard.spent)} / {money(guard.limit)}</Text>
              <View style={s.budgetTrack}><View style={[s.budgetFill, { width: `${Math.min(100, guard.percent)}%` }]} /></View>
            </View>
            <TouchableOpacity onPress={(event) => { event.stopPropagation(); setGuardDraft({ id: guard.id, name: guard.name, scope: guard.scope, target: guard.target, limit: String(guard.limit) }); setGuardEditorOpen(true); }}><Ionicons name="create-outline" size={17} color={C.muted} /></TouchableOpacity>
          </TouchableOpacity>
            {expandedGuardId === guard.id && <View style={s.guardDetails}>
              <Text style={s.guardDetailsTitle}>WHERE IT WENT</Text>
              {guard.breakdown.map((part) => <View key={part.name}><TouchableOpacity style={s.guardDetailRow} onPress={() => setExpandedGuardPart((value) => value === part.name ? null : part.name)}><Text style={s.guardDetailName}>{part.name}</Text><Text style={s.guardDetailAmount}>{money(part.amount)} · {part.share.toFixed(0)}%</Text><Ionicons name={expandedGuardPart === part.name ? 'chevron-up' : 'chevron-down'} size={13} color={C.muted} /></TouchableOpacity>
                {expandedGuardPart === part.name && guard.transactions.filter((charge) => guard.scope === 'subcategory' ? charge.itemName === part.name : charge.subcategory === part.name).map((charge, index) => <View key={`${charge.itemName}-${index}`} style={s.guardChargeRow}><View style={{flex: 1}}><Text style={s.guardDetailName}>{charge.itemName}</Text><Text style={s.guardMeta}>{charge.date} · {charge.category} / {charge.subcategory}</Text></View><Text style={s.guardDetailAmount}>{money(charge.amount)}</Text></View>)}
              </View>)}
            </View>}
          </View>
        ))}
        {!bluecoins?.spendingGuards.length && <Empty text="No spending guard configured yet." />}
      </View>
    </>
  );
  const exportCurrentReportPdf = async () => {
    if (!report || reportExporting) return;
    setReportExporting(true);
    try {
      const periodLabel = reportMode === 'salary-cycle' ? report.cycleLabel : `${reportDate(report.start)} — ${reportDate(report.displayEnd)}`;
      const biggestCategory = report.categories[0];
      const healthLine = report.net >= 0
        ? `This period retained ${money(report.net)} after expenses.`
        : `Expenses exceeded income by ${money(Math.abs(report.net))} during this period.`;
      const categoryMarkup = report.categories.map(([name, group], index) => {
        const share = report.expense ? (group.amount / report.expense) * 100 : 0;
        const subs = [...group.subcategories].sort((a, b) => b[1] - a[1]).map(([sub, amount]) => `<div class="sub"><span>${html(sub)}</span><b>${html(money(amount))}</b></div>`).join('');
        return `<section class="category keep"><div class="cat-head"><span class="rank">${String(index + 1).padStart(2, '0')}</span><div class="grow"><div class="line"><h3>${html(name)}</h3><strong>${html(money(group.amount))}</strong></div><div class="bar"><i style="width:${Math.min(100, share).toFixed(2)}%"></i></div><small>${share.toFixed(1)}% of expense · ${group.entries.length} charge${group.entries.length === 1 ? '' : 's'}</small></div></div><div class="subs">${subs}</div></section>`;
      }).join('');
      const accountMarkup = report.accountMovement.map(([name, movement]) => {
        const net = movement.incoming - movement.outgoing;
        return `<div class="account keep"><div><h3>${html(name)}</h3><small>In ${html(money(movement.incoming))} · Out ${html(money(movement.outgoing))}</small></div><strong class="${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : '−'}${html(money(net))}</strong></div>`;
      }).join('');
      const scheduledMarkup = report.scheduledRows.length ? report.scheduledRows.sort((a, b) => a.date.localeCompare(b.date)).map((entry) => `<div class="transaction"><div><b>${html(entry.item)}</b><small>${html(reportDate(new Date(entry.date)))} · ${html(entry.account)} · ${html(entry.subcategory)}</small></div><strong>${html(money(entry.amount))}</strong></div>`).join('') : '<p class="empty">No scheduled transactions inside this period.</p>';
      const appendix = [...report.rows].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => `<tr><td>${html(reportDate(new Date(entry.date)))}</td><td><b>${html(entry.item)}</b><small>${html(entry.category)} / ${html(entry.subcategory)}</small></td><td>${html(entry.account)}${entry.toAccount ? ` → ${html(entry.toAccount)}` : ''}</td><td class="type">${html(entry.type)}</td><td class="num ${entry.type === 'income' ? 'positive' : entry.type === 'expense' ? 'negative' : ''}">${entry.type === 'income' ? '+' : entry.type === 'expense' ? '−' : ''}${html(money(entry.amount))}</td></tr>`).join('');
      const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
        @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111A2A;margin:0;background:#fff;font-size:10px}h1,h2,h3,p{margin:0}.hero{background:#111A2A;color:#FFF9EA;border-radius:22px;padding:27px;margin-bottom:16px}.brand{color:#F04444;font-size:10px;font-weight:900;letter-spacing:2px}.hero h1{font-family:Georgia,serif;font-size:30px;margin:9px 0 5px}.hero .period{color:#8BD8B6;font-weight:800}.hero .dates{color:#AAB3C1;margin-top:6px}.metrics{display:flex;gap:9px;margin:14px 0}.metric{flex:1;background:#F0E6D4;border-radius:14px;padding:13px}.metric label{display:block;color:#727987;font-size:8px;font-weight:900;letter-spacing:1px}.metric b{display:block;font-family:Georgia,serif;font-size:20px;margin-top:6px}.positive{color:#168A65!important}.negative{color:#E14444!important}.insight{border-left:5px solid #83D8B4;background:#F5F0E7;padding:13px 15px;border-radius:4px 13px 13px 4px;margin-bottom:18px;line-height:1.5}.section-title{font-family:Georgia,serif;font-size:20px;margin:20px 0 4px}.section-kicker{color:#F04444;font-size:8px;font-weight:900;letter-spacing:1.5px}.section-copy{color:#727987;margin:4px 0 10px}.keep{break-inside:avoid}.category{padding:12px 0;border-bottom:1px solid #E6DED1}.cat-head{display:flex;gap:10px}.rank{color:#F04444;font-weight:900}.grow{flex:1}.line{display:flex;justify-content:space-between;align-items:center}.line h3{font-size:12px}.bar{height:5px;background:#ECE5D9;border-radius:5px;margin:7px 0}.bar i{display:block;height:5px;background:#E7B84A;border-radius:5px}.category small,.account small,.transaction small,td small{display:block;color:#7C8290;margin-top:3px}.subs{margin:8px 0 0 23px;background:#F7F1E6;border-radius:10px;padding:6px 10px}.sub{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #E8DFD1}.sub:last-child{border:0}.account,.transaction{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E8E1D5}.page-break{break-before:page}.summary-strip{display:flex;gap:7px;margin:10px 0}.fact{flex:1;background:#F7F1E6;padding:10px;border-radius:10px}.fact span{display:block;color:#7C8290;font-size:7px;font-weight:900;letter-spacing:.7px}.fact b{display:block;margin-top:4px;font-size:11px}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:8px}th{text-align:left;background:#111A2A;color:#FFF9EA;padding:8px}td{padding:7px;border-bottom:1px solid #E8E1D5;vertical-align:top}.num{text-align:right;font-weight:900}.type{text-transform:uppercase;color:#727987}.footer{color:#8A8F99;border-top:1px solid #DDD5C8;margin-top:22px;padding-top:8px;font-size:7px}.empty{color:#7C8290;background:#F7F1E6;padding:12px;border-radius:10px}
      </style></head><body>
        <header class="hero"><div class="brand">LEANLOG / REDCOINS</div><h1>Money, told clearly.</h1><div class="period">${html(periodLabel)}</div><div class="dates">${html(reportDate(report.start))} → ${html(report.ongoing ? 'Today · ongoing' : reportDate(report.displayEnd))}</div></header>
        <div class="metrics"><div class="metric"><label>INCOME</label><b class="positive">${html(money(report.income))}</b></div><div class="metric"><label>EXPENSE</label><b class="negative">${html(money(report.expense))}</b></div><div class="metric"><label>NET RETAINED</label><b class="${report.net >= 0 ? 'positive' : 'negative'}">${report.net >= 0 ? '' : '−'}${html(money(report.net))}</b></div></div>
        <div class="insight"><b>Period reading.</b> ${html(healthLine)}${biggestCategory ? ` The largest category was ${html(biggestCategory[0])} at ${html(money(biggestCategory[1].amount))}.` : ''}</div>
        <div class="summary-strip"><div class="fact"><span>TRANSFERS</span><b>${html(money(report.transfer))}</b></div><div class="fact"><span>TRANSACTIONS</span><b>${report.rows.length}</b></div><div class="fact"><span>SCHEDULED</span><b>${report.scheduledRows.length}</b></div><div class="fact"><span>DAYS COVERED</span><b>${Math.max(1, Math.ceil((report.displayEnd.getTime() - report.start.getTime()) / 86400000) + 1)}</b></div></div>
        <div class="section-kicker">SPENDING MAP</div><h2 class="section-title">Where the money went</h2><p class="section-copy">Category share, subcategory composition and charge volume for this exact reporting window.</p>${categoryMarkup || '<p class="empty">No expenses in this period.</p>'}
        <div class="section-kicker">CASH MOVEMENT</div><h2 class="section-title">Accounts in motion</h2><p class="section-copy">Transfers appear here but are not counted as expense.</p>${accountMarkup || '<p class="empty">No account movement in this period.</p>'}
        <div class="section-kicker">LOOKING AHEAD</div><h2 class="section-title">Scheduled inside the window</h2>${scheduledMarkup}
        <section class="page-break"><div class="section-kicker">AUDIT TRAIL</div><h2 class="section-title">Transaction appendix</h2><p class="section-copy">Every actual transaction used to calculate this report.</p><table><thead><tr><th>Date</th><th>Transaction</th><th>Account</th><th>Type</th><th style="text-align:right">Amount</th></tr></thead><tbody>${appendix || '<tr><td colspan="5">No transactions.</td></tr>'}</tbody></table></section>
        <div class="footer">Generated by LeanLog on ${html(new Date().toLocaleString('en-MY'))}. Transfers are excluded from expense and net-retained calculations. Future-dated entries are shown separately as scheduled.</div>
      </body></html>`;
      const printable = await Print.printToFileAsync({ html: documentHtml });
      const safeName = `LeanLog_Report_${dayKey(report.start.toISOString())}_${dayKey(report.displayEnd.toISOString())}_${Date.now()}.pdf`;
      const destination = `${FileSystem.documentDirectory}${safeName}`;
      await FileSystem.copyAsync({ from: printable.uri, to: destination });
      if (!(await Sharing.isAvailableAsync())) return Alert.alert('PDF created', `Saved as ${safeName}.`);
      await Sharing.shareAsync(destination, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Export ${periodLabel}` });
    } catch (error) {
      console.warn('RedCoins report PDF export failed', error);
      Alert.alert('PDF export failed', 'LeanLog could not generate this report. Please try again.');
    } finally {
      setReportExporting(false);
    }
  };

  const Reports = () => report ? (
    <>
      <Title eyebrow="REPORTS" title="The whole money story." action={reportExporting ? 'BUILDING…' : 'PDF ↗'} onAction={exportCurrentReportPdf} />
      <TouchableOpacity style={s.reportPeriodCard} onPress={() => setReportPeriodOpen(true)} activeOpacity={0.82}>
        <View style={s.reportPeriodTop}>
          <View>
            <Text style={s.reportPeriodEyebrow}>{reportMode === 'salary-cycle' ? 'SALARY CYCLE' : 'CUSTOM REPORT'}</Text>
            <Text style={s.reportPeriodTitle}>{reportMode === 'salary-cycle' ? report.cycleLabel : `${reportDate(report.start)} — ${reportDate(report.displayEnd)}`}</Text>
          </View>
          <View style={s.reportChange}><Text style={s.reportChangeText}>CHANGE</Text></View>
        </View>
        <Text style={s.reportPeriodDates}>{reportDate(report.start)} → {report.ongoing ? 'Today · ongoing' : reportDate(report.displayEnd)}</Text>
        {reportMode === 'salary-cycle' && <View style={s.reportCycleNav}>
          <TouchableOpacity disabled={report.safeOffset >= report.maxOffset} onPress={(event) => { event.stopPropagation(); setReportCycleOffset((value) => Math.min(report.maxOffset, value + 1)); }} style={[s.reportArrow, report.safeOffset >= report.maxOffset && s.reportArrowDisabled]}><Ionicons name="chevron-back" size={17} color={C.ink} /></TouchableOpacity>
          <Text style={s.reportCycleNavText}>{report.safeOffset === 0 ? 'LATEST CYCLE' : `${report.safeOffset} CYCLE${report.safeOffset > 1 ? 'S' : ''} AGO`}</Text>
          <TouchableOpacity disabled={report.safeOffset === 0} onPress={(event) => { event.stopPropagation(); setReportCycleOffset((value) => Math.max(0, value - 1)); }} style={[s.reportArrow, report.safeOffset === 0 && s.reportArrowDisabled]}><Ionicons name="chevron-forward" size={17} color={C.ink} /></TouchableOpacity>
        </View>}
      </TouchableOpacity>

      <View style={s.grid}>
        <Stat label="INCOME" value={report.income} color="#168A65" />
        <Stat label="EXPENSE" value={report.expense} color={C.coral} />
        <Stat label="NET RETAINED" value={report.net} color={report.net >= 0 ? C.blue : C.coral} />
      </View>
      <View style={s.reportFacts}>
        <View style={s.reportFact}><Text style={s.reportFactLabel}>TRANSFERS</Text><Text style={s.reportFactValue}>{money(report.transfer)}</Text></View>
        <View style={s.reportFact}><Text style={s.reportFactLabel}>TRANSACTIONS</Text><Text style={s.reportFactValue}>{report.rows.length}</Text></View>
        <View style={s.reportFact}><Text style={s.reportFactLabel}>SCHEDULED</Text><Text style={s.reportFactValue}>{report.scheduledRows.length}</Text></View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Where the money went</Text>
        <Text style={s.reportSectionHint}>Tap a category to inspect its subcategories and charges.</Text>
        {report.categories.map(([name, group], index) => {
          const expanded = expandedReportCategory === name;
          return <View key={name} style={s.reportCategoryBlock}>
            <TouchableOpacity style={s.reportCategoryHead} onPress={() => setExpandedReportCategory(expanded ? null : name)} activeOpacity={0.75}>
              <Text style={s.reportRank}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={{ flex: 1 }}>
                <View style={s.reportCategoryLine}><Text style={s.reportName}>{name}</Text><Text style={s.reportValue}>{money(group.amount)}</Text></View>
                <View style={s.reportTrack}><View style={[s.reportFill, { width: `${report.expense ? Math.min(100, (group.amount / report.expense) * 100) : 0}%` }]} /></View>
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={C.muted} />
            </TouchableOpacity>
            {expanded && <View style={s.reportDrilldown}>
              {[...group.subcategories].sort((a, b) => b[1] - a[1]).map(([subcategoryName, amount]) => <View key={subcategoryName}>
                <View style={s.reportSubRow}><Text style={s.reportSubName}>{subcategoryName}</Text><Text style={s.reportSubAmount}>{money(amount)}</Text></View>
                {group.entries.filter((entry) => entry.subcategory === subcategoryName).sort((a, b) => b.date.localeCompare(a.date)).map((entry) => <TouchableOpacity key={entry.id} style={s.reportCharge} onPress={() => editEntry(entry)}><View style={{ flex: 1 }}><Text style={s.reportChargeName}>{entry.item}</Text><Text style={s.reportChargeMeta}>{reportDate(new Date(entry.date))} · {entry.account}</Text></View><Text style={s.reportChargeAmount}>{money(entry.amount)}</Text></TouchableOpacity>)}
              </View>)}
            </View>}
          </View>;
        })}
        {!report.categories.length && <Empty text="No expenses inside this reporting window." />}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Account movement</Text>
        <Text style={s.reportSectionHint}>Transfers move cash between accounts but do not count as expense.</Text>
        {report.accountMovement.map(([name, movement]) => <View key={name} style={s.reportAccountRow}><View style={{ flex: 1 }}><Text style={s.reportName}>{name}</Text><Text style={s.reportChargeMeta}>In {money(movement.incoming)} · Out {money(movement.outgoing)}</Text></View><Text style={[s.reportAccountNet, { color: movement.incoming - movement.outgoing >= 0 ? '#168A65' : C.coral }]}>{movement.incoming - movement.outgoing >= 0 ? '+' : '− '}{money(movement.incoming - movement.outgoing)}</Text></View>)}
        {!report.accountMovement.length && <Empty text="No account movement in this period." />}
      </View>
    </>
  ) : null;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={s.back}>
          <Ionicons name="arrow-back" size={21} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>REDCOINS</Text>
          <Text style={s.source}>{state.importedSource ? `Structure seeded from ${state.importedSource}` : 'LeanLog money room'}</Text>
        </View>
      </View>
      {section === 'activity' ? (
        <View style={s.activityBody}>
          {activityHeader}
          <View style={s.ledgerCard}>
            <SectionList
              sections={activitySections}
              keyExtractor={(entry) => entry.id}
              renderItem={({ item: entry }) => <EntryRow entry={entry} icon={iconForEntry(entry)} accountBalance={entryBalanceById.get(entry.id)} selected={selectedSet.has(entry.id)} onPress={selectedIds.length ? () => toggleSelected(entry) : () => editEntry(entry)} onLong={() => toggleSelected(entry)} />}
              renderSectionHeader={({ section }) => (
                <View style={s.ledgerDate}>
                  <Text style={s.ledgerDateText}>{section.title}</Text>
                  <Text style={[s.ledgerDayTotal, section.total > 0 && { color: '#168A65' }]}>
                    {section.total > 0 ? '+' : section.total < 0 ? '− ' : ''}
                    {money(section.total)}
                  </Text>
                </View>
              )}
              extraData={ledgerExtraData}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              updateCellsBatchingPeriod={16}
              windowSize={5}
              removeClippedSubviews
              onEndReached={() => setVisibleLedgerCount((count) => Math.min(ledgerTotal, count + LEDGER_PAGE_SIZE))}
              onEndReachedThreshold={0.6}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="on-drag"
              ListEmptyComponent={<Empty text="No matching RedCoins entries." />}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled
              contentContainerStyle={!ledgerEntries.length ? s.emptyLedger : s.ledgerContent}
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {section === 'home' ? Home() : section === 'accounts' ? Accounts() : section === 'plan' ? Plan() : Reports()}
        </ScrollView>
      )}
      {filterModal}
      {reportPeriodModal}
      <View style={s.nav}>
        {(['home', 'activity', 'accounts', 'plan', 'reports'] as Section[]).map((name) => (
          <TouchableOpacity key={name} style={[s.navButton, section === name && s.navActive]} onPress={() => setSection(name)}>
            <Ionicons
              name={
                (
                  {
                    home: 'grid',
                    activity: 'list',
                    accounts: 'wallet',
                    plan: 'shield-checkmark',
                    reports: 'bar-chart',
                  } as any
                )[name]
              }
              size={18}
              color={section === name ? C.white : '#8993A6'}
            />
            <Text style={[s.navText, section === name && { color: C.white }]}>{name[0].toUpperCase() + name.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <EntryModal
        visible={entryOpen}
        editing={!!editingEntryId}
        onDelete={deleteEditingEntry}
        close={() => setEntryOpen(false)}
        {...{
          item,
          setItem,
          amount,
          setAmount,
          type,
          setType,
          applyEntryType,
          account,
          setAccount,
          toAccount,
          setToAccount,
          category,
          setCategory,
          subcategory,
          setSubcategory,
          note,
          setNote,
          labels,
          setLabels,
          repeat,
          setRepeat,
          installments,
          setInstallments,
          advanced,
          setAdvanced,
          suggestions,
          chooseSuggestion,
          saveEntry,
          entryDate,
          setEntryDate,
          state,
        }}
      />
      <BudgetModal visible={!!budgetEditor} target={budgetEditor} value={budgetDraft} setValue={setBudgetDraft} allocated={allocatedBudget} total={state.monthlyBudget} current={budgetEditor ? state.subcategoryBudgets[budgetKey(budgetEditor.category, budgetEditor.subcategory)] || 0 : 0} close={() => setBudgetEditor(null)} save={saveSubcategoryBudget} />
      <ManageModal
        visible={!!manageOpen}
        mode={manageOpen}
        close={() => { setManageOpen(null); setEditingAccountId(null); setEditingCategoryId(null); setEditingSubName(null); }}
        editing={!!(editingAccountId || editingCategoryId || editingSubName)}
        state={state}
        draft={{
          draftName,
          setDraftName,
          draftType,
          setDraftType,
          draftBalance,
          setDraftBalance,
          draftCategory,
          setDraftCategory,
          draftSub,
          setDraftSub,
          draftParent,
          draftIcon,
          setDraftIcon,
        }}
        save={async () => {
          const next = {
            ...state,
            accounts: [...state.accounts],
            categories: state.categories.map((c) => ({
              ...c,
              subcategories: [...c.subcategories],
            })),
          };
          if (manageOpen === 'account') {
            if (!draftName.trim()) return;
            const existing = next.accounts.find((entry) => entry.id === editingAccountId);
            if (existing) {
              const oldName = existing.name;
              existing.name = draftName.trim(); existing.type = draftType; existing.balance = Number(draftBalance) || 0; existing.icon = draftIcon;
              next.entries = next.entries.map((entry) => ({ ...entry, account: entry.account === oldName ? existing.name : entry.account, toAccount: entry.toAccount === oldName ? existing.name : entry.toAccount }));
            } else next.accounts.push({
              id: `${Date.now()}`,
              name: draftName.trim(),
              type: draftType,
              balance: Number(draftBalance) || 0,
              icon: draftIcon,
            });
          } else if (manageOpen === 'category') {
            if (!draftCategory.trim() || (!editingCategoryId && !draftSub.trim())) return;
            const existing = next.categories.find((entry) => entry.id === editingCategoryId);
            if (existing) {
              const oldName = existing.name; existing.name = draftCategory.trim(); existing.icon = draftIcon;
              next.entries = next.entries.map((entry) => ({ ...entry, category: entry.category === oldName ? existing.name : entry.category }));
              const budgets: Record<string, number> = {};
              Object.entries(next.subcategoryBudgets).forEach(([key, value]) => { const [cat, sub] = key.split('\u0000'); budgets[budgetKey(cat === oldName ? existing.name : cat, sub)] = value; });
              next.subcategoryBudgets = budgets;
            } else next.categories.push({
              id: `${Date.now()}`,
              name: draftCategory.trim(),
              icon: draftIcon,
              subcategories: [draftSub.trim()],
              subcategoryIcons: { [draftSub.trim()]: draftIcon },
            });
          } else {
            const parent = next.categories.find((c) => c.name === draftParent);
            if (!parent || !draftSub.trim()) return;
            if (editingSubName) {
              parent.subcategories = parent.subcategories.map((sub) => sub === editingSubName ? draftSub.trim() : sub);
              next.entries = next.entries.map((entry) => entry.category === parent.name && entry.subcategory === editingSubName ? { ...entry, subcategory: draftSub.trim() } : entry);
              const oldKey = budgetKey(parent.name, editingSubName); const newKey = budgetKey(parent.name, draftSub.trim());
              if (next.subcategoryBudgets[oldKey] != null) { next.subcategoryBudgets[newKey] = next.subcategoryBudgets[oldKey]; delete next.subcategoryBudgets[oldKey]; }
              const icons = { ...(parent.subcategoryIcons || {}) }; delete icons[editingSubName]; icons[draftSub.trim()] = draftIcon; parent.subcategoryIcons = icons;
            } else if (!parent.subcategories.includes(draftSub.trim())) { parent.subcategories.push(draftSub.trim()); parent.subcategoryIcons = { ...(parent.subcategoryIcons || {}), [draftSub.trim()]: draftIcon }; }
          }
          await persist(next);
          setManageOpen(null);
          setEditingAccountId(null); setEditingCategoryId(null); setEditingSubName(null);
        }}
      />
      <GuardModal visible={guardEditorOpen} draft={guardDraft} setDraft={setGuardDraft} options={bluecoins?.guardOptions} close={() => setGuardEditorOpen(false)} remove={guardDraft.id ? async () => {
        await saveSpendingGuards((bluecoins?.spendingGuards || []).filter((guard) => guard.id !== guardDraft.id));
        if (bluecoinsBase) setBluecoins(await mergeRedCoinsIntoBudgetCoach(bluecoinsBase));
        setGuardEditorOpen(false);
      } : undefined} save={async () => {
        const value = Math.max(0, Number(guardDraft.limit) || 0);
        if (!guardDraft.name.trim() || !guardDraft.target || !value) return Alert.alert('Guard incomplete', 'Add a name, target and limit.');
        const guards: SpendingGuard[] = (bluecoins?.spendingGuards || []).map(({ spent, remaining: _r, percent: _p, projected: _pr, level: _l, cycleStart: _cs, cycleEnd: _ce, transactions: _t, breakdown: _b, ...guard }) => guard);
        const next: SpendingGuard = { id: guardDraft.id || `guard_${Date.now()}`, name: guardDraft.name.trim(), scope: guardDraft.scope, target: guardDraft.target, limit: value, cycle: 'salary', thresholds: [50, 70, 85, 100], tone: 'normal', enabled: true };
        const index = guards.findIndex((guard) => guard.id === next.id); if (index >= 0) guards[index] = next; else guards.push(next);
        await saveSpendingGuards(guards);
        if (bluecoinsBase) setBluecoins(await mergeRedCoinsIntoBudgetCoach(bluecoinsBase));
        setGuardEditorOpen(false);
      }} />
    </SafeAreaView>
  );
}

function BudgetDonut({ segments, spent }: { segments: { name: string; value: number; color: string; percent: number }[]; spent: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <View style={s.donutWrap}>
      <Svg width={108} height={108} viewBox="0 0 108 108">
        <Circle cx="54" cy="54" r={radius} stroke="#DED7CC" strokeWidth="18" fill="none" />
        {segments.map((segment) => {
          const length = spent ? (segment.value / spent) * circumference : 0;
          const dashOffset = -offset;
          offset += length;
          return <Circle key={segment.name} cx="54" cy="54" r={radius} stroke={segment.color} strokeWidth="18" fill="none" strokeDasharray={`${length} ${circumference}`} strokeDashoffset={dashOffset} rotation="-90" origin="54,54" />;
        })}
      </Svg>
      <View style={s.donutCenter}>
        <Text style={s.donutValue}>{money(spent)}</Text>
        <Text style={s.donutLabel}>SPENT</Text>
      </View>
    </View>
  );
}
function Title({ eyebrow, title, action, onAction }: any) {
  return (
    <View style={s.titleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.title}>{title}</Text>
      </View>
      {action && (
        <TouchableOpacity style={s.titleAction} onPress={onAction}>
          <Text style={s.titleActionText}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
function Mini({ label, value }: any) {
  return (
    <View style={s.mini}>
      <Text style={s.miniValue}>
        {value < 0 ? '− ' : ''}
        {money(value)}
      </Text>
      <Text style={s.miniLabel}>{label}</Text>
    </View>
  );
}
function Stat({ label, value, color }: any) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]}>
        {value < 0 ? '− ' : ''}
        {money(value)}
      </Text>
    </View>
  );
}
function PlanCell({ label, value }: any) {
  return (
    <View style={s.planCell}>
      <Text style={s.planLabel}>{label}</Text>
      <Text style={s.planValue}>
        {value < 0 ? '− ' : ''}
        {money(value)}
      </Text>
    </View>
  );
}
function Empty({ text }: any) {
  return <Text style={s.empty}>{text}</Text>;
}
const transactionIcon = (entry: RedCoinsEntry): any => {
  if (entry.type === 'transfer') return 'swap-horizontal';
  if (entry.type === 'income') return 'arrow-down';
  const label = `${entry.category} ${entry.subcategory}`.toLowerCase();
  if (/food|dining|jajan|makan|restaurant|water/.test(label)) return 'restaurant';
  if (/fuel|minyak|petrol|car|motor|engine/.test(label)) return 'car';
  if (/home|house|hardware|mortgage/.test(label)) return 'home';
  if (/health|medical|clinic/.test(label)) return 'medkit';
  if (/bill|utilities|electric|internet/.test(label)) return 'receipt';
  return 'wallet';
};
const EntryRow = memo(function EntryRow({ entry, icon, accountBalance, onLong, onPress, selected }: { entry: RedCoinsEntry; icon?: string; accountBalance?: number; onLong?: () => void; onPress?: () => void; selected?: boolean }) {
  const color = entry.type === 'transfer' ? C.blue : entry.type === 'income' ? '#18A879' : C.coral;
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLong} delayLongPress={350} style={[s.entry, selected && s.entrySelected]}>
      <View style={[s.entryIcon, { backgroundColor: color }]}>{selected ? <Ionicons name="checkmark" size={15} color={C.white} /> : <Ionicons name={(icon || transactionIcon(entry)) as any} size={14} color={C.white} />}</View>
      <View style={s.entryMain}>
        <Text style={s.entryName} numberOfLines={1}>
          {entry.item}
        </Text>
        <Text style={s.entryMeta} numberOfLines={1}>
          {entryTime(entry.date)} · {entry.type === 'transfer' ? `From ${entry.account} → ${entry.toAccount || 'Unknown'}` : entry.subcategory}
        </Text>
      </View>
      <View style={s.entryRight}>
        <Text style={[s.entryAmount, { color }]}>
          {entry.type === 'income' ? '+' : entry.type === 'transfer' ? '⇄ ' : '− '}
          {money(entry.amount)}
        </Text>
        <Text style={s.entryAccount} numberOfLines={1}>
          {entry.account}
          {accountBalance != null ? ` · ${accountBalance < 0 ? '− ' : ''}${money(accountBalance)}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
});
function Field({ label, value, onChange, numeric }: any) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={numeric ? 'numeric' : 'default'} style={s.fieldInput} />
    </View>
  );
}

const LedgerSearch = memo(function LedgerSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (value !== draft) setDraft(value);
  }, [value]);
  const update = (next: string) => {
    setDraft(next);
    onChange(next);
  };
  return <TextInput value={draft} onChangeText={update} placeholder="Search item, category, account…" placeholderTextColor={C.muted} autoCorrect={false} autoCapitalize="none" returnKeyType="search" style={[s.search, { flex: 1 }]} />;
});

const LedgerFilterModal = memo(function LedgerFilterModal({
  visible,
  current,
  accounts,
  categories,
  subcategories,
  close,
  apply,
}: {
  visible: boolean;
  current: {
    types: RedCoinsType[];
    accounts: string[];
    categories: string[];
    subcategories: string[];
    day: string;
  };
  accounts: string[];
  categories: string[];
  subcategories: string[];
  close: () => void;
  apply: (next: { types: RedCoinsType[]; accounts: string[]; categories: string[]; subcategories: string[]; day: string }) => void;
}) {
  const [draft, setDraft] = useState(current);
  useEffect(() => {
    if (visible) setDraft(current);
  }, [visible]);
  const clear = () => setDraft({ types: [], accounts: [], categories: [], subcategories: [], day: '' });
  const toggle = (key: 'types' | 'accounts' | 'categories' | 'subcategories', value: string) => setDraft((row) => {
    const values = row[key] as string[];
    return { ...row, [key]: values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value] };
  });
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={s.sheetShade}>
        <View style={s.selectionSheet}>
          <View style={s.sheetGrab} />
          <View style={s.filterTitleRow}>
            <Text style={s.sheetTitle}>Filter transactions</Text>
            <TouchableOpacity onPress={clear}>
              <Text style={s.clearFilterText}>CLEAR ALL</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.filterListScroll} showsVerticalScrollIndicator={false}>
            {draft.day ? (
              <View style={s.filterGroup}>
                <Text style={s.inputLabel}>DATE</Text>
                <View style={[s.filterListRow, s.filterListRowActive]}>
                  <Ionicons name="calendar-outline" size={18} color={C.coral} />
                  <Text style={s.filterListText}>{draft.day}</Text>
                  <TouchableOpacity onPress={() => setDraft((value) => ({ ...value, day: '' }))} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={C.coral} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            <FilterList title="TYPE" values={['expense', 'income', 'transfer']} selected={draft.types} onSelect={(value) => toggle('types', value)} onAll={() => setDraft((row) => ({ ...row, types: [] }))} />
            <FilterList title="ACCOUNT" values={accounts} selected={draft.accounts} onSelect={(value) => toggle('accounts', value)} onAll={() => setDraft((row) => ({ ...row, accounts: [] }))} />
            <FilterList title="CATEGORY" values={categories} selected={draft.categories} onSelect={(value) => toggle('categories', value)} onAll={() => setDraft((row) => ({ ...row, categories: [] }))} />
            <FilterList title="SUBCATEGORY" values={subcategories} selected={draft.subcategories} onSelect={(value) => toggle('subcategories', value)} onAll={() => setDraft((row) => ({ ...row, subcategories: [] }))} />
          </ScrollView>
          <TouchableOpacity style={s.sheetSave} onPress={() => apply(draft)}>
            <Text style={s.sheetSaveText}>APPLY FILTERS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

function FilterList({ title, values, selected, onSelect, onAll }: { title: string; values: readonly string[]; selected: string[]; onSelect: (value: string) => void; onAll: () => void }) {
  const rows = ['all', ...values];
  return (
    <View style={s.filterGroup}>
      <Text style={s.inputLabel}>{title}</Text>
      <View style={s.filterListBox}>
        {rows.map((value, index) => {
          const active = value === 'all' ? selected.length === 0 : selected.includes(value);
          return (
            <TouchableOpacity key={value} style={[s.filterListRow, index < rows.length - 1 && s.filterListDivider, active && s.filterListRowActive]} onPress={() => value === 'all' ? onAll() : onSelect(value)} activeOpacity={0.7}>
              <Ionicons name={active ? 'checkbox' : 'square-outline'} size={19} color={active ? C.coral : C.muted} />
              <Text style={[s.filterListText, active && s.filterListTextActive]}>{value === 'all' ? `All ${title.toLowerCase()}` : value}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ReportPeriodModal({ visible, mode, salarySource, salarySources, customStart, customEnd, close, apply }: {
  visible: boolean;
  mode: ReportMode;
  salarySource: string;
  salarySources: SalarySource[];
  customStart: string;
  customEnd: string;
  close: () => void;
  apply: (value: { mode: ReportMode; salarySource: string; customStart: string; customEnd: string }) => void;
}) {
  const [draftMode, setDraftMode] = useState(mode);
  const [draftSource, setDraftSource] = useState(salarySource);
  const [draftStart, setDraftStart] = useState(customStart);
  const [draftEnd, setDraftEnd] = useState(customEnd);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  useEffect(() => {
    if (!visible) return;
    setDraftMode(mode);
    setDraftSource(salarySource || salarySources[0]?.key || '');
    setDraftStart(customStart);
    setDraftEnd(customEnd);
    setPicker(null);
  }, [visible]);
  const preset = (kind: 'month' | 'last-month' | 'quarter' | 'year') => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = now;
    if (kind === 'last-month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (kind === 'quarter') start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    else if (kind === 'year') start = new Date(now.getFullYear(), 0, 1);
    setDraftStart(dayKey(start.toISOString()));
    setDraftEnd(dayKey(end.toISOString()));
  };
  const submit = () => {
    if (draftMode === 'custom' && localDay(draftStart) > localDay(draftEnd)) return Alert.alert('Invalid reporting window', 'The start date must be before the end date.');
    if (draftMode === 'salary-cycle' && !draftSource) return Alert.alert('Salary anchor required', 'Log or import a salary income first, then choose it as the cycle anchor.');
    apply({ mode: draftMode, salarySource: draftSource, customStart: draftStart, customEnd: draftEnd });
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
    <Pressable style={s.sheetShade} onPress={close}>
      <Pressable style={[s.sheet, { maxHeight: '90%' }]} onPress={() => {}}>
        <View style={s.sheetGrab} />
        <Text style={s.eyebrow}>REPORTING WINDOW</Text>
        <Text style={s.sheetTitle}>Choose the story to tell.</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={[s.periodModeRow, draftMode === 'salary-cycle' && s.periodModeRowActive]} onPress={() => setDraftMode('salary-cycle')}>
            <Ionicons name={draftMode === 'salary-cycle' ? 'radio-button-on' : 'radio-button-off'} size={20} color={draftMode === 'salary-cycle' ? C.coral : C.muted} />
            <View style={{ flex: 1 }}><Text style={s.periodModeTitle}>Salary cycle</Text><Text style={s.periodModeMeta}>From one real salary credit to the next.</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={[s.periodModeRow, draftMode === 'custom' && s.periodModeRowActive]} onPress={() => setDraftMode('custom')}>
            <Ionicons name={draftMode === 'custom' ? 'radio-button-on' : 'radio-button-off'} size={20} color={draftMode === 'custom' ? C.coral : C.muted} />
            <View style={{ flex: 1 }}><Text style={s.periodModeTitle}>Custom range</Text><Text style={s.periodModeMeta}>Any inclusive start and end date.</Text></View>
          </TouchableOpacity>

          {draftMode === 'salary-cycle' ? <View style={s.periodSection}>
            <Text style={s.inputLabel}>SALARY ANCHOR</Text>
            {salarySources.map((source) => <TouchableOpacity key={source.key} style={[s.salarySourceRow, draftSource === source.key && s.salarySourceRowActive]} onPress={() => setDraftSource(source.key)}>
              <Ionicons name={draftSource === source.key ? 'checkmark-circle' : 'ellipse-outline'} size={19} color={draftSource === source.key ? '#168A65' : C.muted} />
              <View style={{ flex: 1 }}><Text style={s.salarySourceName}>{source.label}</Text><Text style={s.periodModeMeta}>{source.entries.length} income record{source.entries.length === 1 ? '' : 's'} · average {money(source.average)}</Text></View>
            </TouchableOpacity>)}
            {!salarySources.length && <Empty text="No income transaction is available as a salary anchor yet." />}
          </View> : <View style={s.periodSection}>
            <Text style={s.inputLabel}>QUICK RANGE</Text>
            <View style={s.periodPresetGrid}>
              <TouchableOpacity style={s.periodPreset} onPress={() => preset('month')}><Text style={s.periodPresetText}>THIS MONTH</Text></TouchableOpacity>
              <TouchableOpacity style={s.periodPreset} onPress={() => preset('last-month')}><Text style={s.periodPresetText}>LAST MONTH</Text></TouchableOpacity>
              <TouchableOpacity style={s.periodPreset} onPress={() => preset('quarter')}><Text style={s.periodPresetText}>THIS QUARTER</Text></TouchableOpacity>
              <TouchableOpacity style={s.periodPreset} onPress={() => preset('year')}><Text style={s.periodPresetText}>THIS YEAR</Text></TouchableOpacity>
            </View>
            <View style={s.periodDatesRow}>
              <TouchableOpacity style={s.periodDateButton} onPress={() => setPicker('start')}><Text style={s.inputLabel}>FROM</Text><Text style={s.periodDateValue}>{reportDate(localDay(draftStart))}</Text></TouchableOpacity>
              <Ionicons name="arrow-forward" size={17} color={C.muted} />
              <TouchableOpacity style={s.periodDateButton} onPress={() => setPicker('end')}><Text style={s.inputLabel}>TO</Text><Text style={s.periodDateValue}>{reportDate(localDay(draftEnd))}</Text></TouchableOpacity>
            </View>
            {picker && <DateTimePicker value={localDay(picker === 'start' ? draftStart : draftEnd)} mode="date" onChange={(_, value) => {
              setPicker(null);
              if (!value) return;
              const key = dayKey(value.toISOString());
              if (picker === 'start') setDraftStart(key); else setDraftEnd(key);
            }} />}
          </View>}
        </ScrollView>
        <TouchableOpacity style={s.sheetSave} onPress={submit}><Text style={s.sheetSaveText}>SHOW REPORT</Text></TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>;
}

function EntryModal(p: any) {
  const [picker, setPicker] = useState<'account' | 'destination' | 'category' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time' | null>(null);
  const [suggestionOpen, setSuggestionOpen] = useState(true);
  const amountRef = useRef<TextInput>(null);
  useEffect(() => {
    if (p.visible) setSuggestionOpen(true);
  }, [p.visible]);
  const cats = p.state.categories;
  const openPicker = (value: typeof picker) => {
    setPickerSearch('');
    setPicker(value);
  };
  const chooseTemplate = (entry: any) => {
    p.chooseSuggestion(entry);
    setSuggestionOpen(false);
    setTimeout(() => amountRef.current?.focus(), 60);
  };
  return (
    <Modal visible={p.visible} animationType="slide" onRequestClose={p.close}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHead}>
          <TouchableOpacity onPress={p.close}>
            <Ionicons name="arrow-back" size={24} color={C.ink} />
          </TouchableOpacity>
          <Text style={s.modalTitle}>{p.editing ? 'Edit entry' : 'New entry'}</Text>
          <Text style={s.plusOne}>{p.editing ? 'EDIT' : '+1'}</Text>
        </View>
        <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
          <View style={s.typeRow}>
            {(['expense', 'income', 'transfer'] as RedCoinsType[]).map((x) => (
              <TouchableOpacity
                key={x}
                onPress={() => p.applyEntryType(x)}
                style={[
                  s.typeButton,
                  p.type === x && {
                    backgroundColor: x === 'expense' ? C.coral : x === 'income' ? '#379B73' : C.blue,
                  },
                ]}
              >
                <Text style={[s.typeText, p.type === x && { color: C.white }]}>{x.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={s.itemInput}
            value={p.item}
            onChangeText={(value) => {
              p.setItem(value);
              setSuggestionOpen(true);
            }}
            onFocus={() => setSuggestionOpen(true)}
            onSubmitEditing={() => amountRef.current?.focus()}
            returnKeyType="next"
            autoFocus={!p.editing}
            selectTextOnFocus
            placeholder="Name"
            placeholderTextColor="#AAA393"
          />
          {suggestionOpen && p.item.trim().length > 0 && p.suggestions.length > 0 && (
            <View style={s.suggestions}>
              <Text style={s.templateLabel}>SMART MATCHES</Text>
              {p.suggestions.map((x: any) => (
                <TouchableOpacity key={x.id} onPress={() => chooseTemplate(x)} style={s.suggestion}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.suggestionName}>{x.item}</Text>
                    <Text style={s.suggestionMeta}>
                      {x.category} · {x.subcategory} · {x.account}
                      {x.usageCount > 1 ? ` · used ${x.usageCount}×` : ''}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={C.muted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity style={s.entryDateButton} onPress={() => setDatePickerMode('date')} activeOpacity={0.75}>
            <Ionicons name="time-outline" size={15} color={C.ink} />
            <Text style={s.entryDateButtonText}>
              {p.entryDate
                .toLocaleString('en-MY', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
                .toUpperCase()}
            </Text>
            <Ionicons name="calendar-outline" size={14} color={C.ink} />
          </TouchableOpacity>
          <View style={s.amountWrap}>
            <View
              style={[
                s.amountSign,
                {
                  backgroundColor: p.type === 'expense' ? C.coral : p.type === 'income' ? '#379B73' : C.blue,
                },
              ]}
            >
              <Text style={s.amountSignText}>{p.type === 'expense' ? '−' : p.type === 'income' ? '+' : '⇄'}</Text>
            </View>
            <TextInput ref={amountRef} style={s.amountBare} value={p.amount} onChangeText={p.setAmount} keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={p.saveEntry} selectTextOnFocus placeholder="0.00" placeholderTextColor="#AAA393" />
            <Text style={s.currency}>MYR</Text>
          </View>
          {p.type !== 'transfer' && <PickerRow icon={ICON_LIBRARY.includes(cats.find((c: any) => c.name === p.category)?.icon) ? cats.find((c: any) => c.name === p.category).icon : 'grid-outline'} label="CATEGORY" value={p.subcategory || p.category} onPress={() => openPicker('category')} />}
          <PickerRow icon="wallet-outline" label={p.type === 'transfer' ? 'FROM ACCOUNT' : 'ACCOUNT'} value={p.account || 'Choose account'} onPress={() => openPicker('account')} />
          {p.type === 'transfer' && <PickerRow icon="arrow-forward-circle-outline" label="TRANSFER TO" value={p.toAccount || 'Choose destination'} onPress={() => openPicker('destination')} />}
          <TouchableOpacity style={s.advancedButton} onPress={() => p.setAdvanced(!p.advanced)}>
            <Text style={s.advancedText}>Split · Status · Labels · Repeat</Text>
            <Ionicons name={p.advanced ? 'chevron-up' : 'chevron-down'} size={17} color={C.muted} />
          </TouchableOpacity>
          {p.advanced && (
            <View style={s.advancedBox}>
              <Field label="LABELS" value={p.labels} onChange={p.setLabels} />
              <Text style={s.inputLabel}>REPEAT</Text>
              <View style={s.typeRow}>
                {['none', 'weekly', 'monthly', 'installment'].map((x) => (
                  <TouchableOpacity key={x} onPress={() => p.setRepeat(x)} style={[s.repeatButton, p.repeat === x && s.repeatActive]}>
                    <Text style={s.repeatText}>{x}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {p.repeat === 'installment' && <Field label="NUMBER OF INSTALMENTS" value={p.installments} onChange={p.setInstallments} numeric />}
            </View>
          )}
          <TextInput style={s.noteInput} value={p.note} onChangeText={p.setNote} placeholder="Note" placeholderTextColor={C.muted} multiline />
        </ScrollView>
        <View style={s.entryFooter}>
          {p.editing && (
            <TouchableOpacity style={s.entryDelete} onPress={p.onDelete}>
              <Text style={s.entryDeleteText}>DELETE</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              s.entrySave,
              {
                flex: 1,
                backgroundColor: p.type === 'expense' ? C.coral : p.type === 'income' ? '#379B73' : C.blue,
              },
            ]}
            onPress={p.saveEntry}
          >
            <Ionicons name="save-outline" size={19} color="#FFF" />
            <Text style={s.entrySaveText}>{p.editing ? `UPDATE ${p.type.toUpperCase()}` : `SAVE ${p.type.toUpperCase()}`}</Text>
          </TouchableOpacity>
        </View>
        {datePickerMode && (
          <DateTimePicker
            value={p.entryDate}
            mode={datePickerMode}
            onChange={(_: any, selected?: Date) => {
              if (!selected) {
                setDatePickerMode(null);
                return;
              }
              const merged = new Date(p.entryDate);
              if (datePickerMode === 'date') {
                merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                p.setEntryDate(merged);
                setDatePickerMode('time');
              } else {
                merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                p.setEntryDate(merged);
                setDatePickerMode(null);
              }
            }}
          />
        )}
        <SelectionSheet visible={!!picker} close={() => setPicker(null)} search={pickerSearch} setSearch={setPickerSearch} title={picker === 'category' ? 'Choose category' : picker === 'destination' ? 'Transfer to' : 'Choose account'}>
          {picker === 'category'
            ? cats.map((group: any) => {
                const matches = group.subcategories.filter((sub: string) => `${group.name} ${sub}`.toLowerCase().includes(pickerSearch.toLowerCase()));
                return matches.length ? (
                  <View key={group.id}>
                    <Text style={s.pickerGroup}>{group.name}</Text>
                    <View style={s.categoryGrid}>
                      {matches.map((sub: string) => (
                        <TouchableOpacity
                          key={sub}
                          style={s.categoryChoice}
                          onPress={() => {
                            p.setCategory(group.name);
                            p.setSubcategory(sub);
                            setPicker(null);
                          }}
                        >
                          <View style={s.categoryIcon}>
                            {ICON_LIBRARY.includes(group.subcategoryIcons?.[sub] || group.icon) ? <Ionicons name={(group.subcategoryIcons?.[sub] || group.icon) as any} size={17} color={C.ink} /> : <Text>{group.subcategoryIcons?.[sub] || group.icon}</Text>}
                          </View>
                          <Text style={s.categoryChoiceText}>{sub}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null;
              })
            : p.state.accounts
                .filter((a: any) => a.name.toLowerCase().includes(pickerSearch.toLowerCase()) && (picker !== 'destination' || a.name !== p.account))
                .map((a: any) => (
                  <TouchableOpacity
                    key={a.id}
                    style={s.accountChoice}
                    onPress={() => {
                      picker === 'destination' ? p.setToAccount(a.name) : p.setAccount(a.name);
                      setPicker(null);
                    }}
                  >
                    <View>
                      <Text style={s.accountChoiceName}>{a.name}</Text>
                      <Text style={s.accountChoiceType}>{a.type}</Text>
                    </View>
                    <Text style={[s.accountChoiceBalance, a.balance < 0 && { color: C.coral }]}>
                      {a.balance < 0 ? '− ' : ''}
                      {money(a.balance)}
                    </Text>
                  </TouchableOpacity>
                ))}
        </SelectionSheet>
      </SafeAreaView>
    </Modal>
  );
}
function PickerRow({ icon, label, value, onPress }: any) {
  return (
    <TouchableOpacity style={s.pickerRow} onPress={onPress}>
      <View style={s.pickerRowIcon}>
        <Ionicons name={icon} size={19} color={C.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.pickerRowLabel}>{label}</Text>
        <Text style={s.pickerRowValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.muted} />
    </TouchableOpacity>
  );
}
function SelectionSheet({ visible, close, search, setSearch, title, children }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={s.keyboardSheetShade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={s.selectionSheet}>
          <View style={s.sheetGrab} />
          <View style={s.selectionTop}>
            <TextInput value={search} onChangeText={setSearch} placeholder={`Search ${title.toLowerCase()}…`} placeholderTextColor={C.muted} style={s.selectionSearch} />
            <TouchableOpacity style={s.selectionDone} onPress={close}>
              <Text style={s.selectionDoneText}>DONE</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag" contentContainerStyle={s.selectionResults}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
function Chip({ text, active, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && { color: C.white }]}>{text}</Text>
    </TouchableOpacity>
  );
}
function BudgetModal({ visible, target, value, setValue, allocated, total, current, close, save }: any) {
  const available = Math.max(0, total - allocated + current);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={s.keyboardSheetShade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <Pressable style={s.keyboardSheetFill} onPress={close}>
          <Pressable style={[s.sheet, s.keyboardScrollableSheet]} onPress={() => {}}>
          <View style={s.sheetGrab} />
          <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>SUBCATEGORY BUDGET</Text>
          <Text style={s.sheetTitle}>{target?.subcategory || 'Budget'}</Text>
          <Text style={s.budgetModalParent}>
            {target?.category} · up to {money(available)} available
          </Text>
          <View style={s.budgetAmountInput}>
            <Text style={s.budgetCurrency}>RM</Text>
            <TextInput value={value} onChangeText={setValue} autoFocus keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#A69F92" style={s.budgetAmountText} />
          </View>
          <View style={s.budgetModalSummary}>
            <Text style={s.budgetModalLabel}>CYCLE CEILING</Text>
            <Text style={s.budgetModalValue}>{money(total)}</Text>
            <Text style={s.budgetModalLabel}>ALLOCATED AFTER SAVE</Text>
            <Text style={s.budgetModalValue}>{money(allocated - current + Math.max(0, Number(value) || 0))}</Text>
          </View>
          <Text style={s.poolHint}>Enter 0 to remove this subcategory allocation.</Text>
          <TouchableOpacity style={s.sheetSave} onPress={save}>
            <Text style={s.sheetSaveText}>SAVE BUDGET</Text>
          </TouchableOpacity>
          </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
function ManageModal({ visible, mode, close, draft, save, editing }: any) {
  const [iconSearch, setIconSearch] = useState('');
  useEffect(() => {
    if (visible) setIconSearch('');
  }, [visible]);
  const visibleIcons = useMemo(() => {
    const query = iconSearch.trim().toLowerCase();
    return query ? ICON_LIBRARY.filter((icon) => icon.includes(query)) : ICON_LIBRARY;
  }, [iconSearch]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={s.keyboardSheetShade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <Pressable style={s.keyboardSheetFill} onPress={close}>
          <Pressable style={[s.sheet, s.keyboardScrollableSheet]} onPress={() => {}}>
          <View style={s.sheetGrab} />
          <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>{editing ? 'EDIT STRUCTURE' : mode === 'account' ? 'NEW ACCOUNT' : mode === 'category' ? 'NEW CATEGORY' : 'NEW SUBCATEGORY'}</Text>
          <Text style={s.sheetTitle}>{editing ? 'Keep your money map accurate' : mode === 'account' ? 'Add your money container' : mode === 'category' ? 'Name the spending' : `Add to ${draft.draftParent}`}</Text>
          {mode === 'account' ? (
            <>
              <Field label="ACCOUNT NAME" value={draft.draftName} onChange={draft.setDraftName} />
              <Text style={s.inputLabel}>TYPE</Text>
              <View style={s.typeRow}>
                {(['Bank', 'Cash', 'Credit card', 'Liability', 'Investment'] as RedCoinsAccountType[]).map((x) => (
                  <TouchableOpacity key={x} onPress={() => draft.setDraftType(x)} style={[s.repeatButton, draft.draftType === x && s.repeatActive]}>
                    <Text style={s.repeatText}>{x}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="OPENING BALANCE" value={draft.draftBalance} onChange={draft.setDraftBalance} numeric />
            </>
          ) : mode === 'category' ? (
            <>
              <Field label="CATEGORY" value={draft.draftCategory} onChange={draft.setDraftCategory} />
              {!editing && <Field label="FIRST SUBCATEGORY" value={draft.draftSub} onChange={draft.setDraftSub} />}
            </>
          ) : (
            <Field label="SUBCATEGORY" value={draft.draftSub} onChange={draft.setDraftSub} />
          )}
          <Text style={s.inputLabel}>ICON</Text>
          <View style={s.iconSearchWrap}>
            <Ionicons name="search" size={17} color={C.muted} />
            <TextInput
              value={iconSearch}
              onChangeText={setIconSearch}
              placeholder="Search icons — food, car, home…"
              placeholderTextColor={C.muted}
              autoCorrect={false}
              autoCapitalize="none"
              style={s.iconSearchInput}
            />
            {!!iconSearch && <TouchableOpacity onPress={() => setIconSearch('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={C.muted} /></TouchableOpacity>}
          </View>
          <ScrollView style={s.iconLibraryScroll} contentContainerStyle={s.iconLibrary} nestedScrollEnabled>
            {visibleIcons.map((icon) => <TouchableOpacity key={icon} accessibilityLabel={icon.replace(/-/g, ' ')} style={[s.iconChoice, draft.draftIcon === icon && s.iconChoiceActive]} onPress={() => draft.setDraftIcon(icon)}><Ionicons name={icon as any} size={19} color={draft.draftIcon === icon ? C.white : C.ink} /></TouchableOpacity>)}
            {!visibleIcons.length && <Text style={s.empty}>No matching standard icon.</Text>}
          </ScrollView>
          <TouchableOpacity style={s.sheetSave} onPress={save}>
            <Text style={s.sheetSaveText}>SAVE</Text>
          </TouchableOpacity>
          </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GuardModal({ visible, draft, setDraft, options, close, save, remove }: any) {
  const targets = draft.scope === 'account' ? options?.accounts || [] : draft.scope === 'category' ? options?.categories || [] : options?.subcategories || [];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}><KeyboardAvoidingView style={s.keyboardSheetShade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}><Pressable style={s.keyboardSheetFill} onPress={close}><Pressable style={[s.sheet, s.keyboardScrollableSheet]} onPress={() => {}}><View style={s.sheetGrab} /><ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
    <Text style={s.eyebrow}>{draft.id ? 'EDIT SPENDING GUARD' : 'NEW SPENDING GUARD'}</Text><Text style={s.sheetTitle}>Draw a clear boundary.</Text>
    <Field label="NAME" value={draft.name} onChange={(name: string) => setDraft((value: any) => ({ ...value, name }))} />
    <Text style={s.inputLabel}>WATCH</Text><View style={s.typeRow}>{(['account', 'category', 'subcategory'] as GuardScope[]).map((scope) => <TouchableOpacity key={scope} style={[s.repeatButton, draft.scope === scope && s.repeatActive]} onPress={() => setDraft((value: any) => ({ ...value, scope, target: (scope === 'account' ? options?.accounts : scope === 'category' ? options?.categories : options?.subcategories)?.[0] || '' }))}><Text style={s.repeatText}>{scope.toUpperCase()}</Text></TouchableOpacity>)}</View>
    <Text style={s.inputLabel}>TARGET</Text><ScrollView style={{maxHeight: 150}}>{targets.map((target: string) => <TouchableOpacity key={target} style={s.cashSelectRow} onPress={() => setDraft((value: any) => ({ ...value, target }))}><Ionicons name={draft.target === target ? 'radio-button-on' : 'radio-button-off'} size={17} color={draft.target === target ? C.coral : C.muted} /><Text style={s.cashSelectName}>{target}</Text></TouchableOpacity>)}</ScrollView>
    <Field label="LIMIT (RM)" value={draft.limit} onChange={(limit: string) => setDraft((value: any) => ({ ...value, limit }))} numeric />
    <TouchableOpacity style={s.sheetSave} onPress={save}><Text style={s.sheetSaveText}>SAVE GUARD</Text></TouchableOpacity>
    {remove && <TouchableOpacity style={s.guardDelete} onPress={remove}><Text style={s.guardDeleteText}>DELETE GUARD</Text></TouchableOpacity>}
  </ScrollView></Pressable></Pressable></KeyboardAvoidingView></Modal>;
}

function inferFinanceIcon(name: string, kind?: string) {
  const value = `${kind || ''} ${name}`.toLowerCase();
  return value.includes('credit') ? 'card' : value.includes('cash') ? 'wallet' : value.includes('invest') ? 'trending-up' : value.includes('engine') || value.includes('minyak') ? 'car-sport' : value.includes('dining') || value.includes('food') ? 'restaurant' : value.includes('house') || value.includes('grocery') ? 'home' : value.includes('people') ? 'people' : value.includes('utilit') ? 'flash' : value.includes('travel') ? 'airplane' : value.includes('employer') || value.includes('salary') ? 'briefcase' : value.includes('liabil') || value.includes('loan') ? 'document-text' : 'grid';
}
function FinanceAvatar({ name, kind, icon, round = false }: { name: string; kind?: string; icon?: string; round?: boolean }) {
  const palettes = [['#F4C7B8', '#7D2D2B'], ['#BFE0D4', '#185E50'], ['#C9D8F4', '#274E91'], ['#E8D3A8', '#72531B']];
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return <View style={[s.financeAvatar, round && s.financeAvatarRound, { backgroundColor: palettes[index][0] }]}><Ionicons name={(icon || inferFinanceIcon(name, kind)) as any} size={21} color={palettes[index][1]} /></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  loading: {
    flex: 1,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: C.paper, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5DCCA',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: C.coral,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  source: { color: C.muted, fontSize: 9, marginTop: 2 },
  headerAdd: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 16, paddingBottom: 105 },
  hero: { backgroundColor: C.ink, borderRadius: 27, padding: 22 },
  kicker: {
    color: C.mint,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  heroMoney: {
    color: C.paper,
    fontFamily: 'serif',
    fontSize: 43,
    fontWeight: '800',
    marginTop: 12,
  },
  heroSub: { color: '#93A0B2', fontSize: 10, marginTop: 4 },
  formula: { flexDirection: 'row', gap: 7, marginTop: 20 },
  mini: { flex: 1, backgroundColor: '#202B3E', borderRadius: 13, padding: 10 },
  miniValue: { color: C.paper, fontSize: 11, fontWeight: '900' },
  miniLabel: { color: '#8490A3', fontSize: 7, fontWeight: '900', marginTop: 3 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 24,
    marginBottom: 11,
  },
  eyebrow: {
    color: C.coral,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: C.ink,
    fontFamily: 'serif',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 3,
  },
  titleAction: {
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  titleActionText: { color: C.white, fontSize: 10, fontWeight: '900' },
  grid: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 17,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E8DFCF',
  },
  statLabel: { color: C.muted, fontSize: 8, fontWeight: '900' },
  statValue: {
    fontFamily: 'serif',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 7,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E7DECE',
    marginTop: 12,
  },
  cardTitle: {
    color: C.ink,
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  entry: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E5DDCF',
  },
  entrySelected: { backgroundColor: '#E3E2F7' },
  entryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  entryMain: { flex: 1, minWidth: 0 },
  entryRight: { width: 145, alignItems: 'flex-end', marginLeft: 6 },
  entryName: { color: C.ink, fontSize: 11, fontWeight: '900' },
  entryMeta: { color: C.muted, fontSize: 8, marginTop: 2 },
  entryAmount: { fontSize: 10, fontWeight: '900' },
  entryAccount: { color: C.muted, fontSize: 7, marginTop: 2, maxWidth: 145 },
  empty: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 16,
    paddingVertical: 14,
    textAlign: 'center',
  },
  search: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCD3C4',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: C.ink,
    fontSize: 10,
  },
  accountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  accountCard: {
    width: '48%',
    backgroundColor: C.white,
    borderRadius: 19,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E7DECE',
  },
  dark: { backgroundColor: C.ink },
  accountType: {
    color: C.muted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  accountName: {
    color: C.ink,
    fontFamily: 'serif',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 13,
  },
  accountBalance: {
    color: C.ink,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
  },
  accountGroup: { backgroundColor: C.white, borderRadius: 19, borderWidth: 1, borderColor: '#E7DECE', marginBottom: 12, overflow: 'hidden' },
  accountGroupHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.cream },
  accountGroupTitle: { color: C.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  accountGroupTotal: { color: C.ink, fontSize: 10, fontWeight: '900' },
  accountListRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 11 },
  accountListDivider: { borderBottomWidth: 1, borderBottomColor: '#E9E1D3' },
  accountListName: { color: C.ink, fontSize: 12, fontWeight: '900' },
  accountListMeta: { color: C.muted, fontSize: 8, marginTop: 3 },
  accountListBalance: { color: '#168A65', fontSize: 11, fontWeight: '900' },
  accountEdit: { padding: 7 },
  financeAvatar: { width: 43, height: 47, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, alignItems: 'center', justifyContent: 'center' },
  financeAvatarRound: { width: 43, height: 43, borderRadius: 22 },
  iconSearchWrap: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 10, borderRadius: 13, borderWidth: 1, borderColor: '#DED5C5', backgroundColor: C.white },
  iconSearchInput: { flex: 1, color: C.ink, fontSize: 12, fontWeight: '700', paddingVertical: 0 },
  iconLibraryScroll: { maxHeight: 150, marginBottom: 10 },
  iconLibrary: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  iconChoice: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cream },
  iconChoiceActive: { backgroundColor: C.ink },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 17,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E7DECE',
  },
  categoryName: { color: C.ink, fontSize: 13, fontWeight: '900' },
  categoryTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subcategoryManageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 27, borderBottomWidth: 1, borderBottomColor: '#F0EADD' },
  categorySubs: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  smallButton: { backgroundColor: C.ink, borderRadius: 9, padding: 8 },
  smallButtonText: { color: C.white, fontSize: 8, fontWeight: '900' },
  exportCard: { backgroundColor: C.ink, borderRadius: 23, padding: 18 },
  exportTitle: {
    color: C.paper,
    fontFamily: 'serif',
    fontSize: 23,
    fontWeight: '800',
  },
  exportCopy: {
    color: '#9CA7B7',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 15,
  },
  exportPrimary: {
    backgroundColor: C.coral,
    borderRadius: 13,
    padding: 13,
    alignItems: 'center',
  },
  exportPrimaryText: { color: C.white, fontSize: 10, fontWeight: '900' },
  exportSecondary: {
    backgroundColor: '#29364B',
    borderRadius: 13,
    padding: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  exportSecondaryText: { color: C.white, fontSize: 10, fontWeight: '900' },
  planHero: { backgroundColor: C.ink, borderRadius: 23, overflow: 'hidden' },
  planCell: { padding: 17, borderBottomWidth: 1, borderBottomColor: '#29364B' },
  planLabel: {
    color: C.mint,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  planValue: {
    color: C.paper,
    fontFamily: 'serif',
    fontSize: 23,
    fontWeight: '800',
    marginTop: 6,
  },
  field: { marginTop: 11 },
  fieldLabel: {
    color: C.muted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  fieldInput: {
    backgroundColor: C.paper,
    borderRadius: 11,
    padding: 11,
    color: C.ink,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#E4DBCB',
  },
  reportRow: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE6D8',
  },
  reportName: { color: C.ink, fontSize: 11, fontWeight: '900' },
  reportTrack: {
    height: 5,
    backgroundColor: C.cream,
    borderRadius: 5,
    marginVertical: 6,
  },
  reportFill: { height: 5, backgroundColor: C.coral, borderRadius: 5 },
  reportValue: {
    color: C.ink,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  reportPeriodCard: { backgroundColor: C.ink, borderRadius: 23, padding: 17, marginBottom: 12 },
  reportPeriodTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reportPeriodEyebrow: { color: C.mint, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  reportPeriodTitle: { color: C.paper, fontFamily: 'serif', fontSize: 20, fontWeight: '800', marginTop: 4, textTransform: 'capitalize' },
  reportPeriodDates: { color: '#AEB7C7', fontSize: 9, marginTop: 7 },
  reportChange: { borderWidth: 1, borderColor: '#536079', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  reportChangeText: { color: C.white, fontSize: 8, fontWeight: '900' },
  reportCycleNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#344057' },
  reportCycleNavText: { color: C.white, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  reportArrow: { width: 34, height: 30, borderRadius: 10, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  reportArrowDisabled: { opacity: 0.25 },
  reportFacts: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  reportFact: { flex: 1, backgroundColor: C.cream, borderRadius: 14, padding: 11 },
  reportFactLabel: { color: C.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  reportFactValue: { color: C.ink, fontSize: 12, fontWeight: '900', marginTop: 5 },
  reportSectionHint: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 3, marginBottom: 8 },
  reportCategoryBlock: { borderBottomWidth: 1, borderBottomColor: '#EAE2D4' },
  reportCategoryHead: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12 },
  reportCategoryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportRank: { color: C.coral, fontSize: 9, fontWeight: '900' },
  reportDrilldown: { backgroundColor: '#F6EFE2', borderRadius: 14, padding: 11, marginBottom: 11 },
  reportSubRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  reportSubName: { color: C.ink, fontSize: 10, fontWeight: '900' },
  reportSubAmount: { color: C.ink, fontSize: 9, fontWeight: '900' },
  reportCharge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E4DAC9' },
  reportChargeName: { color: C.ink, fontSize: 9, fontWeight: '800' },
  reportChargeMeta: { color: C.muted, fontSize: 8, marginTop: 2 },
  reportChargeAmount: { color: C.coral, fontSize: 9, fontWeight: '900' },
  reportAccountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEE6D8' },
  reportAccountNet: { fontSize: 10, fontWeight: '900' },
  periodModeRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#E3DACB', borderRadius: 14, padding: 12, marginTop: 8, backgroundColor: C.white },
  periodModeRowActive: { borderColor: C.coral, backgroundColor: '#FFF0EB' },
  periodModeTitle: { color: C.ink, fontSize: 11, fontWeight: '900' },
  periodModeMeta: { color: C.muted, fontSize: 8, marginTop: 3 },
  periodSection: { marginTop: 5 },
  salarySourceRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderBottomWidth: 1, borderBottomColor: '#E9E0D2' },
  salarySourceRowActive: { backgroundColor: '#E6F6EF', borderRadius: 12 },
  salarySourceName: { color: C.ink, fontSize: 10, fontWeight: '900' },
  periodPresetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  periodPreset: { width: '48%', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 11, backgroundColor: C.cream, alignItems: 'center' },
  periodPresetText: { color: C.ink, fontSize: 8, fontWeight: '900' },
  periodDatesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  periodDateButton: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: '#E3DACB', borderRadius: 13, padding: 11 },
  periodDateValue: { color: C.ink, fontSize: 10, fontWeight: '900' },
  nav: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 8,
    flexDirection: 'row',
    backgroundColor: C.ink,
    borderRadius: 20,
    padding: 7,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 13,
  },
  navActive: { backgroundColor: '#303650' },
  navText: { color: '#8993A6', fontSize: 7, fontWeight: '800', marginTop: 3 },
  modal: { flex: 1, backgroundColor: C.paper },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DDCD',
  },
  modalTitle: {
    color: C.ink,
    fontFamily: 'serif',
    fontSize: 20,
    fontWeight: '800',
  },
  saveText: { color: C.coral, fontSize: 11, fontWeight: '900' },
  modalBody: { padding: 18, paddingBottom: 50 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeButton: {
    flex: 1,
    padding: 10,
    borderRadius: 11,
    alignItems: 'center',
    backgroundColor: C.cream,
  },
  typeActive: { backgroundColor: C.ink },
  typeText: { color: C.muted, fontSize: 9, fontWeight: '900' },
  itemInput: {
    color: C.ink,
    fontFamily: 'serif',
    fontSize: 26,
    fontWeight: '800',
    borderBottomWidth: 2,
    borderBottomColor: C.ink,
    marginTop: 20,
    paddingVertical: 10,
  },
  suggestions: {
    backgroundColor: C.white,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E4DBCB',
  },
  suggestion: {
    padding: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE6D8',
  },
  suggestionName: { color: C.ink, fontSize: 11, fontWeight: '900' },
  suggestionMeta: { color: C.muted, fontSize: 8, marginTop: 2 },
  amountInput: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4DBCB',
    marginTop: 15,
    padding: 14,
    fontSize: 27,
    fontWeight: '800',
    color: C.ink,
  },
  inputLabel: {
    color: C.muted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 7,
  },
  chip: {
    backgroundColor: C.cream,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginRight: 7,
  },
  chipActive: { backgroundColor: C.ink },
  chipText: { color: C.ink, fontSize: 9, fontWeight: '800' },
  advancedButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    padding: 13,
    backgroundColor: C.cream,
    borderRadius: 13,
  },
  advancedText: { color: C.ink, fontSize: 9, fontWeight: '900' },
  advancedBox: {
    backgroundColor: C.cream,
    borderRadius: 14,
    padding: 12,
    marginTop: 7,
  },
  repeatButton: { backgroundColor: C.paper, borderRadius: 9, padding: 8 },
  repeatActive: { backgroundColor: C.mint },
  repeatText: { color: C.ink, fontSize: 8, fontWeight: '900' },
  noteInput: {
    minHeight: 80,
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 12,
    color: C.ink,
    marginTop: 15,
    textAlignVertical: 'top',
  },
  sheetShade: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6,10,18,.72)',
  },
  keyboardSheetShade: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6,10,18,.72)',
  },
  keyboardSheetFill: { flex: 1, justifyContent: 'flex-end' },
  keyboardScrollableSheet: { maxHeight: '92%' },
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
    padding: 20,
    paddingBottom: 32,
  },
  sheetGrab: {
    width: 45,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#C4BAAA',
    alignSelf: 'center',
    marginBottom: 17,
  },
  sheetTitle: {
    color: C.ink,
    fontFamily: 'serif',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 5,
  },
  sheetSave: {
    backgroundColor: C.coral,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 17,
  },
  sheetSaveText: { color: C.white, fontSize: 11, fontWeight: '900' },
  templateLabel: {
    color: C.coral,
    backgroundColor: '#F4EDDE',
    paddingHorizontal: 11,
    paddingVertical: 7,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  plusOne: {
    color: C.ink,
    fontSize: 15,
    fontWeight: '900',
    backgroundColor: C.cream,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
  },
  entryDate: { color: C.muted, fontSize: 10, marginTop: 12, marginBottom: 10 },
  entryDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#DDD4C5',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 13,
  },
  entryDateButtonText: {
    flex: 1,
    color: C.ink,
    fontSize: 9,
    fontWeight: '900',
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#E4DBCB',
    borderRadius: 17,
    overflow: 'hidden',
  },
  amountSign: {
    width: 53,
    height: 61,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountSignText: { color: C.white, fontSize: 25, fontWeight: '900' },
  amountBare: {
    flex: 1,
    color: C.ink,
    fontSize: 27,
    fontWeight: '800',
    paddingHorizontal: 14,
  },
  currency: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '900',
    paddingRight: 15,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#E7DECE',
  },
  pickerRowIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRowLabel: {
    color: C.muted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pickerRowValue: {
    color: C.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  entryFooter: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4DBCB',
    backgroundColor: C.paper,
  },
  entryDelete: {
    borderWidth: 1,
    borderColor: C.coral,
    borderRadius: 15,
    paddingHorizontal: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryDeleteText: { color: C.coral, fontSize: 9, fontWeight: '900' },
  entrySave: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entrySaveText: { color: C.white, fontSize: 11, fontWeight: '900' },
  selectionSheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '84%',
    padding: 18,
    paddingBottom: 30,
  },
  selectionResults: { paddingBottom: 12 },
  filterListScroll: { maxHeight: 500, marginBottom: 12 },
  filterGroup: { marginBottom: 5 },
  filterListBox: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DDD4C5',
    borderRadius: 15,
    backgroundColor: C.white,
  },
  filterListRow: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  filterListDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5DDCF' },
  filterListRowActive: { backgroundColor: '#FFF0EB' },
  filterListText: { flex: 1, color: C.ink, fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  filterListTextActive: { color: C.coral },
  selectionTop: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  selectionSearch: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#D8CEBD',
    borderRadius: 14,
    paddingHorizontal: 13,
    color: C.ink,
  },
  selectionDone: {
    backgroundColor: C.ink,
    borderRadius: 13,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  selectionDoneText: { color: C.white, fontSize: 9, fontWeight: '900' },
  pickerGroup: {
    color: C.muted,
    fontFamily: 'serif',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 15,
    marginBottom: 8,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  categoryChoice: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 3,
  },
  categoryIcon: {
    width: 47,
    height: 47,
    borderRadius: 24,
    backgroundColor: C.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChoiceText: {
    color: C.ink,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
  },
  accountChoice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#E4DBCB',
  },
  accountChoiceName: { color: C.ink, fontSize: 13, fontWeight: '900' },
  accountChoiceType: { color: C.muted, fontSize: 9, marginTop: 3 },
  accountChoiceBalance: { color: '#379B73', fontSize: 12, fontWeight: '900' },
  suggestionPrice: { color: C.ink, fontSize: 10, fontWeight: '900' },
  activityBody: { flex: 1 },
  activityHeader: { paddingHorizontal: 10, paddingTop: 9 },
  ledgerCard: {
    flex: 1,
    marginTop: 7,
    marginHorizontal: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DED5C5',
    borderRadius: 15,
    backgroundColor: C.white,
  },
  ledgerContent: { paddingBottom: 86 },
  emptyLedger: { flexGrow: 1, justifyContent: 'center' },
  ledgerDate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 25,
    paddingHorizontal: 10,
    backgroundColor: '#EEE8D8',
    borderBottomWidth: 1,
    borderBottomColor: '#E2D9C8',
  },
  ledgerDateText: {
    color: '#555B70',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  ledgerDayTotal: { color: C.ink, fontSize: 8, fontWeight: '900' },
  selectedTotal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  selectedTotalText: { color: C.ink, fontSize: 18, fontWeight: '900' },
  selectedTotalMeta: { color: C.muted, fontSize: 8, fontWeight: '800' },
  ledgerTools: { flexDirection: 'row', gap: 7 },
  filterButton: {
    width: 43,
    borderRadius: 12,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.ink,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 6,
  },
  selectionCount: { flex: 1, color: C.white, fontSize: 9, fontWeight: '900' },
  selectionLink: { color: C.mint, fontSize: 7, fontWeight: '900' },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearFilterText: { color: C.coral, fontSize: 8, fontWeight: '900' },
  activeDayFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFE4DC',
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 7,
  },
  activeDayFilterText: { color: C.coral, fontSize: 8, fontWeight: '900' },
  dashboardIntro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  dashboardTitle: {
    color: C.ink,
    fontFamily: 'serif',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 3,
  },
  dashboardDate: { color: C.muted, fontSize: 10, fontWeight: '800' },
  dashCard: {
    backgroundColor: 'rgba(255,255,255,.78)',
    borderWidth: 1,
    borderColor: '#E7DECE',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  dashHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dashHead: { color: C.ink, fontSize: 14, fontWeight: '900' },
  weekBars: {
    height: 145,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#DED6C8',
    paddingHorizontal: 2,
  },
  weekDay: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  weekAmount: { color: C.ink, fontSize: 7, fontWeight: '800' },
  weekBar: {
    width: '58%',
    backgroundColor: C.coral,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  weekLabel: {
    color: C.muted,
    fontSize: 8,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  summaryMuted: { color: C.muted, fontSize: 9, fontWeight: '800' },
  summaryExpense: { color: C.coral, fontSize: 9, fontWeight: '900' },
  calendarHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  calendarArrow: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarWeek: {
    width: '14.285%',
    textAlign: 'center',
    color: C.muted,
    fontSize: 8,
    fontWeight: '900',
    paddingVertical: 5,
  },
  calendarDay: {
    width: '14.285%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  calendarToday: { backgroundColor: C.cream },
  calendarNumber: { color: C.ink, fontSize: 10, fontWeight: '800' },
  calendarDots: { height: 5, flexDirection: 'row', gap: 2, marginTop: 2 },
  calendarDot: { width: 4, height: 4, borderRadius: 2 },
  calendarKey: { flexDirection: 'row', gap: 12, marginTop: 10 },
  calendarKeyText: { color: C.coral, fontSize: 7, fontWeight: '800' },
  budgetSummary: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  donutWrap: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutValue: { color: C.ink, fontSize: 10, fontWeight: '900' },
  donutLabel: { color: C.muted, fontSize: 6, fontWeight: '900', marginTop: 2 },
  budgetRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: C.coral,
    padding: 22,
  },
  budgetRingInner: {
    flex: 1,
    borderRadius: 40,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetPct: { color: C.ink, fontSize: 15, fontWeight: '900' },
  budgetSmall: { color: C.muted, fontSize: 7 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
    minHeight: 17,
  },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  legendName: { flex: 1, color: C.ink, fontSize: 9, fontWeight: '800' },
  legendValue: { color: C.ink, fontSize: 8, fontWeight: '900' },
  budgetTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#DED6C8',
    overflow: 'hidden',
    marginTop: 12,
  },
  budgetFill: { height: 7, borderRadius: 4, backgroundColor: C.coral },
  favoriteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#E7DECE',
  },
  favoriteName: { color: C.ink, fontSize: 11, fontWeight: '800' },
  favoriteBalance: { color: '#168A65', fontSize: 11, fontWeight: '900' },
  favoriteTotal: {
    color: '#168A65',
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 11,
  },
  balanceSheetButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D8CEBD',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginTop: 9,
  },
  balanceSheetText: { color: C.ink, fontSize: 8, fontWeight: '900' },
  cashflowChart: {
    height: 145,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#DED6C8',
  },
  cashMonth: { flex: 1, alignItems: 'center' },
  cashBars: {
    height: 116,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  cashBar: { width: 28, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  realityLabel: { color: C.mint, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 8 },
  realityNumber: {
    color: C.ink,
    fontFamily: 'serif',
    fontSize: 37,
    fontWeight: '800',
    marginVertical: 14,
  },
  commitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E7DECE',
  },
  ruleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  guardList: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: '#E7DECE', overflow: 'hidden' },
  guardCardRow: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#E9E1D3' },
  guardRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 11 },
  guardDot: { width: 9, height: 9, borderRadius: 5 },
  guardLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guardName: { color: C.ink, fontSize: 11, fontWeight: '900' },
  guardPercent: { color: C.ink, fontSize: 10, fontWeight: '900' },
  guardMeta: { color: C.muted, fontSize: 8, marginTop: 2, marginBottom: 6 },
  cashSelectRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: '#E9E1D3' },
  cashSelectName: { flex: 1, color: C.ink, fontSize: 10, fontWeight: '800' },
  cashSelectAmount: { color: C.ink, fontSize: 10, fontWeight: '900' },
  fixedPickerCard: { backgroundColor: C.white, borderRadius: 18, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E7DECE', marginBottom: 12 },
  guardDelete: { alignItems: 'center', padding: 13, marginTop: 7 },
  guardDeleteText: { color: C.coral, fontSize: 9, fontWeight: '900' },
  planInlineSave: { alignSelf: 'flex-end', backgroundColor: C.cream, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  planInlineSaveText: { color: C.ink, fontSize: 8, fontWeight: '900' },
  guardDetails: { width: '100%', paddingHorizontal: 14, paddingTop: 9, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#E9E1D3' },
  guardDetailsTitle: { color: C.coral, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 7, marginBottom: 5 },
  guardDetailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F0EADD' },
  guardChargeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingLeft: 16, borderBottomWidth: 1, borderBottomColor: '#F0EADD', backgroundColor: '#FBF6EB' },
  guardDetailName: { color: C.ink, fontSize: 9, fontWeight: '800', flex: 1 },
  guardDetailAmount: { color: C.ink, fontSize: 9, fontWeight: '900' },
  ruleCard: {
    width: '48%',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#E7DECE',
    borderRadius: 18,
    padding: 13,
  },
  ruleName: { color: C.ink, fontSize: 12, fontWeight: '900', marginTop: 6 },
  rulePct: {
    color: C.coral,
    fontFamily: 'serif',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 12,
  },
  budgetPoolRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  poolHint: { color: C.muted, fontSize: 8, lineHeight: 13, marginTop: 9 },
  cycleBudgetEdit: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  cycleSave: {
    backgroundColor: C.ink,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 13,
    marginBottom: 1,
  },
  cycleSaveText: { color: C.white, fontSize: 8, fontWeight: '900' },
  budgetCategoryCard: {
    backgroundColor: C.white,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E7DECE',
    overflow: 'hidden',
    marginBottom: 9,
  },
  budgetCategoryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    backgroundColor: '#F4EDDE',
  },
  budgetCategoryName: { color: C.ink, fontSize: 13, fontWeight: '900' },
  budgetCategoryMeta: { color: C.muted, fontSize: 8, marginTop: 3 },
  budgetCategoryTotal: { alignItems: 'flex-end', marginLeft: 8 },
  categoryBudgetProgress: { paddingHorizontal: 13, paddingBottom: 11 },
  categoryBudgetProgressText: { color: C.muted, fontSize: 7, fontWeight: '800', marginTop: 5 },
  budgetCategoryAmount: { color: C.ink, fontSize: 13, fontWeight: '900' },
  budgetCategoryLabel: {
    color: C.muted,
    fontSize: 6,
    fontWeight: '900',
    marginTop: 2,
  },
  subBudgetRow: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E9E1D4',
  },
  subBudgetTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  subBudgetName: { color: C.ink, fontSize: 10, fontWeight: '900' },
  subBudgetSpent: { color: C.muted, fontSize: 7, marginTop: 2 },
  subBudgetLimit: { color: C.blue, fontSize: 9, fontWeight: '900' },
  subBudgetTrack: {
    height: 4,
    borderRadius: 3,
    backgroundColor: C.cream,
    overflow: 'hidden',
    marginTop: 7,
  },
  subBudgetFill: { height: 4, borderRadius: 3 },
  budgetModalParent: { color: C.muted, fontSize: 10, marginBottom: 14 },
  budgetAmountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#DED5C5',
    borderRadius: 16,
    overflow: 'hidden',
  },
  budgetCurrency: {
    backgroundColor: C.blue,
    color: C.white,
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 15,
    paddingVertical: 17,
  },
  budgetAmountText: {
    flex: 1,
    color: C.ink,
    fontSize: 24,
    fontWeight: '900',
    paddingHorizontal: 13,
  },
  budgetModalSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 7,
    marginTop: 14,
    backgroundColor: C.cream,
    borderRadius: 13,
    padding: 12,
  },
  budgetModalLabel: {
    width: '55%',
    color: C.muted,
    fontSize: 7,
    fontWeight: '900',
  },
  budgetModalValue: {
    width: '42%',
    color: C.ink,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  detectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#E7DECE',
    borderRadius: 17,
    padding: 12,
    marginBottom: 5,
  },
  detectorIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectorTitle: { color: C.ink, fontSize: 11, fontWeight: '900' },
  detectorCopy: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 2 },
  detectorButton: {
    backgroundColor: C.mint,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  detectorButtonText: { color: C.ink, fontSize: 7, fontWeight: '900' },
  detectorPrivacy: {
    color: C.muted,
    fontSize: 7,
    lineHeight: 11,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  detectorInbox: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#E7DECE',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 13,
  },
  detectorInboxHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F4EDDE',
  },
  detectorInboxTitle: {
    color: C.ink,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },
  detectorTest: {
    backgroundColor: C.ink,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  detectorTestText: { color: C.white, fontSize: 7, fontWeight: '900' },
  detectorEmpty: { color: C.muted, fontSize: 8, lineHeight: 13, padding: 13 },
  detectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAE2D5',
  },
  detectionAmount: {
    minWidth: 63,
    backgroundColor: '#FFE4DC',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 7,
    alignItems: 'center',
  },
  detectionAmountText: { color: C.coral, fontSize: 8, fontWeight: '900' },
  detectionMerchant: { color: C.ink, fontSize: 10, fontWeight: '900' },
  detectionMeta: { color: C.muted, fontSize: 6, marginTop: 3 },
  detectionReview: {
    backgroundColor: C.mint,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  detectionReviewText: { color: C.ink, fontSize: 6, fontWeight: '900' },
  expectedCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7DECE',
    overflow: 'hidden',
  },
  expectedHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.ink,
    padding: 16,
  },
  expectedEyebrow: {
    color: C.mint,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  expectedTotal: {
    color: C.paper,
    fontFamily: 'serif',
    fontSize: 27,
    fontWeight: '800',
    marginTop: 4,
  },
  expectedRight: { alignItems: 'flex-end' },
  expectedRemaining: { color: '#FF8069', fontSize: 14, fontWeight: '900' },
  expectedRemainingLabel: {
    color: '#8E99A9',
    fontSize: 6,
    fontWeight: '900',
    marginTop: 3,
  },
  expectedStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: '#F4EDDE',
  },
  expectedStat: { color: C.muted, fontSize: 7, fontWeight: '800' },
  expectedStatStrong: { color: C.ink },
  expectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAE2D5',
  },
  expectedStatus: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#FFE6DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expectedStatusPaid: { backgroundColor: '#DDF1E7' },
  expectedName: { color: C.ink, fontSize: 10, fontWeight: '900' },
  expectedMeta: { color: C.muted, fontSize: 7, marginTop: 2 },
  expectedAmounts: { alignItems: 'flex-end', marginLeft: 5 },
  expectedAmount: { color: C.ink, fontSize: 10, fontWeight: '900' },
  expectedState: {
    color: C.coral,
    fontSize: 6,
    fontWeight: '900',
    marginTop: 3,
  },
  confirmImport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: C.mint,
    borderRadius: 13,
    padding: 13,
    marginTop: 8,
  },
  confirmImportText: { color: C.ink, fontSize: 9, fontWeight: '900' },
  exportStatus: { color: C.gold, fontSize: 8, fontWeight: '900' },
});
