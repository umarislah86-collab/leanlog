import { ThemeText as Text, ThemeTextInput as TextInput } from '../components/ThemePrimitives';
import { useTheme, useThemeStyles } from '../context/ThemeContext';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, BackHandler, InteractionManager, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { RedCoinsSetup } from '../components/RedCoinsSetup';
import { needsRedCoinsSetup } from '../services/redcoinsOnboarding';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import BluecoinsDriveReader from 'bluecoins-drive-reader';
import type { TransactionDetection } from 'bluecoins-drive-reader';
import { setBluecoinsFixedCommitments, setBluecoinsMonthlyBudget, setBluecoinsPayday, setCashRealityAccounts, setCashRealitySafetyBuffer, type BluecoinsSummary } from '../services/bluecoins';
import { applyEntryBalance, confirmRedCoinsExport, createRedCoinsDeletion, exportRedCoinsBackup, exportRedCoinsCsv, getRedCoinsSummary, loadRedCoins, saveRedCoins, type RedCoinsAccountType, type RedCoinsEntry, type RedCoinsReminder, type RedCoinsReminderEndType, type RedCoinsState, type RedCoinsType, type RedCoinsWeekendMove } from '../services/redcoins';
import { aggregateCycleSpending } from '../services/redcoinsBudget';
import { RedCoinsBudgetEditor, type BudgetChoice } from '../components/RedCoinsBudgetEditor';
import { periodAllocation, replaceTargetBudget, targetBudgetChoices } from '../services/redcoinsBudgetSetup';
import { termBudgetSummary, validTermBudget } from '../services/redcoinsTermBudget';
import { favoriteAccountsForHome } from '../services/redcoinsFavorites';
import { HOME_LAYOUT_KEY, homeCardIds, normalizeHomeOrder, type HomeCardId } from '../services/redcoinsHomeLayout';
import { applyHomeAppearance, homeColours } from '../services/redcoinsHomeAppearance';
import { RedCoinsHomeLayoutModal } from '../components/RedCoinsHomeLayoutModal';
import { loggerCategories, loggerSuggestions } from '../services/redcoinsLogger';
import { findIncomeDuplicates, incomeMonth, validIncomePeriod } from '../services/redcoinsIncomeDuplicate';
import { filterLedgerEntries, summarizeLedgerEntries } from '../services/redcoinsLedgerSummary';
import { SALARY_FILTER_SOURCE_KEY, salaryFilterSources, visibleSalarySources, preferredSalarySource, salaryFilterCycle, salaryCycleOffset, ledgerMonthPeriod, type SalaryFilterSource } from '../services/redcoinsSalaryFilter';
import { applyRedCoinsBatch, copyRedCoinsEntries, pasteRedCoinsEntries, readRedCoinsClipboard, type BatchAction } from '../services/redcoinsBatch';
import { RedCoinsBatchModal } from '../components/RedCoinsBatchModal';
import { RedCoinsLedgerList } from '../components/RedCoinsLedgerList';
import { RedCoinsAiPromptModal } from '../components/RedCoinsAiPromptModal';
import { RedCoinsAnalysis } from '../components/RedCoinsAnalysis';
import { RedCoinsBankReviewModal } from '../components/RedCoinsBankReviewModal';
import { migrateAccountPreferences } from '../services/redcoinsAccountIdentity';
import { subscribeRedCoinsChanges } from '../services/redcoinsEvents';
import { afterRedCoinsPaint } from '../services/redcoinsSavePaint';
import { advanceReminderDate, materializeAutomaticReminders, missingReminderAccounts, nextReminderOccurrence, pendingReminderOccurrence, logReminderOccurrenceNow, requestReminderAccess, syncReminderNotifications } from '../services/redcoinsReminders';
import { projectRedCoinsReminders } from '../services/redcoinsReminderProjection';
import { deleteRedCoinsLedgerEntry, syncRedCoinsLedger, upsertRedCoinsLedgerEntry } from '../services/redcoinsLedger';
import { saveSpendingGuards, type GuardScope, type SpendingGuard } from '../services/spendingGuards';
import { refreshLeanLogWidget } from '../services/widget';
import { RedCoinsReceipts } from '../components/RedCoinsReceipts';
import type { RedCoinsReceipt } from '../services/receiptFiles';
import { discardReceiptDrafts, savedReceiptFolder, saveReceiptToFolder } from '../services/redcoinsReceipts';

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
type FilterDateMode = 'all' | 'single' | 'range' | 'cycle' | 'month';
type SalarySource = { key: string; label: string; entries: RedCoinsEntry[]; average: number };
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
  const isFocused = useIsFocused();
  const themedStyles = useThemeStyles(baseS);
  const { themed, palette: appPalette } = useTheme();
  const s = useMemo(() => applyHomeAppearance(themedStyles, appPalette), [themedStyles, appPalette]);
  const homeColor = homeColours(appPalette);
  const [homeOrder, setHomeOrder] = useState<HomeCardId[]>([...homeCardIds]);
  const [homeLayoutOpen, setHomeLayoutOpen] = useState(false);
  const [homeLayoutReady, setHomeLayoutReady] = useState(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(HOME_LAYOUT_KEY).then(raw => { if (active && raw) setHomeOrder(normalizeHomeOrder(JSON.parse(raw))); }).catch(console.warn).finally(() => { if (active) setHomeLayoutReady(true); });
    return () => { active = false; };
  }, []);
  const [state, setState] = useState<RedCoinsState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [bluecoins, setBluecoins] = useState<BluecoinsSummary | null>(null);
  const summaryRequest = useRef(0);
  const [section, setSection] = useState<Section>('home');
  const sectionHistory = useRef<Section[]>([]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [schedulingOnly, setSchedulingOnly] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(new Date());
  const [manageOpen, setManageOpen] = useState<'account' | 'category' | 'sub' | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [bankReviewAccountId, setBankReviewAccountId] = useState<string | null>(null);
  const [ledgerSummaryScope, setLedgerSummaryScope] = useState<'filtered' | 'selected' | null>(null);
  const [filterTypes, setFilterTypes] = useState<RedCoinsType[]>([]);
  const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterSubcategories, setFilterSubcategories] = useState<string[]>([]);
  const [filterDateMode, setFilterDateMode] = useState<FilterDateMode>('all');
  const [filterStartDay, setFilterStartDay] = useState('');
  const [filterEndDay, setFilterEndDay] = useState('');
  const [filterDateLabel, setFilterDateLabel] = useState('');
  const [reportLedgerWindow, setReportLedgerWindow] = useState<{ start: number; endExclusive: number; actualThrough: number } | null>(null);
  const [filterSalaryKey, setFilterSalaryKey] = useState('');
  const salarySelectionTouched = useRef(false);
  useEffect(() => {
    void AsyncStorage.getItem(SALARY_FILTER_SOURCE_KEY).then(key => {
      if (!salarySelectionTouched.current) setFilterSalaryKey(key || '');
    }).catch(console.warn);
  }, []);
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [collapsedCards, setCollapsedCards] = useState<string[]>([]);
  const [expandedBudgetCategories, setExpandedBudgetCategories] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState<'selection' | 'paste' | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const batchLock = useRef(false);
  const [copiedEntries, setCopiedEntries] = useState<RedCoinsEntry[]>([]);
  const [ledgerRevision, setLedgerRevision] = useState(0);
  const ledgerQueryId = useRef(0);
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<RedCoinsType>('expense');
  const [incomePeriod, setIncomePeriod] = useState('');
  const entrySaveLock = useRef(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const localWriteSource = useRef({});
  const [account, setAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [note, setNote] = useState('');
  const [receiptDrafts, setReceiptDrafts] = useState<RedCoinsReceipt[]>([]);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [labels, setLabels] = useState('');
  const [repeat, setRepeat] = useState<RedCoinsEntry['repeat']>('none');
  const [installments, setInstallments] = useState('');
  const [repeatEvery, setRepeatEvery] = useState('1');
  const [reminderEndType, setReminderEndType] = useState<RedCoinsReminderEndType>('never');
  const [reminderEndDate, setReminderEndDate] = useState('');
  const [reminderOccurrences, setReminderOccurrences] = useState('12');
  const [automaticLog, setAutomaticLog] = useState(true);
  const [excludeWeekend, setExcludeWeekend] = useState(false);
  const [weekendMove, setWeekendMove] = useState<RedCoinsWeekendMove>('after');
  const [advanced, setAdvanced] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<RedCoinsAccountType>('Bank');
  const [draftBalance, setDraftBalance] = useState('0');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftCategoryTypes, setDraftCategoryTypes] = useState<Array<'income' | 'expense'>>(['expense']);
  const [exactAlarmsAllowed, setExactAlarmsAllowed] = useState(false);
  const [reminderNotificationsAllowed, setReminderNotificationsAllowed] = useState(false);
  const [draftSub, setDraftSub] = useState('');
  const [draftParent, setDraftParent] = useState('');
  const [draftIcon, setDraftIcon] = useState('wallet');
  const [budgetEditor, setBudgetEditor] = useState<{
    category: string;
    subcategory: string;
  } | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [planPage, setPlanPage] = useState<'overview' | 'budgets' | 'guards' | 'automation'>('overview');
  const [cycleBudgetDraft, setCycleBudgetDraft] = useState('');
  const [paydayDraft, setPaydayDraft] = useState('25');
  const [safetyBufferDraft, setSafetyBufferDraft] = useState('0');
  const [notificationAccess, setNotificationAccess] = useState(false);
  const [detections, setDetections] = useState<TransactionDetection[]>([]);
  const [reviewingDetectionId, setReviewingDetectionId] = useState<string | null>(null);
  const [fixedPickerOpen, setFixedPickerOpen] = useState(false);
  const [reminderManagerOpen, setReminderManagerOpen] = useState(false);
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
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const reminderCards = useMemo(() => state && reminderManagerOpen ? projectRedCoinsReminders(state) : [], [state, reminderManagerOpen]);

  const navigateSection = useCallback((next: Section) => {
    if (next === 'accounts') setCategoriesOpen(false);
    if (next === 'plan') setPlanPage('overview');
    if (section === next) return;
    sectionHistory.current.push(section);
    setSection(next);
  }, [section]);
  const goBackInsideRedCoins = useCallback(() => {
    if (section === 'accounts' && categoriesOpen) { setCategoriesOpen(false); return true; }
    if (section === 'plan' && planPage !== 'overview') { setPlanPage('overview'); return true; }
    const previous = sectionHistory.current.pop();
    if (previous) {
      setSection(previous);
      return true;
    }
    navigation.navigate('Home');
    return true;
  }, [navigation, section, categoriesOpen, planPage]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBackInsideRedCoins);
    return () => subscription.remove();
  }, [goBackInsideRedCoins]));

  useEffect(() => {
    (async () => {
      const loaded = await loadRedCoins();
      setState(loaded);
      void refreshLiveBluecoins(loaded).catch(console.warn);
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
      } catch (error) {
        console.warn('RedCoins SQLite migration failed', error);
      }
    })().catch(error => {
      console.warn('RedCoins open failed', error);
      setLoadError(error instanceof Error ? error.message : String(error));
    });
  }, [loadAttempt]);

  const salaryLedgerWindow = useMemo(() => {
    if (filterDateMode !== 'cycle') return null;
    const source = preferredSalarySource(salaryFilterSources(state?.entries || []), filterSalaryKey);
    const cycle = source ? salaryFilterCycle(source, salaryCycleOffset(source, filterStartDay)) : null;
    return cycle ? { start: cycle.startInstant, endExclusive: cycle.endExclusive, actualThrough: Date.now() } : null;
  }, [state?.entries, filterDateMode, filterSalaryKey, filterStartDay]);
  const matchingLedgerEntries = useMemo(() => filterLedgerEntries(state?.entries || [], {
    search, types: filterTypes, accounts: filterAccounts, categories: filterCategories,
    subcategories: filterSubcategories, startDay: filterStartDay, endDay: filterEndDay, reportWindow: salaryLedgerWindow || reportLedgerWindow,
  }), [state?.entries, search, filterTypes, filterAccounts, filterCategories, filterSubcategories, filterStartDay, filterEndDay, reportLedgerWindow, salaryLedgerWindow]);
  const ledgerFilterKey = JSON.stringify([search, filterTypes, filterAccounts, filterCategories, filterSubcategories, filterStartDay, filterEndDay, reportLedgerWindow]);

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
    if (!state || needsRedCoinsSetup(state) || !['expense', 'income', 'transfer'].includes(mode)) return;
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
  }, [route?.params?.mode, route?.params?.fingerprint, state?.createdAt, state?.onboarding?.status, state?.accounts.length]);

  useEffect(() => {
    const target = route?.params?.section as Section | undefined;
    if (!target || !['home', 'activity', 'accounts', 'plan', 'reports'].includes(target)) return;
    sectionHistory.current = [];
    setSection(target);
    if (target === 'plan') setPlanPage(['budgets','guards','automation'].includes(route?.params?.planPage) ? route.params.planPage : 'overview');
    if (target === 'accounts') setCategoriesOpen(false);
    navigation.setParams({ section: undefined, planPage: undefined });
  }, [route?.params?.section]);

  const persist = async (next: RedCoinsState, refreshSource = false) => {
    setState({ ...next });
    await saveRedCoins(next);
    await refreshLiveBluecoins(next);
    refreshLeanLogWidget().catch(() => {});
  };
  useEffect(() => { void readRedCoinsClipboard().then(setCopiedEntries).catch(console.warn); }, []);
  const releaseBatch = () => { batchLock.current = false; setBatchBusy(false); };
  const runConfirmedBatch = (message: string, mutation: (current: RedCoinsState) => RedCoinsState, destructive = false) => {
    if (batchLock.current) return;
    batchLock.current = true;
    setBatchBusy(true);
    Alert.alert(destructive ? 'Delete permanently?' : 'Apply to all these transactions?', message, [
      { text: 'Cancel', style: 'cancel', onPress: releaseBatch },
      { text: destructive ? 'Delete' : 'Apply', style: destructive ? 'destructive' : 'default', onPress: () => {
        void (async () => {
          try {
            const current = await loadRedCoins();
            const next = mutation(current);
            await persist(next);
            setBatchOpen(null);
            setSelectedIds([]);
            // Local state is already live. Index repair must not roll back a
            // successfully persisted batch or hold up its visual result.
            void syncRedCoinsLedger(next.entries).then(() => setLedgerRevision(value => value + 1)).catch(error => console.warn('Batch ledger indexing failed', error));
          } catch (error) {
            void loadRedCoins().then(setState).catch(console.warn);
            Alert.alert('Batch change failed', error instanceof Error ? error.message : 'Please try again.');
          } finally { releaseBatch(); }
        })();
      } },
    ], { cancelable: false });
  };
  const reviewBatch = (action: BatchAction) => {
    if (!state || batchLock.current) return;
    const ids = [...selectedIds];
    try { applyRedCoinsBatch(state, ids, action); }
    catch (error) { Alert.alert('Cannot apply change', error instanceof Error ? error.message : 'Please check the selection.'); return; }
    const detail = action.kind === 'name' ? `Set title to “${action.value.trim()}”.`
      : action.kind === 'amount' ? `Set EACH transaction to ${money(action.value)}.`
      : action.kind === 'date' ? `Move to ${action.day}, keeping each transaction's time.`
      : action.kind === 'account' ? `${action.account ? `Source account: ${action.account}.` : 'Source accounts stay unchanged.'}${action.toAccount ? ` Transfer destination: ${action.toAccount}.` : ' Transfer destinations stay unchanged.'}`
      : action.kind === 'category' ? `Set category to ${action.category} / ${action.subcategory}.`
      : action.kind === 'status' ? `Set status to ${action.value}. No additional payment is recorded.`
      : action.kind === 'labels' ? `${action.mode === 'clear' ? 'Remove ALL labels.' : `${action.mode} labels: ${action.labels.join(', ')}.`}`
      : 'This cannot be restored. Account balances will be adjusted. Recurring schedules are not cancelled.';
    runConfirmedBatch(`${ids.length} transactions.\n\n${detail}`, current => applyRedCoinsBatch(current, ids, action), action.kind === 'delete');
  };
  const copyBatchSelection = async () => {
    if (batchLock.current) return;
    batchLock.current = true; setBatchBusy(true);
    try {
      const current = await loadRedCoins();
      const rows = current.entries.filter(entry => selectedIds.includes(entry.id));
      if (rows.length !== new Set(selectedIds).size) throw new Error('Selection changed. Select transactions again.');
      await copyRedCoinsEntries(rows);
      setCopiedEntries(await readRedCoinsClipboard());
      setBatchOpen(null);
      Alert.alert('Copied', `${rows.length} transactions. Use PASTE under the ledger search to create copies.`);
    } catch (error) { Alert.alert('Copy failed', error instanceof Error ? error.message : 'Please try again.'); }
    finally { releaseBatch(); }
  };
  const reviewPaste = (day: string | null) => {
    if (!state || batchLock.current) return;
    const copied = copiedEntries.map(entry => ({ ...entry, labels: [...(entry.labels || [])] }));
    try { pasteRedCoinsEntries(state, copied, day); }
    catch (error) { Alert.alert('Cannot paste', error instanceof Error ? error.message : 'Please check the copied transactions.'); return; }
    runConfirmedBatch(`Create ${copied.length} NEW transactions ${day ? `dated ${day}` : 'with their original dates'}?\n\nThis affects balances and budgets. Reminder schedules will not be copied.`, current => pasteRedCoinsEntries(current, copied, day));
  };
  const refreshLiveBluecoins = async (current?: RedCoinsState) => {
    const request = ++summaryRequest.current;
    const summary = await getRedCoinsSummary(current);
    if (request === summaryRequest.current) setBluecoins(summary);
  };
  useEffect(() => subscribeRedCoinsChanges(({ kind, source }) => {
    // Entry saves publish their committed state directly. External changes must
    // still reload, including due reminders, restores and settings updates.
    if (source === localWriteSource.current) return;
    void (async () => {
      const current = await loadRedCoins();
      if (kind === 'state') setState(current);
      await refreshLiveBluecoins(current);
    })().catch(console.warn);
  }), []);
  useEffect(() => {
    const check = () => {
      void BluecoinsDriveReader?.canScheduleRedCoinsExactAlarmsAsync?.().then(setExactAlarmsAllowed).catch(console.warn);
      void BluecoinsDriveReader?.redCoinsNotificationsEnabledAsync?.().then(setReminderNotificationsAllowed).catch(console.warn);
    };
    check();
    const subscription = AppState.addEventListener('change', (status) => { if (status === 'active') check(); });
    return () => subscription.remove();
  }, []);
  const syncScheduleAccess = async (reminders: RedCoinsReminder[]) => {
    await requestReminderAccess();
    await syncReminderNotifications(reminders);
    if (BluecoinsDriveReader?.redCoinsNotificationsEnabledAsync) setReminderNotificationsAllowed(await BluecoinsDriveReader.redCoinsNotificationsEnabledAsync());
    if (Platform.OS === 'android' && BluecoinsDriveReader?.canScheduleRedCoinsExactAlarmsAsync && !await BluecoinsDriveReader.canScheduleRedCoinsExactAlarmsAsync()) {
      Alert.alert('Allow precise reminders', 'Enable LeanLog under Alarms & reminders. Without this access Android may delay notifications, and auto-log syncs when you reopen the app.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Open settings', onPress: () => { void BluecoinsDriveReader?.openRedCoinsAlarmSettingsAsync(); } },
      ]);
    }
  };
  useEffect(() => {
    if (!state) return;
    const nextDue = state.reminders
      .filter((reminder) => reminder.enabled)
      .map((reminder) => nextReminderOccurrence(reminder))
      .filter((date): date is Date => !!date)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (!nextDue) return;
    const delay = Math.max(0, nextDue.getTime() - Date.now() + 500);
    const timer = setTimeout(async () => {
      const refreshed = await loadRedCoins();
      setState(refreshed);
      await syncRedCoinsLedger(refreshed.entries);
      setLedgerRevision((value) => value + 1);
      await refreshLiveBluecoins(refreshed);
    }, Math.min(delay, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [state?.reminders]);
  const resetEntry = (initialType: RedCoinsType = 'expense') => {
    if (entrySaveLock.current || receiptBusy) return;
    if (!state) return;
    const recent = state.entries.find((entry) => entry.type === initialType);
    const available = loggerCategories(state.categories, state.entries, initialType);
    const defaults = state.entryDefaults?.[initialType];
    setEditingEntryId(null);
    setSchedulingOnly(false);
    setEditingReminderId(null);
    setReviewingDetectionId(null);
    setEntryDate(new Date());
    setItem('');
    setAmount('');
    setType(initialType);
    setIncomePeriod('');
    setAccount(defaults?.account || recent?.account || state.accounts.find((a) => a.type === 'Credit card')?.name || state.accounts[0]?.name || '');
    setToAccount(defaults?.toAccount || recent?.toAccount || '');
    const chosen = available.find((group) => group.name === (defaults?.category || recent?.category)) || available[0];
    setCategory(chosen?.name || '');
    setSubcategory(chosen?.subcategories.includes(defaults?.subcategory || recent?.subcategory || '') ? (defaults?.subcategory || recent!.subcategory) : chosen?.subcategories[0] || '');
    setNote('');
    void discardReceiptDrafts(receiptDrafts).catch(console.warn);
    setReceiptDrafts([]);
    setLabels('');
    setRepeat('none');
    setInstallments('');
    setRepeatEvery('1');
    setReminderEndType('never');
    setReminderEndDate('');
    setReminderOccurrences('12');
    setAutomaticLog(true);
    setExcludeWeekend(false);
    setWeekendMove('after');
    setAdvanced(false);
    setEntryOpen(true);
  };
  const createReminderSchedule = () => {
    if (entrySaveLock.current) return;
    resetEntry('expense');
    setSchedulingOnly(true);
    setRepeat('monthly');
    setAdvanced(true);
  };
  const suggestions = useMemo(() => {
    return entryOpen ? loggerSuggestions(state?.entries || [], item, type) : [];
  }, [entryOpen, item, state?.entries, type]);
  const applyEntryType = (nextType: RedCoinsType) => {
    setType(nextType);
    setIncomePeriod('');
    const defaults = state?.entryDefaults?.[nextType];
    const recent = state?.entries.find((entry) => entry.type === nextType);
    if (defaults?.account || recent?.account) setAccount(defaults?.account || recent!.account);
    setToAccount(defaults?.toAccount || recent?.toAccount || '');
    if (nextType !== 'transfer') {
      const available = loggerCategories(state?.categories || [], state?.entries || [], nextType);
      const chosen = available.find((group) => group.name === (defaults?.category || recent?.category)) || available[0];
      setCategory(chosen?.name || '');
      const preferred = defaults?.subcategory || recent?.subcategory || '';
      setSubcategory(chosen?.subcategories.includes(preferred) ? preferred : chosen?.subcategories[0] || '');
    }
  };
  const chooseSuggestion = (entry: any) => {
    setItem(entry.item);
    if (entry.account) setAccount(entry.account);
    setCategory(entry.category);
    setSubcategory(entry.subcategory);
  };
  const editEntry = (selectedEntry: RedCoinsEntry, duplicateReview = false) => {
    if (receiptBusy || (entrySaveLock.current && !duplicateReview)) return;
    // SQLite rows contain ledger-display fields; newer metadata is authoritative
    // in the saved state and must survive opening an entry from the ledger.
    const entry = state?.entries.find(row => row.id === selectedEntry.id) || selectedEntry;
    setSchedulingOnly(false);
    setEditingReminderId(null);
    setReviewingDetectionId(null);
    setEditingEntryId(entry.id);
    setItem(entry.item);
    setAmount(String(entry.amount));
    setType(entry.type);
    setIncomePeriod(entry.incomePeriod || '');
    setAccount(entry.account);
    setToAccount(entry.toAccount || '');
    setEntryDate(new Date(entry.date));
    setCategory(entry.category);
    setSubcategory(entry.subcategory);
    setNote(entry.note || '');
    void discardReceiptDrafts(receiptDrafts).catch(console.warn);
    setReceiptDrafts([]);
    setLabels((entry.labels || []).join(', '));
    setRepeat(entry.repeat || 'none');
    setInstallments(entry.installments ? String(entry.installments) : '');
    const schedule = state?.reminders.find((reminder) => reminder.id === entry.reminderSeriesId);
    setRepeatEvery(String(schedule?.repeatEvery || 1));
    setReminderEndType(schedule?.endType || 'never');
    setReminderEndDate(schedule?.endDate?.slice(0, 10) || '');
    setReminderOccurrences(String(schedule?.occurrences || entry.installments || 12));
    setAutomaticLog(schedule?.automaticLog ?? true);
    setExcludeWeekend(schedule?.excludeWeekend || false);
    setWeekendMove(schedule?.weekendMove || 'after');
    setAdvanced(!!entry.note || !!entry.labels?.length || (!!entry.repeat && entry.repeat !== 'none'));
    setEntryOpen(true);
  };
  useEffect(() => {
    const target = route?.params?.auditTarget;
    if (!target || !state) return;
    navigation.setParams({ auditTarget: undefined });
    setSection(target.section);
    if (target.section === 'plan') setPlanPage(target.planPage || 'budgets');
    if (target.section === 'accounts') setCategoriesOpen(false);
    if (target.entryId) {
      const entry = state.entries.find(row => row.id === target.entryId);
      if (entry) editEntry(entry);
      else Alert.alert('Entry unavailable', 'This result is no longer in the current ledger. Run Check my data again.');
    } else if (target.accountId) {
      if (state.accounts.some(account => account.id === target.accountId)) setBankReviewAccountId(target.accountId);
      else Alert.alert('Account unavailable', 'Run Check my data again.');
    }
  }, [route?.params?.auditTarget, state]);
  const editReminderSchedule = (reminder: RedCoinsReminder) => {
    if (entrySaveLock.current || receiptBusy) return;
    const template = reminder.template;
    setEditingEntryId(null);
    setReviewingDetectionId(null);
    setSchedulingOnly(true);
    setEditingReminderId(reminder.id);
    setItem(template.item);
    setAmount(String(template.amount));
    setType(template.type);
    setIncomePeriod('');
    setAccount(template.account);
    setToAccount(template.toAccount || '');
    setEntryDate(new Date(reminder.startDate));
    setCategory(template.category);
    setSubcategory(template.subcategory);
    setNote(template.note || '');
    void discardReceiptDrafts(receiptDrafts).catch(console.warn);
    setReceiptDrafts([]);
    setLabels((template.labels || []).join(', '));
    setRepeat(reminder.frequency);
    setInstallments('');
    setRepeatEvery(String(reminder.repeatEvery || 1));
    setReminderEndType(reminder.endType);
    setReminderEndDate(reminder.endDate?.slice(0, 10) || '');
    setReminderOccurrences(String(reminder.occurrences || 12));
    setAutomaticLog(reminder.automaticLog);
    setExcludeWeekend(reminder.excludeWeekend);
    setWeekendMove(reminder.weekendMove);
    setAdvanced(true);
    setEntryOpen(true);
  };
  const saveEntryInternal = async () => {
    if (!item.trim() || !Number(amount) || !account || (type === 'transfer' && !toAccount)) return Alert.alert('Incomplete entry', 'Add item, amount and account first.');
    if (!schedulingOnly && type === 'income' && incomePeriod.trim() && !validIncomePeriod(incomePeriod.trim())) return Alert.alert('Invalid income month', 'Use YYYY-MM, for example 2026-09, or leave it blank to use the transaction month.');
    if (schedulingOnly && (!repeat || repeat === 'none' || repeat === 'installment')) return Alert.alert('Choose a schedule', 'Select daily, weekly, monthly or yearly.');
    if (repeat && repeat !== 'none' && reminderEndType === 'date' && (!reminderEndDate || Number.isNaN(new Date(`${reminderEndDate}T23:59:59`).getTime()))) return Alert.alert('Invalid end date', 'Use YYYY-MM-DD for the recurring end date.');
    if (repeat === 'installment' && (Number(installments) || 0) < 2) return Alert.alert('Invalid instalments', 'Use at least 2 instalments.');
    Keyboard.dismiss();
    await afterRedCoinsPaint();
    let state = await loadRedCoins();
    // The latest durable state is still authoritative: never save a stale copy
    // captured when the logger opened, or bypass due-balance reconciliation.
    if (!state.accounts.some(row => row.name === account) || (type === 'transfer' && !state.accounts.some(row => row.name === toAccount))) throw new Error('This account changed. Please choose the account again.');
    if (editingEntryId && !state.entries.some(row => row.id === editingEntryId)) throw new Error('This transaction was removed while the logger was open.');
    const commit = async (next: RedCoinsState, entryIds?: string[]) => {
      await saveRedCoins(next, localWriteSource.current, entryIds);
      setEntryOpen(false);
      await afterRedCoinsPaint();
      setState(next);
      const refreshToken = ++summaryRequest.current;
      // Summary/widget refresh is secondary to the durable transaction commit.
      void afterRedCoinsPaint().then(async () => {
        if (refreshToken !== summaryRequest.current) return;
        await refreshLiveBluecoins(next);
        await refreshLeanLogWidget();
      }).catch(console.warn);
    };
    if (!schedulingOnly && type === 'income') {
      const duplicateDraft = { id: editingEntryId || '', type, item: item.trim(), account, category, subcategory, date: entryDate.toISOString(), amount: Number(amount), incomePeriod: incomePeriod.trim() || undefined };
      const duplicates = findIncomeDuplicates(state.entries, duplicateDraft);
      if (duplicates.length) {
        const decision = await new Promise<'cancel' | 'review' | 'save'>(resolve => Alert.alert('Possible duplicate income', `${duplicates.length} matching income ${duplicates.length === 1 ? 'entry' : 'entries'} already exist for ${account}.\n\n${duplicates.slice(0, 4).map(entry => `${entry.item} · ${money(entry.amount)} · ${new Date(entry.date).toLocaleDateString('en-MY')} · month ${entry.incomePeriod || incomeMonth(entry.date)}`).join('\n')}\n\nCheck the month/date first. This may be a genuine additional payment; nothing is deleted or merged.`, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
          { text: 'Review latest', onPress: () => resolve('review') },
          { text: 'Save anyway', onPress: () => resolve('save') },
        ], { cancelable: true, onDismiss: () => resolve('cancel') }));
        if (decision === 'cancel') { setEntryOpen(true); return; }
        state = await loadRedCoins();
        if (decision === 'review') { const existing = state.entries.find(entry => entry.id === duplicates[0].id); if (existing) editEntry(existing, true); else { setEntryOpen(true); Alert.alert('Entry changed', 'The matching transaction was removed. Please check the ledger.'); } return; }
      }
    }
    if (schedulingOnly) {
      const existing = editingReminderId ? state.reminders.find((reminder) => reminder.id === editingReminderId) : undefined;
      const reminderId = existing?.id || `series-${Date.now()}`;
      const reminder: RedCoinsReminder = {
        id: reminderId,
        enabled: existing?.enabled ?? true,
        automaticLog,
        frequency: repeat as RedCoinsReminder['frequency'],
        repeatEvery: Math.max(1, Number(repeatEvery) || 1),
        startDate: entryDate.toISOString(),
        endType: reminderEndType,
        endDate: reminderEndType === 'date' && reminderEndDate ? new Date(`${reminderEndDate}T23:59:59`).toISOString() : undefined,
        occurrences: reminderEndType === 'occurrences' ? Math.max(1, Number(reminderOccurrences) || 1) : undefined,
        excludeWeekend,
        weekendMove,
        createdAt: existing?.createdAt || new Date().toISOString(),
        template: {
          type,
          item: item.trim(),
          amount: Number(amount),
          account,
          toAccount: type === 'transfer' ? toAccount : undefined,
          category: type === 'transfer' ? '(Transfer)' : category,
          subcategory: type === 'transfer' ? '(Transfer)' : subcategory,
          note: note.trim(),
          labels: labels.split(',').map((value) => value.trim()).filter(Boolean),
          status: 'pending',
          origin: 'redcoins',
        },
        notificationIds: existing?.notificationIds || [],
      };
      const next: RedCoinsState = {
        ...state,
        reminders: existing ? state.reminders.map((row) => row.id === reminderId ? reminder : row) : [...state.reminders, reminder],
        entries: state.entries.filter((entry) => entry.reminderSeriesId !== reminderId || !entry.autoGenerated || new Date(entry.date).getTime() <= Date.now()),
        accounts: state.accounts.map((entry) => ({ ...entry })),
      };
      materializeAutomaticReminders(next).forEach((generated) => {
        applyEntryBalance(next, generated, 1);
        generated.balanceEffectApplied = true;
      });
      await commit(next);
      setSchedulingOnly(false);
      setEditingReminderId(null);
      setReminderManagerOpen(true);
      void syncRedCoinsLedger(next.entries).then(() => setLedgerRevision(value => value + 1)).catch(console.warn);
      void syncScheduleAccess(next.reminders).catch(console.warn);
      return;
    }
    const original = editingEntryId ? state.entries.find((entry) => entry.id === editingEntryId) : undefined;
    const hasReminder = repeat && repeat !== 'none';
    const editingSeriesTemplate = !!original?.repeat && original.repeat !== 'none';
    const reminderFrequency = (repeat === 'installment' ? 'monthly' : repeat) as RedCoinsReminder['frequency'];
    const reminderSeriesId = hasReminder ? (original?.reminderSeriesId || `series-${Date.now()}`) : original?.reminderSeriesId;
    const existingSchedule = state.reminders.find((candidate) => candidate.id === original?.reminderSeriesId);
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
      reminderSeriesId,
      reminderOccurrenceKey: original?.reminderOccurrenceKey,
      autoGenerated: original?.autoGenerated,
      loggedAt: original?.loggedAt || new Date().toISOString(),
      incomePeriod: type === 'income' ? incomePeriod.trim() || undefined : undefined,
      origin: original?.origin || 'redcoins',
      exportedAt: original?.exportedAt,
      editedAt: original?.origin === 'bluecoins' ? new Date().toISOString() : original?.editedAt,
      balanceEffectApplied: entryDate.getTime() <= Date.now(),
      attachment: original?.attachment,
      receipts: [...(original?.receipts || []), ...receiptDrafts],
    };
    const next: RedCoinsState = {
      ...state,
      entries: (original ? state.entries.map((row) => (row.id === original.id ? entry : row)) : [entry, ...state.entries])
        .filter((row) => !editingSeriesTemplate || !row.autoGenerated || row.reminderSeriesId !== original?.reminderSeriesId || new Date(row.date).getTime() <= Date.now()),
      reminders: editingSeriesTemplate ? state.reminders.filter((reminder) => reminder.id !== original?.reminderSeriesId) : [...state.reminders],
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
    if (hasReminder && reminderSeriesId) {
      const futureOccurrences = repeat === 'installment'
        ? Math.max(0, (Number(installments) || 1) - 1)
        : Math.max(1, Number(reminderOccurrences) || 12);
      const template: RedCoinsReminder['template'] = {
        type: entry.type,
        item: entry.item,
        amount: entry.amount,
        account: entry.account,
        toAccount: entry.toAccount,
        category: entry.category,
        subcategory: entry.subcategory,
        note: entry.note,
        labels: entry.labels,
        status: 'pending',
        origin: 'redcoins',
      };
      const reminder: RedCoinsReminder = {
        id: reminderSeriesId,
        enabled: true,
        automaticLog,
        frequency: reminderFrequency,
        repeatEvery: Math.max(1, Number(repeatEvery) || 1),
        startDate: advanceReminderDate(entryDate, reminderFrequency, Math.max(1, Number(repeatEvery) || 1)).toISOString(),
        endType: repeat === 'installment' ? 'occurrences' : reminderEndType,
        endDate: reminderEndType === 'date' && reminderEndDate ? new Date(`${reminderEndDate}T23:59:59`).toISOString() : undefined,
        occurrences: repeat === 'installment' || reminderEndType === 'occurrences' ? futureOccurrences : undefined,
        excludeWeekend,
        weekendMove,
        createdAt: existingSchedule?.createdAt || new Date().toISOString(),
        template,
        notificationIds: existingSchedule?.notificationIds || [],
      };
      if (futureOccurrences > 0 || reminder.endType !== 'occurrences') next.reminders.push(reminder);
      materializeAutomaticReminders(next).forEach((generated) => {
        applyEntryBalance(next, generated, 1);
        generated.balanceEffectApplied = true;
      });
    }
    if (original) applyEntryBalance(next, original, -1);
    applyEntryBalance(next, entry, 1);
    await commit(next, hasReminder || editingSeriesTemplate ? undefined : [entry.id]);
    if (receiptDrafts.length) {
      setReceiptDrafts([]);
      setEditingEntryId(entry.id);
      setEntryOpen(true);
      // Finance is already committed. Folder failures must never invite replaying the transaction.
      const failedCopies: string[] = [];
      try {
        if (await savedReceiptFolder()) {
          for (const receipt of receiptDrafts) {
            try { await saveReceiptToFolder(entry.id, receipt.id); }
            catch (error) { failedCopies.push(error instanceof Error ? error.message : 'Receipt copy failed.'); }
          }
          setState(await loadRedCoins());
        }
      } catch (error) { failedCopies.push(error instanceof Error ? error.message : 'Could not read the receipt folder.'); }
      if (failedCopies.length) Alert.alert('Transaction saved', `Receipt originals are kept on this phone. Retry Save to folder.\n\n${failedCopies.join('\n')}`);
    }
    if (reviewingDetectionId) dismissDetection(reviewingDetectionId).catch(() => {});
    navigateSection('activity');
    const indexWrite = hasReminder || editingSeriesTemplate ? syncRedCoinsLedger(next.entries) : upsertRedCoinsLedgerEntry(entry);
    void indexWrite
        .then(() => setLedgerRevision((value) => value + 1))
        .catch((error) => console.warn('RedCoins ledger upsert failed', error));
    if (hasReminder || editingSeriesTemplate) void syncScheduleAccess(next.reminders).catch(console.warn);
  };
  const saveEntry = async () => {
    if (entrySaveLock.current) return;
    if (receiptBusy) return;
    entrySaveLock.current = true;
    setEntrySaving(true);
    try { await saveEntryInternal(); }
    catch (error) {
      setEntryOpen(true);
      Alert.alert('Could not save entry', error instanceof Error ? error.message : String(error));
    }
    finally { entrySaveLock.current = false; setEntrySaving(false); }
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
  const toggleReminder = async (reminder: RedCoinsReminder) => {
    if (!state) return;
    const next: RedCoinsState = {
      ...state,
      reminders: state.reminders.map((item) => item.id === reminder.id ? { ...item, enabled: !item.enabled } : item),
      entries: state.entries.map((entry) => ({ ...entry })),
      accounts: state.accounts.map((entry) => ({ ...entry })),
    };
    materializeAutomaticReminders(next).forEach((generated) => {
      applyEntryBalance(next, generated, 1);
      generated.balanceEffectApplied = true;
    });
    await syncReminderNotifications(next.reminders);
    await Promise.all([persist(next), syncRedCoinsLedger(next.entries)]);
    setLedgerRevision((value) => value + 1);
  };
  const deleteReminderSeries = (reminder: RedCoinsReminder) => Alert.alert('Delete recurring series?', `${reminder.template.item} · Future auto-logged occurrences will also be removed.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete series', style: 'destructive', onPress: async () => {
      if (!state) return;
      const now = Date.now();
      const next: RedCoinsState = {
        ...state,
        reminders: state.reminders.filter((item) => item.id !== reminder.id),
        entries: state.entries.filter((entry) => entry.reminderSeriesId !== reminder.id || !entry.autoGenerated || new Date(entry.date).getTime() <= now),
      };
      await syncReminderNotifications([...next.reminders, { ...reminder, enabled: false }]);
      await Promise.all([persist(next), syncRedCoinsLedger(next.entries)]);
      setLedgerRevision((value) => value + 1);
    } },
  ]);
  const reminderLogLock = useRef(false);
  const logReminderNow = (reminder: RedCoinsReminder) => {
    if (!state || reminderLogLock.current) return;
    const due = pendingReminderOccurrence(state, reminder);
    if (!due) return Alert.alert('Nothing to log', 'This schedule is paused, completed or its occurrence has already been logged.');
    const missing = missingReminderAccounts(reminder, state.accounts);
    if (missing.length) return Alert.alert('Fix reminder accounts first', `Missing: ${missing.join(', ')}.`);
    reminderLogLock.current = true;
    let confirmed = false;
    Alert.alert('Log this occurrence now?', `${reminder.template.item} · ${money(reminder.template.amount)}\nScheduled: ${due.toLocaleString('en-MY')}\n\nRecords it at the current time and marks this occurrence paid/logged. It will not auto-log again at its original due time. The next recurring date stays unchanged.`, [
      { text: 'Cancel', style: 'cancel', onPress: () => { reminderLogLock.current = false; } },
      { text: 'Log now', onPress: () => {
        confirmed = true;
        void (async () => {
          try {
            const current = await loadRedCoins();
            const result = logReminderOccurrenceNow(current, reminder.id, due.toISOString());
            await persist(result.state);
            void upsertRedCoinsLedgerEntry(result.entry).then(() => setLedgerRevision(value => value + 1)).catch(console.warn);
            void syncReminderNotifications(result.state.reminders).catch(console.warn);
          } catch (error) { Alert.alert('Could not log occurrence', error instanceof Error ? error.message : String(error)); }
          finally { reminderLogLock.current = false; }
        })();
      } },
    ], { cancelable: true, onDismiss: () => { if (!confirmed) reminderLogLock.current = false; } });
  };

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const iconLookupKey = useCallback((value?: string) => (value || '').trim().toLocaleLowerCase(), []);
  const categoryIcons = useMemo(() => {
    const icons = new Map<string, { icon?: string; subcategoryIcons: Map<string, string> }>();
    (state?.categories || []).forEach((category) => {
      icons.set(iconLookupKey(category.name), {
        icon: category.icon,
        subcategoryIcons: new Map(
          Object.entries(category.subcategoryIcons || {}).map(([name, icon]) => [iconLookupKey(name), icon]),
        ),
      });
    });
    return icons;
  }, [state?.categories, iconLookupKey]);
  const iconForEntry = useCallback((entry: RedCoinsEntry) => {
    if (entry.type !== 'expense') return transactionIcon(entry);
    const category = categoryIcons.get(iconLookupKey(entry.category));
    const savedIcon = category?.subcategoryIcons.get(iconLookupKey(entry.subcategory)) || category?.icon;
    return savedIcon && ICON_LIBRARY.includes(savedIcon) ? savedIcon : transactionIcon(entry);
  }, [categoryIcons, iconLookupKey]);
  const ledgerExtraData = useMemo(() => ({ selectedIds, categoryIcons, ledgerRevision }), [selectedIds, categoryIcons, ledgerRevision]);
  const entryBalanceById = useMemo(() => {
    if (!state) return new Map<string, { source: number; destination?: number }>();
    const balances = new Map(state.accounts.map((account) => [account.name, account.balance]));
    const result = new Map<string, { source: number; destination?: number }>();
    const now = Date.now();
    const future = state.entries.filter((entry) => new Date(entry.date).getTime() > now).sort((a, b) => a.date.localeCompare(b.date));
    future.forEach((entry) => {
      if (entry.type === 'expense') balances.set(entry.account, (balances.get(entry.account) || 0) - entry.amount);
      if (entry.type === 'income') balances.set(entry.account, (balances.get(entry.account) || 0) + entry.amount);
      if (entry.type === 'transfer') {
        balances.set(entry.account, (balances.get(entry.account) || 0) - entry.amount);
        if (entry.toAccount) balances.set(entry.toAccount, (balances.get(entry.toAccount) || 0) + entry.amount);
      }
      result.set(entry.id, {
        source: balances.get(entry.account) || 0,
        destination: entry.type === 'transfer' && entry.toAccount ? balances.get(entry.toAccount) || 0 : undefined,
      });
    });
    const currentBalances = new Map(state.accounts.map((account) => [account.name, account.balance]));
    state.entries
      .filter((entry) => new Date(entry.date).getTime() <= now)
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((entry) => {
        result.set(entry.id, {
          source: currentBalances.get(entry.account) || 0,
          destination: entry.type === 'transfer' && entry.toAccount ? currentBalances.get(entry.toAccount) || 0 : undefined,
        });
        if (entry.type === 'expense') currentBalances.set(entry.account, (currentBalances.get(entry.account) || 0) + entry.amount);
        if (entry.type === 'income') currentBalances.set(entry.account, (currentBalances.get(entry.account) || 0) - entry.amount);
        if (entry.type === 'transfer') {
          currentBalances.set(entry.account, (currentBalances.get(entry.account) || 0) + entry.amount);
          if (entry.toAccount) currentBalances.set(entry.toAccount, (currentBalances.get(entry.toAccount) || 0) - entry.amount);
        }
      });
    return result;
  }, [state]);
  const filteredLedgerSummary = useMemo(() => summarizeLedgerEntries(matchingLedgerEntries), [matchingLedgerEntries]);
  const selectedLedgerSummary = useMemo(() => summarizeLedgerEntries((state?.entries || []).filter((entry) => selectedSet.has(entry.id))), [state?.entries, selectedSet]);
  const selectedTotal = selectedLedgerSummary.net;
  const toggleSelected = useCallback((entry: RedCoinsEntry) => setSelectedIds((ids) => (ids.includes(entry.id) ? ids.filter((id) => id !== entry.id) : [...ids, entry.id])), []);
  const updateLedgerSearch = useCallback((value: string) => {
    setSelectedIds([]);
    setSearch(value);
  }, []);
  const openDashboardFilter = (kind: 'day' | 'category' | 'account', value: string) => {
    setReportLedgerWindow(null);
    setSearch('');
    setSelectedIds([]);
    setFilterTypes([]);
    setFilterDateMode(kind === 'day' ? 'single' : 'all');
    setFilterStartDay(kind === 'day' ? value : '');
    setFilterEndDay(kind === 'day' ? value : '');
    setFilterDateLabel(kind === 'day' ? reportDate(localDay(value)) : '');
    setFilterCategories(kind === 'category' ? [value] : []);
    setFilterAccounts(kind === 'account' ? [value] : []);
    setFilterSubcategories([]);
    navigateSection('activity');
  };
  const applyLedgerFilters = useCallback((next: { types: RedCoinsType[]; accounts: string[]; categories: string[]; subcategories: string[]; dateMode: FilterDateMode; startDay: string; endDay: string; dateLabel: string; salarySourceKey?: string }) => {
    if (next.dateMode !== filterDateMode || next.startDay !== filterStartDay || next.endDay !== filterEndDay) setReportLedgerWindow(null);
    setSelectedIds([]);
    setFilterTypes(next.types);
    setFilterAccounts(next.accounts);
    setFilterCategories(next.categories);
    setFilterSubcategories(next.subcategories);
    setFilterDateMode(next.dateMode);
    setFilterStartDay(next.startDay);
    setFilterEndDay(next.endDay);
    setFilterDateLabel(next.dateLabel);
    if (next.salarySourceKey) { salarySelectionTouched.current = true; setFilterSalaryKey(next.salarySourceKey); }
    setFilterOpen(false);
  }, [filterDateMode, filterStartDay, filterEndDay]);
  const toggleCard = (name: string) => setCollapsedCards((cards) => (cards.includes(name) ? cards.filter((card) => card !== name) : [...cards, name]));
  const dismissDetection = async (id: string) => {
    await BluecoinsDriveReader?.dismissTransactionDetectionAsync?.(id);
    setDetections((rows) => rows.filter((row) => row.id !== id));
  };
  const reviewDetection = (detection: TransactionDetection) => {
    if (entrySaveLock.current) return;
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
    return salaryFilterSources(state?.entries || []);
  }, [state?.entries]);
  const filterSalarySources = useMemo(() => salaryFilterSources(state?.entries || []), [state?.entries]);
  const ledgerSalary = preferredSalarySource(filterSalarySources, filterSalaryKey);
  const ledgerCycleOffset = ledgerSalary ? salaryCycleOffset(ledgerSalary, filterStartDay) : 0;
  const ledgerCycle = ledgerSalary ? salaryFilterCycle(ledgerSalary, ledgerCycleOffset) : null;
  const changeLedgerPeriod = (mode: 'month' | 'cycle' | 'all', direction = 0) => {
    Keyboard.dismiss();
    if (mode === 'all') {
      setReportLedgerWindow(null);
      setFilterDateMode('all'); setFilterStartDay(''); setFilterEndDay(''); setFilterDateLabel(''); setSelectedIds([]); return;
    }
    if (mode === 'month') {
      setReportLedgerWindow(null);
      const period = ledgerMonthPeriod(filterStartDay, direction);
      setFilterDateMode('month'); setFilterStartDay(period.startDay); setFilterEndDay(period.endDay); setFilterDateLabel(period.dateLabel);
    } else {
      if (!ledgerSalary) {
        Alert.alert('Choose a salary source', 'Select a source under Date & cycle in transaction filters first.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Choose source', onPress: () => setFilterOpen(true) }]); return;
      }
      const cycle = salaryFilterCycle(ledgerSalary, filterDateMode === 'cycle' ? ledgerCycleOffset - direction : 0);
      if (!cycle) return;
      setReportLedgerWindow(null);
      setFilterDateMode('cycle'); setFilterStartDay(cycle.startDay); setFilterEndDay(cycle.endDay); setFilterDateLabel(cycle.dateLabel);
      salarySelectionTouched.current = true; setFilterSalaryKey(ledgerSalary.key);
      void AsyncStorage.setItem(SALARY_FILTER_SOURCE_KEY, ledgerSalary.key).catch(console.warn);
    }
    setSelectedIds([]);
  };
  const chooseLedgerPeriodMode = () => Alert.alert('Ledger period', 'Change the date window; your other filters stay selected.', [
    { text: 'Salary cycle', onPress: () => changeLedgerPeriod('cycle') },
    { text: 'Calendar month', onPress: () => changeLedgerPeriod('month') },
    { text: 'All dates', onPress: () => changeLedgerPeriod('all') },
  ], { cancelable: true });

  const report = useMemo(() => {
    if (!state || section !== 'reports') return null;
    const source = salarySources.find((item) => item.key === reportSalarySource)
      || salarySources.find(item => item.entries[0]?.item.trim().toLowerCase().replace(/\s+/g, ' ') === reportSalarySource)
      || salarySources[0];
    const now = new Date();
    const cycle = source ? salaryFilterCycle({ ...source, isSalary: true }, reportCycleOffset, now) : null;
    const maxOffset = Math.max(0, (cycle?.count || 1) - 1);
    const safeOffset = cycle?.offset || 0;
    const anchor = source?.entries.find(entry => new Date(entry.date).getTime() === cycle?.startInstant);
    const nextAnchor = source?.entries.find(entry => new Date(entry.date).getTime() === cycle?.endExclusive);
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
      actualThrough: now.getTime(),
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
  }, [section, state, salarySources, reportSalarySource, reportCycleOffset, reportMode, reportCustomStart, reportCustomEnd]);

  const reportAnalysisScope = useMemo(() => report ? ({ mode: reportMode, label: reportMode === 'salary-cycle' ? report.cycleLabel : `${reportDate(report.start)} — ${reportDate(report.displayEnd)}`, start: report.start, endExclusive: report.endExclusive, salarySource: report.source }) : null, [report, reportMode]);
  const openReportMetricLedger = (type: RedCoinsType) => {
    if (!report) return;
    Keyboard.dismiss();
    setSearch(''); setSelectedIds([]);
    setFilterTypes([type]); setFilterAccounts([]); setFilterCategories([]); setFilterSubcategories([]);
    setFilterDateMode('range');
    setFilterStartDay(dayKey(report.start.toISOString()));
    setFilterEndDay(dayKey(report.displayEnd.toISOString()));
    setFilterDateLabel(`Report · ${reportMode === 'salary-cycle' ? report.cycleLabel : `${reportDate(report.start)} — ${reportDate(report.displayEnd)}`}`);
    // Salary boundaries can be midday; date-only filters would include rows
    // outside the report and future scheduled entries not in the metric.
    setReportLedgerWindow({ start: report.start.getTime(), endExclusive: report.endExclusive.getTime(), actualThrough: report.actualThrough });
    navigateSection('activity');
  };

  const openAnalysisSubcategoryLedger = (category: string, subcategory: string, window: { start: number; endExclusive: number; actualThrough: number }) => {
    Keyboard.dismiss();
    setSearch(''); setSelectedIds([]);
    setFilterTypes(['expense']); setFilterAccounts([]);
    setFilterCategories([category]); setFilterSubcategories([subcategory]);
    setFilterDateMode('range');
    // Exact timestamps below are authoritative; avoid rounded day filters.
    setFilterStartDay(''); setFilterEndDay('');
    setFilterDateLabel(`What changed · ${category} / ${subcategory || 'No subcategory'}`);
    setReportLedgerWindow(window);
    navigateSection('activity');
  };

  const finance = useMemo(() => {
    if (!state) return null;
    const now = new Date();
    const cycleStart = bluecoins?.monthly?.cycleStartInstant ? new Date(bluecoins.monthly.cycleStartInstant) : bluecoins?.monthly?.cycleStart ? new Date(`${bluecoins.monthly.cycleStart}T00:00:00`) : new Date(now.getFullYear(), now.getMonth() - (now.getDate() < state.payday ? 1 : 0), state.payday);
    const cycleEnd = bluecoins?.monthly?.cycleEndExclusive ? new Date(new Date(bluecoins.monthly.cycleEndExclusive).getTime() - 1) : bluecoins?.monthly?.cycleEnd ? new Date(`${bluecoins.monthly.cycleEnd}T23:59:59`) : new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, cycleStart.getDate());
    const cycleRows = state.entries.filter((entry) => {
      const date = new Date(entry.date);
      return date >= cycleStart && date <= cycleEnd;
    });
    const ledgerSpending = aggregateCycleSpending(state.entries, cycleStart, cycleEnd, now);
    // The cycle ceiling still includes reserved mortgage/car commitments from
    // Budget Coach. Category/subcategory actuals come from every live ledger row.
    const spent = bluecoins?.monthly.spent ?? ledgerSpending.spent;
    const income = ledgerSpending.income;
    const catSpend = ledgerSpending.categories;
    const subcategorySpend = ledgerSpending.subcategories;
    const reservedDebt = bluecoins?.monthly.topCategories.find((category) => category.name === 'Debt commitment');
    if (reservedDebt) catSpend['Debt commitment'] = Math.max(catSpend['Debt commitment'] || 0, reservedDebt.amount);
    const remaining = state.monthlyBudget - spent;
    const daysLeft = Math.max(1, Math.ceil((cycleEnd.getTime() + 1 - now.getTime()) / 86400000));
    const cardDebt = bluecoins?.cashReality.cardOutstanding ?? state.accounts.filter((account) => account.type === 'Credit card').reduce((sum, account) => sum + Math.max(0, -account.balance), 0);
    const cash = bluecoins?.cashReality.liquidBalance ?? state.accounts.filter((account) => ['Bank', 'Cash'].includes(account.type)).reduce((sum, account) => sum + account.balance, 0);
    const allocatedBudget = Object.entries(state.subcategoryBudgets || {}).reduce((sum, [key, value]) => sum + (budgetKeys.has(key) ? Math.max(0, Number(value) || 0) : 0), 0) + periodAllocation(state,now);
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
        <Text style={s.loadingText}>{loadError ? 'Could not open RedCoins' : 'Opening your money room…'}</Text>
        {loadError && <>
          <Text style={{ color: appPalette.text, padding: 20, textAlign: 'center' }}>{loadError}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => { setLoadError(null); setLoadAttempt(value => value + 1); }} style={{ padding: 16 }}>
            <Text style={{ color: appPalette.text, fontWeight: '700' }}>Try again</Text>
          </TouchableOpacity>
        </>}
      </SafeAreaView>
    );

  const { now, cycleRows, spent, income, remaining, daysLeft, cardDebt, cash, trueSpendable, catSpend, topCats, allocatedBudget, unallocatedBudget, subcategorySpend } = finance!;
  const categoryBudget = (category: string) => (budgetCategories.find((group) => group.name === category)?.subcategories.reduce((sum, subcategory) => sum + (state.subcategoryBudgets[budgetKey(category, subcategory)] || 0), 0) || 0) + periodAllocation(state,new Date(),category);
  const openBudgetEditor = (category: string, subcategory: string) => setBudgetEditor({ category, subcategory });
  const saveBudgetSetup = async (choice: BudgetChoice) => {
    if (!budgetEditor) return;
    const current = await loadRedCoins();
    if (choice && !current.categories.some(c=>c.name===budgetEditor.category && (!budgetEditor.subcategory || c.subcategories.includes(budgetEditor.subcategory)))) throw new Error('This budget target no longer exists. Reopen Budgets to choose a current target.');
    if (JSON.stringify(targetBudgetChoices(state,budgetEditor.category,budgetEditor.subcategory)) !== JSON.stringify(targetBudgetChoices(current,budgetEditor.category,budgetEditor.subcategory))) throw new Error('Budget changed while this editor was open. Close and reopen it before saving.');
    const next = replaceTargetBudget(current,budgetEditor.category,budgetEditor.subcategory,choice);
    const allocation = Object.values(next.subcategoryBudgets).reduce((sum,value)=>sum+Math.max(0,value),0)+periodAllocation(next);
    if (choice && allocation > current.monthlyBudget + .005) throw new Error(`Planning allocation ${money(allocation)} exceeds cycle ceiling ${money(current.monthlyBudget)}. Reduce another budget or raise the ceiling first.`);
    await persist(next);
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
    const favoriteAccounts = favoriteAccountsForHome(state);
    const cards: Record<HomeCardId, React.ReactNode> = {
      daily: (<View style={s.dashCard}>
          <TouchableOpacity style={s.dashHeadRow} onPress={() => toggleCard('daily')}>
            <Text style={s.dashHead}>Daily Summary</Text>
            <Ionicons name={collapsedCards.includes('daily') ? 'chevron-forward' : 'chevron-down'} size={16} color={themed(C.ink, 'color')} />
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
        </View>),
      calendar: (<View style={s.dashCard}>
          <View style={s.calendarHead}>
            <TouchableOpacity style={s.calendarArrow} onPress={() => setCalendarCursor((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>
              <Ionicons name="chevron-back" size={17} color={themed(C.ink, 'color')} />
            </TouchableOpacity>
            <Text style={s.dashHead}>
              {calendarCursor.toLocaleDateString('en-MY', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <TouchableOpacity style={s.calendarArrow} onPress={() => setCalendarCursor((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>
              <Ionicons name="chevron-forward" size={17} color={themed(C.ink, 'color')} />
            </TouchableOpacity>
          </View>
          <View style={s.calendarGrid}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <Text key={label} style={s.calendarWeek}>
                {label}
              </Text>
            ))}
            {calendar.map((day) => (
              <TouchableOpacity key={day.key} onPress={() => openDashboardFilter('day', day.key)} style={[s.calendarDay, day.key === dayKey(today.toISOString()) && s.calendarToday, day.muted && { opacity: appPalette.id === 'cream' ? 0.3 : 1 }]}>
                <Text style={[s.calendarNumber, day.muted && appPalette.id !== 'cream' && { color: homeColor.muted }]}>{day.date.getDate()}</Text>
                <View style={s.calendarDots}>
                  {day.types.has('expense') && <View style={[s.calendarDot, { backgroundColor: themed(C.coral, 'backgroundColor') }]} />}
                  {day.types.has('income') && <View style={[s.calendarDot, { backgroundColor: themed('#18A879', 'backgroundColor') }]} />}
                  {day.types.has('transfer') && <View style={[s.calendarDot, { backgroundColor: themed(C.blue, 'backgroundColor') }]} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.calendarKey}>
            <Text style={s.calendarKeyText}>● Expense</Text>
            <Text style={[s.calendarKeyText, { color: appPalette.id === 'cream' ? themed('#18A879', 'color') : homeColor.income }]}>● Income</Text>
            <Text style={[s.calendarKeyText, { color: appPalette.id === 'cream' ? themed(C.blue, 'color') : homeColor.transfer }]}>● Transfer</Text>
          </View>
        </View>),
      budget: (<View style={s.dashCard}>
          <TouchableOpacity style={s.dashHeadRow} onPress={() => toggleCard('budget')}>
            <Text style={s.dashHead}>Budget Summary</Text>
            <Ionicons name={collapsedCards.includes('budget') ? 'chevron-forward' : 'chevron-down'} size={16} color={themed(C.ink, 'color')} />
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
        </View>),
      favorites: (<View style={s.dashCard}>
          <View style={s.dashHeadRow}>
            <TouchableOpacity onPress={() => toggleCard('favorites')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.dashHead}>Favorite Accounts</Text>
              <Ionicons name={collapsedCards.includes('favorites') ? 'chevron-forward' : 'chevron-down'} size={16} color={themed(C.ink, 'color')} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFavoritesOpen(true)} accessibilityLabel="Choose favorite accounts" style={{ padding: 10 }}>
              <Text style={s.balanceSheetText}>EDIT</Text>
            </TouchableOpacity>
          </View>
          {!collapsedCards.includes('favorites') && (
            <>
              {!favoriteAccounts.length && <Text style={s.reportSectionHint}>No favorite accounts. Tap Edit to choose what appears here.</Text>}
              {favoriteAccounts.map((account) => (
                <TouchableOpacity key={account.id} style={s.favoriteRow} onPress={() => openDashboardFilter('account', account.name)}>
                  <Text style={s.favoriteName}>{account.name}</Text>
                  <Text style={[s.favoriteBalance, account.balance < 0 && { color: appPalette.id === 'cream' ? themed(C.coral, 'color') : homeColor.expense }]}>
                    {account.balance < 0 ? '− ' : ''}
                    {money(account.balance)}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={s.favoriteTotal}>Total: {money(favoriteAccounts.reduce((sum, account) => sum + account.balance, 0))}</Text>
              <TouchableOpacity style={s.balanceSheetButton} onPress={() => navigateSection('accounts')}>
                <Text style={s.balanceSheetText}>BALANCE SHEET</Text>
              </TouchableOpacity>
            </>
          )}
        </View>),
      flow: (<View style={s.dashCard}>
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
                        backgroundColor: appPalette.id === 'cream' ? C.coral : homeColor.expense,
                      },
                    ]}
                  />
                  <View
                    style={[
                      s.cashBar,
                      {
                        height: Math.max(3, (month.incoming / flowMax) * 110),
                        backgroundColor: appPalette.id === 'cream' ? '#18A879' : homeColor.income,
                      },
                    ]}
                  />
                </View>
                <Text style={s.weekLabel}>{month.label}</Text>
              </View>
            ))}
          </View>
        </View>),
      cash: (<View style={s.hero}>
          <Text style={s.kicker}>TRUE CASH AVAILABLE</Text>
          <Text style={[s.heroMoney, trueSpendable < 0 && { color: themed('#FF8069', 'color') }]}>
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
        </View>),
    };
    return <>
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
      <TouchableOpacity disabled={!homeLayoutReady} onPress={() => setHomeLayoutOpen(true)} accessibilityRole="button" accessibilityLabel="Arrange home cards" style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: appPalette.border, borderRadius: 12 }}>
        <Ionicons name="swap-vertical" size={16} color={appPalette.text} /><Text style={{ color: appPalette.text, fontSize: 12, fontWeight: '700' }}>Arrange Home</Text>
      </TouchableOpacity>
      {homeOrder.map(id => <React.Fragment key={id}>{cards[id]}</React.Fragment>)}
    </>;
  };
  const activityHeader = (
    <View style={s.activityHeader}>
      {selectedIds.length > 0 && (
        <TouchableOpacity style={s.selectedTotal} onPress={() => setLedgerSummaryScope('selected')} accessibilityLabel="Show selected transaction totals">
          <Text style={s.selectedTotalText}>
            {selectedTotal < 0 ? '− ' : '+ '}
            {money(selectedTotal)}
          </Text>
          <Text style={s.selectedTotalMeta}>{selectedIds.length} selected · TOTALS →</Text>
        </TouchableOpacity>
      )}
      <View style={s.ledgerTools}>
        <LedgerSearch value={search} onChange={updateLedgerSearch} />
        <TouchableOpacity style={s.filterButton} onPress={() => setFilterOpen(true)}>
          <Ionicons name="options" size={17} color={themed(C.white, 'color')} />
          {(filterTypes.length + filterAccounts.length + filterCategories.length + filterSubcategories.length + (filterDateMode !== 'all' ? 1 : 0)) > 0 && (
            <Text style={{ color: themed(C.white, 'color'), fontSize: 10, fontWeight: '900', marginLeft: 4 }}>{filterTypes.length + filterAccounts.length + filterCategories.length + filterSubcategories.length + (filterDateMode !== 'all' ? 1 : 0)}</Text>
          )}
        </TouchableOpacity>
      </View>
      <View style={s.ledgerPeriodBar}>
        <TouchableOpacity style={s.ledgerPeriodArrow} accessibilityLabel="Previous ledger period" disabled={filterDateMode !== 'month' && (filterDateMode !== 'cycle' || !ledgerCycle || ledgerCycleOffset >= ledgerCycle.count - 1)} onPress={() => changeLedgerPeriod(filterDateMode === 'month' ? 'month' : 'cycle', -1)}>
          <Ionicons name="chevron-back" size={19} color={filterDateMode === 'month' || filterDateMode === 'cycle' && ledgerCycle && ledgerCycleOffset < ledgerCycle.count - 1 ? themed(C.ink, 'color') : themed('#B9B3A8', 'color')} />
        </TouchableOpacity>
        <TouchableOpacity style={s.ledgerPeriodLabel} accessibilityLabel="Choose cycle, month or all dates" onPress={chooseLedgerPeriodMode}>
          <Text style={s.ledgerPeriodMode}>{reportLedgerWindow ? 'REPORT WINDOW · ACTUAL ENTRIES' : filterDateMode === 'cycle' ? 'SALARY CYCLE' : filterDateMode === 'month' ? 'CALENDAR MONTH' : filterDateMode === 'all' ? 'DATE WINDOW' : 'CUSTOM DATES'}</Text>
          <Text style={s.ledgerPeriodTitle} numberOfLines={1}>{filterDateMode === 'cycle' ? ledgerCycle?.month || 'Choose salary source' : filterDateLabel || 'All dates'} <Ionicons name="chevron-down" size={10} color={themed(C.muted, 'color')} /></Text>
          {filterDateMode === 'cycle' && ledgerSalary && <Text style={s.ledgerPeriodMeta} numberOfLines={1}>{ledgerSalary.label} · {filterStartDay} → {filterEndDay}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.ledgerPeriodArrow} accessibilityLabel="Next ledger period" disabled={filterDateMode !== 'month' && (filterDateMode !== 'cycle' || !ledgerCycle || ledgerCycleOffset === 0)} onPress={() => changeLedgerPeriod(filterDateMode === 'month' ? 'month' : 'cycle', 1)}>
          <Ionicons name="chevron-forward" size={19} color={filterDateMode === 'month' || filterDateMode === 'cycle' && ledgerCycle && ledgerCycleOffset > 0 ? themed(C.ink, 'color') : themed('#B9B3A8', 'color')} />
        </TouchableOpacity>
      </View>
      <View style={s.ledgerSummaryLinkRow}>
        <Text style={[s.selectedTotalMeta, { flex: 1 }]}>{matchingLedgerEntries.length} matching transactions{filterDateLabel ? ` · ${filterDateLabel}` : ''}</Text>
        <TouchableOpacity onPress={() => setLedgerSummaryScope('filtered')} style={s.ledgerSummaryButton} accessibilityLabel="Show totals for all matching transactions">
          <Ionicons name="calculator-outline" size={13} color={themed(C.ink, 'color')} /><Text style={s.ledgerSummaryButtonText}>TOTALS</Text>
        </TouchableOpacity>
        {copiedEntries.length > 0 && <TouchableOpacity onPress={() => { Keyboard.dismiss(); setBatchOpen('paste'); }} style={s.ledgerSummaryButton} accessibilityLabel="Paste copied transactions"><Ionicons name="duplicate-outline" size={13} color={themed(C.ink, 'color')} /><Text style={s.ledgerSummaryButtonText}>PASTE ({copiedEntries.length})</Text></TouchableOpacity>}
      </View>
      {selectedIds.length > 0 && (
        <View style={s.selectionBar}>
          <Text style={s.selectionCount}>{selectedIds.length} selected</Text>
          <TouchableOpacity onPress={() => { Keyboard.dismiss(); setBatchOpen('selection'); }}><Text style={s.selectionLink}>ACTIONS</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedIds(matchingLedgerEntries.map((e) => e.id))}>
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
        dateMode: filterDateMode,
        startDay: filterStartDay,
        endDay: filterEndDay,
        dateLabel: filterDateLabel,
        salarySourceKey: filterSalaryKey,
      }}
      accounts={state.accounts.map((entry) => entry.name)}
      categories={state.categories.map((entry) => entry.name)}
      subcategories={[...new Set(state.categories.flatMap((entry) => entry.subcategories))]}
      salarySources={filterSalarySources}
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
  const Categories = () => <><TouchableOpacity style={s.automationCard} onPress={() => setCategoriesOpen(false)}><Ionicons name="arrow-back" size={20} color={themed(C.ink, 'color')}/><Text style={s.automationTitle}>Back to Accounts</Text></TouchableOpacity>
        <Title
          eyebrow="CATEGORIES"
          title="Built around your life."
          action="＋ Category"
          onAction={() => {
            setEditingCategoryId(null);
            setDraftCategoryTypes(['expense']);
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
                }} hitSlop={8}><Ionicons name="create-outline" size={16} color={themed(C.muted, 'color')} /></TouchableOpacity>
              </View>
              {c.subcategories.map((sub) => <TouchableOpacity key={sub} style={s.subcategoryManageRow} onPress={() => {
                setDraftParent(c.name);
                setEditingSubName(sub);
                setDraftCategoryTypes(c.subcategoryTypes?.[sub] || [...new Set(state.entries.filter((entry) => entry.category === c.name && entry.subcategory === sub && entry.type !== 'transfer').map((entry) => entry.type as 'income' | 'expense'))]);
                setDraftSub(sub);
                setDraftIcon(c.subcategoryIcons?.[sub] || inferFinanceIcon(sub, c.name));
                setManageOpen('sub');
              }}><Text style={s.categorySubs}>{sub}</Text><Ionicons name="chevron-forward" size={14} color={themed(C.muted, 'color')} /></TouchableOpacity>)}
            </View>
            <TouchableOpacity
              onPress={() => {
                setDraftParent(c.name);
                setEditingSubName(null);
                setDraftCategoryTypes(['expense']);
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

  </>;
  const Accounts = () => {
    if (categoriesOpen) return Categories();
    const pending = state.entries.filter((e) => e.origin === 'redcoins' && !e.reconciledImportId && !e.exportedAt && (!e.autoGenerated || new Date(e.date).getTime() <= Date.now()));
    const awaiting = [...(state.exportBatches || [])].reverse().find((batch) => !batch.confirmedAt);
    const runExport = async (mode: 'pending' | 'all') => {
      try {
      const batch = await exportRedCoinsCsv(state, mode);
      if (!batch) return;
      await persist({
        ...state,
        exportBatches: [batch, ...(state.exportBatches || [])],
      });
      } catch (error) { Alert.alert('Export unavailable', error instanceof Error ? error.message : String(error)); }
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
        <TouchableOpacity style={s.automationCard} onPress={() => setCategoriesOpen(true)}><View style={{flex:1}}><Text style={s.automationTitle}>Manage categories</Text><Text style={s.automationCopy}>Categories, subcategories and icons</Text></View><Ionicons name="chevron-forward" size={18} color={themed(C.ink, 'color')}/></TouchableOpacity>
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
                <Text style={[s.accountListBalance, a.balance < 0 && { color: themed(C.coral, 'color') }]}>{a.balance < 0 ? '− ' : ''}{money(a.balance)}</Text>
                <TouchableOpacity style={[s.accountEdit, { alignItems: 'center' }]} accessibilityLabel={`Semak ${a.name} dengan bank`} onPress={() => setBankReviewAccountId(a.id)} hitSlop={8}><Ionicons name="checkmark-done-outline" size={19} color={themed("#168A65", 'color')} /><Text style={{ fontSize: 7, fontWeight: '800', color: themed('#168A65', 'color') }}>SEMAK</Text></TouchableOpacity>
                <TouchableOpacity style={s.accountEdit} onPress={() => {
                  setEditingAccountId(a.id);
                  setDraftName(a.name);
                  setDraftType(a.type);
                  setDraftBalance(String(a.balance));
                  setDraftIcon(a.icon || inferFinanceIcon(a.name, a.type));
                  setManageOpen('account');
                }} hitSlop={8}><Ionicons name="create-outline" size={17} color={themed(C.muted, 'color')} /></TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>;
        })}

        <Title eyebrow="DATA BRIDGE" title="RedCoins → Bluecoins." />
        <View style={s.exportCard}>
          <Text style={s.exportTitle}>Weekly hand-off</Text>
          <Text style={s.exportCopy}>{pending.length} new entries since the last confirmed import. Bluecoins baseline history is never exported again.</Text>
          <TouchableOpacity style={s.exportPrimary} onPress={() => runExport('pending')}>
            <Text style={s.exportPrimaryText}>EXPORT {pending.length} NEW ENTRIES</Text>
          </TouchableOpacity>
          {awaiting && (
            <TouchableOpacity style={s.confirmImport} onPress={async () => persist(confirmRedCoinsExport(state, awaiting.id))}>
              <Ionicons name="checkmark-circle" size={17} color={themed(C.ink, 'onAccent')} />
              <Text style={s.confirmImportText}>MARK {awaiting.entryIds.length} AS IMPORTED</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.exportSecondary} onPress={() => runExport('all')}>
            <Text style={s.exportSecondaryText}>EXPORT ALL REDCOINS ENTRIES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.exportSecondary} onPress={() => { void exportRedCoinsBackup(state).catch(error => Alert.alert('Backup failed', error instanceof Error ? error.message : String(error))); }}>
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
              <Text style={[s.exportStatus, batch.confirmedAt && { color: themed('#379B73', 'color') }]}>{batch.confirmedAt ? 'IMPORTED' : 'AWAITING'}</Text>
            </View>
          ))}
          {!state.exportBatches?.length && <Empty text="No export batches yet." />}
        </View>
      </>
    );
  };
  const Plan = () => (
    <>
      {planPage !== 'overview' && <TouchableOpacity style={s.automationCard} onPress={() => setPlanPage('overview')}><Ionicons name="arrow-back" size={20} color={themed(C.ink, 'color')}/><Text style={s.automationTitle}>Back to Plan</Text></TouchableOpacity>}
      {planPage === 'overview' && <>
        <Title eyebrow="PLAN" title="Give every ringgit a job." />
        {([ ['budgets','Budgets',`${money(state.monthlyBudget)} cycle ceiling · ${money(allocatedBudget)} planning allocation`], ['guards','Spending guards',`${bluecoins?.spendingGuards.length || 0} limits watching your spending`], ['automation','Reminders & auto-log',`${state.reminders.filter(r=>r.enabled).length} active schedules · ${detections.length} detected payments to review`] ] as const).map(([page,title,copy]) => <TouchableOpacity key={page} style={s.automationCard} onPress={() => setPlanPage(page)}><View style={{flex:1}}><Text style={s.automationTitle}>{title}</Text><Text style={s.automationCopy}>{copy}</Text></View><Ionicons name="chevron-forward" size={18} color={themed(C.ink, 'color')}/></TouchableOpacity>)}
      </>}
      {planPage === 'automation' && <>
      <Title eyebrow="AUTOMATION" title="Scheduled & detected." />
      <TouchableOpacity style={s.automationCard} onPress={() => setReminderManagerOpen(true)} activeOpacity={0.8}>
        <View style={s.automationIcon}><Ionicons name="repeat" size={21} color={themed(C.ink, 'onAccent')} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>AUTOMATION</Text>
          <Text style={s.automationTitle}>Reminders & Auto-log</Text>
          <Text style={s.automationCopy}>{state.reminders.length ? `${state.reminders.filter((reminder) => reminder.enabled).length} active · ${state.reminders.filter((reminder) => reminder.automaticLog).length} auto-log` : 'Build recurring transactions from the logger.'}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={themed(C.ink, 'color')} />
      </TouchableOpacity>
      <View style={s.detectorCard}>
        <View style={[s.detectorIcon, notificationAccess && { backgroundColor: themed(C.mint, 'backgroundColor') }]}>
          <Ionicons name={notificationAccess ? 'notifications' : 'notifications-off'} size={20} color={themed(C.ink, 'color')} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.detectorTitle}>Transaction detector</Text>
          <Text style={s.detectorCopy}>{notificationAccess ? 'Active · eligible payment alerts are checked locally.' : 'Enable Notification access to catch eligible payments.'}</Text>
        </View>
        <TouchableOpacity style={[s.detectorButton, notificationAccess && { backgroundColor: themed('#DDF1E7', 'backgroundColor') }]} onPress={() => BluecoinsDriveReader?.openNotificationAccessSettingsAsync?.().catch(() => Alert.alert('Unavailable', 'Notification access settings could not be opened on this device.'))}>
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
              <Ionicons name="close-circle" size={20} color={themed(C.muted, 'color')} />
            </TouchableOpacity>
          </View>
        ))}
        {!detections.length && <Text style={s.detectorEmpty}>A matching bank, wallet or SMS notification will appear here before you save it as a transaction.</Text>}
      </View>
      </>}
      {planPage === 'budgets' && <>
      <Title eyebrow="BUDGETS" title="One setup, any period." />
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
                backgroundColor: allocatedBudget > state.monthlyBudget ? themed(C.coral, 'backgroundColor') : themed(C.blue, 'backgroundColor'),
              },
            ]}
          />
        </View>
        <Text style={s.poolHint}>Cycle allocations + active period budgets expressed as monthly equivalents. Custom ranges use a 30.44-day monthly estimate. Conflict targets are not counted twice. This is planning allocation, not an extra expense or cash deduction.</Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Plan controls</Text>
        <Text style={s.poolHint}>{bluecoins?.monthly.salarySourceLabel && bluecoins.monthly.cycleStartInstant ? `Cycle started with ${bluecoins.monthly.salarySourceLabel} · ${new Date(bluecoins.monthly.cycleStartInstant).toLocaleString('en-MY')}. The next cycle starts when the next salary entry arrives.` : 'No salary entry found. Using the configured payday until a Salary/Gaji entry is logged.'}</Text>
        <View style={s.cycleBudgetEdit}>
          <View style={{ flex: 1 }}>
            <Field label="SALARY-CYCLE BUDGET" value={cycleBudgetDraft} onChange={setCycleBudgetDraft} numeric />
          </View>
          <TouchableOpacity style={s.cycleSave} onPress={saveCycleBudget}>
            <Text style={s.cycleSaveText}>UPDATE</Text>
          </TouchableOpacity>
        </View>
        <Field
          label="EXPECTED PAYDAY (1—28)"
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
                  {ICON_LIBRARY.includes(group.icon) ? <Ionicons name={group.icon as any} size={14} color={themed(C.ink, 'color')} /> : group.icon} {group.name}
                </Text>
                <Text style={s.budgetCategoryMeta}>{money(groupSpent)} spent this cycle · allocation is a planning equivalent</Text>
              </View>
              <View style={s.budgetCategoryTotal}>
                <Text style={s.budgetCategoryAmount}>{money(groupBudget)}</Text>
                <Text style={s.budgetCategoryLabel}>MONTHLY PLAN EQ.</Text>
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={themed(C.muted, 'color')} />
            </TouchableOpacity>
            <View style={s.categoryBudgetProgress}>
              <View style={s.subBudgetTrack}>
                <View
                  style={[
                    s.subBudgetFill,
                    {
                      width: `${groupBudget ? Math.min(100, (groupSpent / groupBudget) * 100) : 0}%`,
                      backgroundColor: groupBudget > 0 && groupSpent > groupBudget ? themed(C.coral, 'backgroundColor') : themed(C.blue, 'backgroundColor'),
                    },
                  ]}
                />
              </View>
              <Text style={s.categoryBudgetProgressText}>
                {groupBudget > 0 ? `${Math.round((groupSpent / groupBudget) * 100)}% · ${money(groupSpent)} of ${money(groupBudget)}` : 'No allocation · open a subcategory to set its period'}
              </Text>
            </View>
            {expanded && <TouchableOpacity style={s.subBudgetRow} onPress={() => openBudgetEditor(group.name,'')}><Text style={s.subBudgetName}>Category-wide period budget</Text><Text style={s.subBudgetSpent}>{(state.termBudgets || []).filter(b=>b.category===group.name && !b.subcategory).map(b=>`${money(b.amount)} · ${b.startDay} — ${b.endDay}`).join(' / ') || 'Optional · avoid overlap with subcategory budgets'}</Text></TouchableOpacity>}
            {expanded &&
              group.subcategories.map((sub) => {
                const key = budgetKey(group.name, sub);
                const choices = targetBudgetChoices(state,group.name,sub);
                const period = choices.periods.length === 1 && !choices.conflict && validTermBudget(choices.periods[0]) ? termBudgetSummary(choices.periods[0],state.entries) : null;
                const limit = period?.limit || choices.cycle;
                const used = period?.spent ?? (subcategorySpend[key] || 0);
                const percent = limit ? (used / limit) * 100 : 0;
                const periodLabel = choices.conflict ? 'Overlapping saved budgets · tap to choose one' : period ? `${period.startDay} — ${period.endDay} · ${period.status} · ${money(period.remaining)} left` : 'Salary cycle';
                return (
                  <TouchableOpacity key={sub} style={s.subBudgetRow} onPress={() => openBudgetEditor(group.name, sub)}>
                    <View style={s.subBudgetTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.subBudgetName}>{sub}</Text>
                        <Text style={s.subBudgetSpent}>{periodLabel}</Text><Text style={s.subBudgetSpent}>{money(used)} spent{period && choices.periods[0].reserve ? ` · reserve suggestion ${money(period.monthlyReserve)}/month` : ''}</Text>
                      </View>
                      <Text style={[s.subBudgetLimit, !limit && { color: themed(C.muted, 'color') }]}>{choices.conflict ? 'RESOLVE' : limit ? money(limit) : 'SET BUDGET'}</Text>
                      <Ionicons name="chevron-forward" size={15} color={themed(C.muted, 'color')} />
                    </View>
                    {limit > 0 && !choices.conflict && (
                      <View style={s.subBudgetTrack}>
                        <View
                          style={[
                            s.subBudgetFill,
                            {
                              width: `${Math.min(100, percent)}%`,
                              backgroundColor: percent > 100 ? themed(C.coral, 'backgroundColor') : themed(C.blue, 'backgroundColor'),
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
      {(state.termBudgets || []).filter(b=>!state.categories.some(c=>c.name===b.category && (!b.subcategory || c.subcategories.includes(b.subcategory)))).map(b=><TouchableOpacity key={b.id} style={s.automationCard} onPress={()=>openBudgetEditor(b.category,b.subcategory || '')}><View style={{flex:1}}><Text style={s.automationTitle}>Budget target unavailable</Text><Text style={s.automationCopy}>{b.category} / {b.subcategory || 'whole category'} · {money(b.amount)}. Review/remove this saved setup, then recreate under a current target.</Text></View><Ionicons name="chevron-forward" size={18} color={themed(C.coral, 'color')}/></TouchableOpacity>)}
      <View style={s.card}>
        <Text style={s.cardTitle}>Cash reality</Text>
        <Text style={s.realityLabel}>TRUE CASH AVAILABLE</Text>
        <Text style={[s.realityNumber, trueSpendable < 0 && { color: themed(C.coral, 'color') }]}>
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
            <Ionicons name={candidate.selected ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={candidate.selected ? themed(C.ink, 'color') : themed(C.muted, 'color')} />
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
        }}><Ionicons name={option.selected ? 'checkbox' : 'square-outline'} size={18} color={option.selected ? themed(C.coral, 'color') : themed(C.muted, 'color')} /><View style={{flex: 1}}><Text style={s.cashSelectName}>{option.label}</Text><Text style={s.guardMeta}>Last paid {option.lastUsed}</Text></View><Text style={s.cashSelectAmount}>{money(option.lastAmount)}</Text></TouchableOpacity>)}
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
              <Ionicons name={commitment.status === 'paid' ? 'checkmark' : 'time-outline'} size={13} color={commitment.status === 'paid' ? themed('#168A65', 'color') : themed(C.coral, 'color')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.expectedName}>{commitment.label.split(' | ').pop()}</Text>
              <Text style={s.expectedMeta}>
                {commitment.label.split(' | ')[0]} · last paid {commitment.lastUsed}
              </Text>
            </View>
            <View style={s.expectedAmounts}>
              <Text style={s.expectedAmount}>{money(commitment.expectedAmount)}</Text>
              <Text style={[s.expectedState, commitment.status === 'paid' && { color: themed('#168A65', 'color') }]}>{commitment.status === 'paid' ? `PAID ${money(commitment.currentAmount)}` : 'DUE'}</Text>
            </View>
          </View>
        ))}
        {!bluecoins?.monthly.expectedFixedCommitments.items.length && <Empty text="Pick recurring items in Budget Coach to build this list." />}
      </View>
      </>}
      {planPage === 'guards' && <>
      <Title eyebrow="SPENDING GUARDS" title="Boundaries before regret." action="＋ GUARD" onAction={() => { setGuardDraft({ name: '', scope: 'account', target: bluecoins?.guardOptions.accounts[0] || '', limit: '' }); setGuardEditorOpen(true); }} />
      <View style={s.guardList}>
        {bluecoins?.spendingGuards.map((guard) => (
          <View key={guard.id} style={s.guardCardRow}>
          <TouchableOpacity style={s.guardRow} onPress={() => { setExpandedGuardPart(null); setExpandedGuardId((value) => value === guard.id ? null : guard.id); }} activeOpacity={0.8}>
            <View style={[s.guardDot, { backgroundColor: guard.level === 'breached' || guard.level === 'slow-down' ? themed(C.coral, 'backgroundColor') : guard.level === 'heads-up' ? themed(C.gold, 'backgroundColor') : themed(C.mint, 'backgroundColor') }]} />
            <View style={{ flex: 1 }}>
              <View style={s.guardLine}><Text style={s.guardName}>{guard.name}</Text><Text style={s.guardPercent}>{guard.percent.toFixed(0)}%</Text></View>
              <Text style={s.guardMeta}>{guard.scope.toUpperCase()} · {money(guard.spent)} / {money(guard.limit)}</Text>
              <View style={s.budgetTrack}><View style={[s.budgetFill, { width: `${Math.min(100, guard.percent)}%` }]} /></View>
            </View>
            <TouchableOpacity onPress={(event) => { event.stopPropagation(); setGuardDraft({ id: guard.id, name: guard.name, scope: guard.scope, target: guard.target, limit: String(guard.limit) }); setGuardEditorOpen(true); }}><Ionicons name="create-outline" size={17} color={themed(C.muted, 'color')} /></TouchableOpacity>
          </TouchableOpacity>
            {expandedGuardId === guard.id && <View style={s.guardDetails}>
              <Text style={s.guardDetailsTitle}>WHERE IT WENT</Text>
              {guard.breakdown.map((part) => <View key={part.name}><TouchableOpacity style={s.guardDetailRow} onPress={() => setExpandedGuardPart((value) => value === part.name ? null : part.name)}><Text style={s.guardDetailName}>{part.name}</Text><Text style={s.guardDetailAmount}>{money(part.amount)} · {part.share.toFixed(0)}%</Text><Ionicons name={expandedGuardPart === part.name ? 'chevron-up' : 'chevron-down'} size={13} color={themed(C.muted, 'color')} /></TouchableOpacity>
                {expandedGuardPart === part.name && guard.transactions.filter((charge) => guard.scope === 'subcategory' ? charge.itemName === part.name : charge.subcategory === part.name).map((charge, index) => <View key={`${charge.itemName}-${index}`} style={s.guardChargeRow}><View style={{flex: 1}}><Text style={s.guardDetailName}>{charge.itemName}</Text><Text style={s.guardMeta}>{charge.date} · {charge.category} / {charge.subcategory}</Text></View><Text style={s.guardDetailAmount}>{money(charge.amount)}</Text></View>)}
              </View>)}
            </View>}
          </View>
        ))}
        {!bluecoins?.spendingGuards.length && <Empty text="No spending guard configured yet." />}
      </View>
      </>}
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
          <TouchableOpacity disabled={report.safeOffset >= report.maxOffset} onPress={(event) => { event.stopPropagation(); setReportCycleOffset((value) => Math.min(report.maxOffset, value + 1)); }} style={[s.reportArrow, report.safeOffset >= report.maxOffset && s.reportArrowDisabled]}><Ionicons name="chevron-back" size={17} color={themed(C.ink, 'color')} /></TouchableOpacity>
          <Text style={s.reportCycleNavText}>{report.safeOffset === 0 ? 'LATEST CYCLE' : `${report.safeOffset} CYCLE${report.safeOffset > 1 ? 'S' : ''} AGO`}</Text>
          <TouchableOpacity disabled={report.safeOffset === 0} onPress={(event) => { event.stopPropagation(); setReportCycleOffset((value) => Math.max(0, value - 1)); }} style={[s.reportArrow, report.safeOffset === 0 && s.reportArrowDisabled]}><Ionicons name="chevron-forward" size={17} color={themed(C.ink, 'color')} /></TouchableOpacity>
        </View>}
      </TouchableOpacity>

      <View style={s.grid}>
        <Stat label="INCOME" value={report.income} color={themed("#168A65", 'color')} onPress={() => openReportMetricLedger('income')} />
        <Stat label="EXPENSE" value={report.expense} color={themed(C.coral, 'color')} onPress={() => openReportMetricLedger('expense')} />
        <Stat label="NET RETAINED" value={report.net} color={report.net >= 0 ? themed(C.blue, 'color') : themed(C.coral, 'color')} />
      </View>
      <View style={s.reportFacts}>
        <TouchableOpacity style={s.reportFact} accessibilityRole="button" accessibilityLabel="Show report transfers in ledger" onPress={() => openReportMetricLedger('transfer')}><Text style={s.reportFactLabel}>TRANSFERS ↗</Text><Text style={s.reportFactValue}>{money(report.transfer)}</Text></TouchableOpacity>
        <View style={s.reportFact}><Text style={s.reportFactLabel}>TRANSACTIONS</Text><Text style={s.reportFactValue}>{report.rows.length}</Text></View>
        <View style={s.reportFact}><Text style={s.reportFactLabel}>SCHEDULED</Text><Text style={s.reportFactValue}>{report.scheduledRows.length}</Text></View>
      </View>

      {reportAnalysisScope && <RedCoinsAnalysis state={state} scope={reportAnalysisScope} classify={async (key, value) => { const current = await loadRedCoins(); await persist({ ...current, analysisExpenseClasses: { ...current.analysisExpenseClasses, [key]: value } }); }} inspect={editEntry} openSubcategory={openAnalysisSubcategoryLedger} />}
      <TouchableOpacity style={s.card} onPress={() => setAiPromptOpen(true)} activeOpacity={0.8}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><Text style={s.eyebrow}>AI HANDOFF</Text><Text style={s.cardTitle}>A second look at your spending.</Text><Text style={s.reportSectionHint}>Generate a prompt for this report · choose a realistic 5–25% reduction scenario · copy or save.</Text></View><Ionicons name="document-text-outline" size={24} color={themed(C.ink, 'color')} /></View>
      </TouchableOpacity>

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
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={themed(C.muted, 'color')} />
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
        {report.accountMovement.map(([name, movement]) => <View key={name} style={s.reportAccountRow}><View style={{ flex: 1 }}><Text style={s.reportName}>{name}</Text><Text style={s.reportChargeMeta}>In {money(movement.incoming)} · Out {money(movement.outgoing)}</Text></View><Text style={[s.reportAccountNet, { color: movement.incoming - movement.outgoing >= 0 ? themed('#168A65', 'color') : themed(C.coral, 'color') }]}>{movement.incoming - movement.outgoing >= 0 ? '+' : '− '}{money(movement.incoming - movement.outgoing)}</Text></View>)}
        {!report.accountMovement.length && <Empty text="No account movement in this period." />}
      </View>
    </>
  ) : null;

  return (
    <SafeAreaView style={s.safe}>
      <RedCoinsSetup defaults={state} visible={isFocused && needsRedCoinsSetup(state)} onBluecoins={() => navigation.navigate('Settings', { redcoinsImport: true })}
        onSaved={(current, firstEntry) => {
          setState(current);
          setCycleBudgetDraft(String(current.monthlyBudget)); setPaydayDraft(String(current.payday));
          void refreshLiveBluecoins(current).catch(console.warn);
          void refreshLeanLogWidget().catch(console.warn);
          if (firstEntry) navigation.setParams({ mode: route?.params?.mode || 'expense' });
        }} />
      <View style={s.header}>
        <TouchableOpacity onPress={goBackInsideRedCoins} style={s.back}>
          <Ionicons name="arrow-back" size={21} color={themed(C.ink, 'color')} />
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
            <RedCoinsLedgerList
              entries={matchingLedgerEntries}
              filterKey={ledgerFilterKey}
              renderEntry={(entry) => <EntryRow entry={entry} icon={iconForEntry(entry)} accountBalance={entryBalanceById.get(entry.id)} selected={selectedSet.has(entry.id)} onPress={selectedIds.length ? () => toggleSelected(entry) : () => editEntry(entry)} onLong={() => toggleSelected(entry)} />}
              renderDay={(section) => (
                <View style={s.ledgerDate}>
                  <Text style={s.ledgerDateText} numberOfLines={1}>{section.title}</Text>
                  <Text style={[s.ledgerDayTotal, section.total > 0 && { color: themed('#168A65', 'color') }]} numberOfLines={1}>
                    {section.total > 0 ? '+' : section.total < 0 ? '− ' : ''}
                    {money(section.total)}
                  </Text>
                </View>
              )}
              extraData={ledgerExtraData}
              empty={<Empty text="No matching RedCoins entries." />}
              contentStyle={s.ledgerContent}
              emptyStyle={s.emptyLedger}
            />
          </View>
        </View>
      ) : (
        <ScrollView key={`${section}-${section === 'plan' ? planPage : section === 'accounts' ? categoriesOpen : ''}`} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {section === 'home' ? Home() : section === 'accounts' ? Accounts() : section === 'plan' ? Plan() : Reports()}
        </ScrollView>
      )}
      {filterModal}
      <RedCoinsBankReviewModal account={state.accounts.find(account => account.id === bankReviewAccountId) || null} state={state} close={() => setBankReviewAccountId(null)} save={async (accountId, review) => {
        const current = await loadRedCoins();
        if (!current.accounts.some(account => account.id === accountId)) throw new Error('Account no longer exists');
        await persist({ ...current, bankReviews: { ...current.bankReviews, [accountId]: review } });
      }} />
      <RedCoinsHomeLayoutModal visible={homeLayoutOpen} order={homeOrder} close={() => setHomeLayoutOpen(false)} save={async (order) => {
        const next = normalizeHomeOrder(order);
        await AsyncStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(next));
        setHomeOrder(next);
      }} />
      <FavoriteAccountsModal visible={favoritesOpen} state={state} close={() => setFavoritesOpen(false)} save={async (ids) => {
        // Read latest durable state so changing card preferences cannot overwrite a transaction.
        const current = await loadRedCoins();
        await persist({ ...current, favoriteAccountIds: ids });
        setFavoritesOpen(false);
      }} />
      <RedCoinsBatchModal visible={batchOpen !== null} state={state} entries={state.entries.filter(entry => selectedSet.has(entry.id))} copiedCount={copiedEntries.length} pasteOnly={batchOpen === 'paste'} busy={batchBusy} close={() => { if (!batchLock.current) setBatchOpen(null); }} apply={reviewBatch} copy={() => { void copyBatchSelection(); }} paste={reviewPaste} />
      <LedgerTotalsModal visible={ledgerSummaryScope !== null} scope={ledgerSummaryScope === 'selected' ? 'Selected transactions' : 'Matching transactions'} summary={ledgerSummaryScope === 'selected' ? selectedLedgerSummary : filteredLedgerSummary} close={() => setLedgerSummaryScope(null)} />
      {reportPeriodModal}
      {reportAnalysisScope && <RedCoinsAiPromptModal visible={aiPromptOpen} state={state} scope={reportAnalysisScope} close={() => setAiPromptOpen(false)} />}
      <Modal visible={reminderManagerOpen} animationType="slide" onRequestClose={() => setReminderManagerOpen(false)}>
        <SafeAreaView style={s.reminderScreen}>
          <View style={s.reminderHeader}>
            <TouchableOpacity style={s.back} onPress={() => setReminderManagerOpen(false)}><Ionicons name="arrow-back" size={21} color={themed(C.ink, 'color')} /></TouchableOpacity>
            <View style={{ flex: 1 }}><Text style={s.eyebrow}>REDCOINS AUTOMATION</Text><Text style={s.reminderScreenTitle}>Reminders & Auto-log.</Text></View>
            <TouchableOpacity style={s.reminderAdd} onPress={() => { setReminderManagerOpen(false); createReminderSchedule(); }}><Ionicons name="add" size={20} color={themed(C.white, 'color')} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.reminderScreenBody} showsVerticalScrollIndicator={false}>
            <View style={s.reminderExplainer}><Text style={s.reminderExplainerTitle}>One schedule, two behaviours.</Text><Text style={s.reminderExplainerCopy}>Reminder-only waits for your confirmation. Auto-log records the transaction when due. Both notify you.</Text>
              {Platform.OS === 'android' && <TouchableOpacity onPress={() => { void BluecoinsDriveReader?.openRedCoinsAlarmSettingsAsync?.(); }}><Text style={s.reminderExplainerCopy}>{exactAlarmsAllowed ? 'Precise alarms enabled' : 'Precise alarms disabled — tap to enable. Notifications may be delayed; auto-log syncs on reopen.'}</Text></TouchableOpacity>}
              {Platform.OS === 'android' && <TouchableOpacity onPress={() => { void Linking.openSettings(); }}><Text style={s.reminderExplainerCopy}>{reminderNotificationsAllowed ? 'Notifications enabled' : 'Notifications disabled — tap to allow in app settings.'}</Text></TouchableOpacity>}
            </View>
            {reminderCards.map(({ reminder, missing, nextDue, projection, invalidAmount }) => {
              const frequency = `${reminder.repeatEvery > 1 ? `Every ${reminder.repeatEvery} ` : 'Every '}${reminder.frequency.replace('daily', 'day').replace('weekly', 'week').replace('monthly', 'month').replace('yearly', 'year')}`;
              const canLogNow = !!pendingReminderOccurrence(state, reminder) && missing.length === 0 && !invalidAmount;
              return <View key={reminder.id} style={s.reminderFullCard}>
                <View style={s.reminderRow}>
                  <View style={[s.reminderMark, { backgroundColor: reminder.automaticLog ? themed(C.mint, 'backgroundColor') : themed(C.gold, 'backgroundColor') }]}><Ionicons name={reminder.automaticLog ? 'flash' : 'notifications'} size={15} color={themed(C.ink, 'color')} /></View>
                  <View style={{ flex: 1 }}><Text style={s.reminderName}>{reminder.template.item}</Text><Text style={s.reminderMeta}>{frequency} · {reminder.automaticLog ? 'auto-log' : 'reminder only'}</Text><Text style={s.reminderMeta}>{money(reminder.template.amount)} · {reminder.template.account}</Text></View>
                  <View style={[s.reminderState, !reminder.enabled && s.reminderStatePaused]}><Text style={s.reminderStateText}>{reminder.enabled ? 'ACTIVE' : 'PAUSED'}</Text></View>
                </View>
                <View style={s.reminderDue}><Text style={s.reminderDueLabel}>NEXT DUE</Text><Text style={s.reminderDueValue}>{nextDue ? nextDue.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : reminder.enabled ? 'Series complete' : 'Paused'}</Text></View>
                {projection && <View style={{ backgroundColor: themed(C.cream, 'backgroundColor'), padding: 11, borderRadius: 13, marginBottom: 8 }}>
                  <Text style={s.reminderDueLabel}>PROJECTED BALANCE AFTER DUE</Text>
                  <Text style={[s.reminderName, { marginTop: 5, color: projection.source < 0 ? themed(C.coral, 'color') : themed(C.ink, 'color') }]}>{reminder.template.account} · {projection.source < 0 ? '− ' : ''}{money(projection.source)}</Text>
                  {projection.destination !== null && <Text style={[s.reminderMeta, { color: projection.destination < 0 ? themed(C.coral, 'color') : themed('#168A65', 'color') }]}>{reminder.template.toAccount} · {projection.destination < 0 ? '− ' : ''}{money(projection.destination)}</Text>}
                  <Text style={s.reminderMeta}>Assumes all active schedules happen, including earlier repeats and reminder-only entries; includes unapplied future ledger entries. Not your live balance.</Text>
                </View>}
                {invalidAmount && <Text style={[s.reminderMeta, { color: themed(C.coral, 'color') }]}>Fix the amount before a balance can be projected.</Text>}
                {missing.length > 0 && <Text style={[s.reminderMeta, { color: themed(C.coral, 'color') }]}>Needs repair: missing {missing.join(', ')}. Auto-log is blocked until you edit the accounts.</Text>}
                {(() => {
                  const last = state.entries.filter((entry) => entry.reminderSeriesId === reminder.id && entry.loggedAt).sort((a, b) => b.loggedAt!.localeCompare(a.loggedAt!))[0];
                  return last ? <Text style={s.reminderMeta}>Last {last.autoGenerated ? 'auto-log' : 'manual log'}: {new Date(last.loggedAt!).toLocaleString('en-MY')} · scheduled {new Date(last.scheduledFor || last.date).toLocaleString('en-MY')}</Text> : null;
                })()}
                <View style={s.reminderControls}>
                  <TouchableOpacity disabled={!canLogNow} style={[s.reminderControlPrimary, !canLogNow && { opacity: .4 }]} onPress={() => logReminderNow(reminder)}><Text style={s.reminderControlPrimaryText}>LOG NOW</Text></TouchableOpacity>
                  <TouchableOpacity style={s.reminderControl} onPress={() => { setReminderManagerOpen(false); editReminderSchedule(reminder); }}><Ionicons name="create-outline" size={14} color={themed(C.ink, 'color')} /><Text style={s.reminderControlText}>EDIT</Text></TouchableOpacity>
                  <TouchableOpacity style={s.reminderControl} onPress={() => toggleReminder(reminder)}><Ionicons name={reminder.enabled ? 'pause' : 'play'} size={14} color={themed(C.ink, 'color')} /><Text style={s.reminderControlText}>{reminder.enabled ? 'PAUSE' : 'RESUME'}</Text></TouchableOpacity>
                  <TouchableOpacity style={s.reminderControlDanger} onPress={() => deleteReminderSeries(reminder)}><Ionicons name="trash-outline" size={14} color={themed(C.coral, 'color')} /></TouchableOpacity>
                </View>
              </View>;
            })}
            {!state.reminders.length && <View style={s.reminderEmpty}><Ionicons name="repeat-outline" size={30} color={themed(C.muted, 'color')} /><Text style={s.reminderEmptyTitle}>Nothing scheduled yet.</Text><Text style={s.reminderExplainerCopy}>Create a transaction, open Repeat, then choose reminder-only or auto-log.</Text></View>}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <View style={s.nav}>
        {(['home', 'activity', 'accounts', 'plan', 'reports'] as Section[]).map((name) => (
          <TouchableOpacity key={name} style={[s.navButton, section === name && s.navActive]} onPress={() => navigateSection(name)}>
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
              color={section === name ? themed(C.white, 'color') : themed('#8993A6', 'color')}
            />
            <Text style={[s.navText, section === name && { color: themed(C.white, 'color') }]}>{name[0].toUpperCase() + name.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <EntryModal
        visible={entryOpen}
        editing={!!editingEntryId}
        schedulingOnly={schedulingOnly}
        editingSchedule={!!editingReminderId}
        onDelete={deleteEditingEntry}
        close={() => { if (receiptBusy || entrySaveLock.current) return; void discardReceiptDrafts(receiptDrafts).catch(console.warn); setReceiptDrafts([]); setEntryOpen(false); setSchedulingOnly(false); setEditingReminderId(null); }}
        receiptEntry={editingEntryId ? state.entries.find(row => row.id === editingEntryId) : undefined}
        receiptDrafts={receiptDrafts}
        setReceiptDrafts={setReceiptDrafts}
        receiptBusy={receiptBusy}
        setReceiptBusy={setReceiptBusy}
        {...{
          item,
          setItem,
          amount,
          setAmount,
          type,
          incomePeriod,
          setIncomePeriod,
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
          repeatEvery,
          setRepeatEvery,
          reminderEndType,
          setReminderEndType,
          reminderEndDate,
          setReminderEndDate,
          reminderOccurrences,
          setReminderOccurrences,
          automaticLog,
          setAutomaticLog,
          excludeWeekend,
          setExcludeWeekend,
          weekendMove,
          setWeekendMove,
          advanced,
          setAdvanced,
          suggestions,
          chooseSuggestion,
          saveEntry,
          saving: entrySaving,
          entryDate,
          setEntryDate,
          state,
        }}
      />
      <RedCoinsBudgetEditor target={budgetEditor} state={state} close={() => setBudgetEditor(null)} save={saveBudgetSetup} />
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
          draftCategoryTypes,
          setDraftCategoryTypes,
          draftSub,
          setDraftSub,
          draftParent,
          draftIcon,
          setDraftIcon,
        }}
        save={async () => {
          const next = {
            ...state,
            accounts: state.accounts.map(account => ({ ...account })),
            categories: state.categories.map((c) => ({
              ...c,
              subcategories: [...c.subcategories],
            })),
            deletedAccountNames: [...(state.deletedAccountNames || [])],
            deletedCategoryNames: [...(state.deletedCategoryNames || [])],
            deletedSubcategories: Object.fromEntries(Object.entries(state.deletedSubcategories || {}).map(([key, values]) => [key, [...values]])),
          };
          if (manageOpen === 'account') {
            if (!draftName.trim()) return;
            const existing = next.accounts.find((entry) => entry.id === editingAccountId);
            if (existing) {
              const oldName = existing.name;
              existing.name = draftName.trim(); existing.type = draftType; existing.balance = Number(draftBalance) || 0; existing.icon = draftIcon;
              existing.editedAt = new Date().toISOString();
              next.entries = next.entries.map((entry) => ({ ...entry, account: entry.account === oldName ? existing.name : entry.account, toAccount: entry.toAccount === oldName ? existing.name : entry.toAccount }));
              next.reminders = next.reminders.map(reminder => ({ ...reminder, template: { ...reminder.template, account: reminder.template.account === oldName ? existing.name : reminder.template.account, toAccount: reminder.template.toAccount === oldName ? existing.name : reminder.template.toAccount } }));
              next.entryDefaults = Object.fromEntries(Object.entries(next.entryDefaults || {}).map(([type, defaults]) => [type, { ...defaults, account: defaults?.account === oldName ? existing.name : defaults?.account, toAccount: defaults?.toAccount === oldName ? existing.name : defaults?.toAccount }]));
              await migrateAccountPreferences({ [oldName.trim().toLocaleLowerCase()]: existing.name }, {});
            } else {
              next.accounts.push({
                id: `${Date.now()}`,
                name: draftName.trim(),
                type: draftType,
                balance: Number(draftBalance) || 0,
                icon: draftIcon,
              });
              next.deletedAccountNames = next.deletedAccountNames.filter((name) => name.toLocaleLowerCase() !== draftName.trim().toLocaleLowerCase());
            }
          } else if (manageOpen === 'category') {
            if (!draftCategory.trim() || (!editingCategoryId && !draftSub.trim())) return;
            if (!editingCategoryId && !draftCategoryTypes.length) return Alert.alert('Choose a type', 'Select expense, income, or both.');
            const existing = next.categories.find((entry) => entry.id === editingCategoryId);
            if (existing) {
              const oldName = existing.name; existing.name = draftCategory.trim(); existing.icon = draftIcon;
              next.entries = next.entries.map((entry) => entry.category === oldName && existing.name !== oldName ? { ...entry, category: existing.name, editedAt: new Date().toISOString() } : entry);
              if (existing.name !== oldName) next.deletedCategoryNames.push(oldName);
              const budgets: Record<string, number> = {};
              Object.entries(next.subcategoryBudgets).forEach(([key, value]) => { const [cat, sub] = key.split('\u0000'); budgets[budgetKey(cat === oldName ? existing.name : cat, sub)] = value; });
              next.subcategoryBudgets = budgets;
              next.termBudgets = (next.termBudgets || []).map(b => b.category === oldName ? { ...b, category: existing.name } : b);
            } else {
              next.categories.push({
                id: `${Date.now()}`,
                name: draftCategory.trim(),
                icon: draftIcon,
                subcategories: [draftSub.trim()],
                subcategoryIcons: { [draftSub.trim()]: draftIcon },
                subcategoryTypes: { [draftSub.trim()]: draftCategoryTypes },
              });
              next.deletedCategoryNames = next.deletedCategoryNames.filter((name) => name.toLocaleLowerCase() !== draftCategory.trim().toLocaleLowerCase());
            }
          } else {
            const parent = next.categories.find((c) => c.name === draftParent);
            if (!parent || !draftSub.trim()) return;
            if (!draftCategoryTypes.length) return Alert.alert('Choose a type', 'Select expense, income, or both for this subcategory.');
            const types = { ...parent.subcategoryTypes };
            if (editingSubName) delete types[editingSubName];
            types[draftSub.trim()] = draftCategoryTypes;
            parent.subcategoryTypes = types;
            if (editingSubName) {
              parent.subcategories = parent.subcategories.map((sub) => sub === editingSubName ? draftSub.trim() : sub);
              next.entries = next.entries.map((entry) => entry.category === parent.name && entry.subcategory === editingSubName ? { ...entry, subcategory: draftSub.trim(), editedAt: new Date().toISOString() } : entry);
              if (editingSubName !== draftSub.trim()) {
                const categoryKey = parent.name.trim().toLocaleLowerCase();
                next.deletedSubcategories[categoryKey] = [...new Set([...(next.deletedSubcategories[categoryKey] || []), editingSubName])];
              }
              const oldKey = budgetKey(parent.name, editingSubName); const newKey = budgetKey(parent.name, draftSub.trim());
              if (next.subcategoryBudgets[oldKey] != null) { next.subcategoryBudgets[newKey] = next.subcategoryBudgets[oldKey]; delete next.subcategoryBudgets[oldKey]; }
              next.termBudgets = (next.termBudgets || []).map(b => b.category === parent.name && b.subcategory === editingSubName ? { ...b, subcategory: draftSub.trim() } : b);
              const icons = { ...(parent.subcategoryIcons || {}) }; delete icons[editingSubName]; icons[draftSub.trim()] = draftIcon; parent.subcategoryIcons = icons;
            } else if (!parent.subcategories.includes(draftSub.trim())) {
              parent.subcategories.push(draftSub.trim()); parent.subcategoryIcons = { ...(parent.subcategoryIcons || {}), [draftSub.trim()]: draftIcon };
              const categoryKey = parent.name.trim().toLocaleLowerCase();
              next.deletedSubcategories[categoryKey] = (next.deletedSubcategories[categoryKey] || []).filter((name) => name.toLocaleLowerCase() !== draftSub.trim().toLocaleLowerCase());
            }
          }
          await persist(next);
          setLedgerRevision((value) => value + 1);
          setManageOpen(null);
          setEditingAccountId(null); setEditingCategoryId(null); setEditingSubName(null);
        }}
        remove={async () => {
          const account = manageOpen === 'account' ? state.accounts.find((item) => item.id === editingAccountId) : undefined;
          const category = manageOpen === 'category' ? state.categories.find((item) => item.id === editingCategoryId) : undefined;
          const parent = manageOpen === 'sub' ? state.categories.find((item) => item.name === draftParent) : undefined;
          const label = account?.name || category?.name || editingSubName || '';
          if (!label) return;
          const usedBySchedules = state.reminders.some((reminder) => manageOpen === 'account'
            ? reminder.template.account === label || reminder.template.toAccount === label
            : manageOpen === 'category'
              ? reminder.template.category === label
              : reminder.template.category === parent?.name && reminder.template.subcategory === label);
          if (usedBySchedules) {
            Alert.alert(
              `Can't delete ${manageOpen === 'sub' ? 'subcategory' : manageOpen}`,
              `${label} is still used by a scheduled transaction. Edit or remove that automation first. Existing ledger history does not block deletion.`,
            );
            return;
          }
          const historyCount = account ? state.entries.filter(entry => entry.account === label || entry.toAccount === label).length : 0;
          Alert.alert(`Delete ${manageOpen === 'sub' ? 'subcategory' : manageOpen}?`, `${label} will be removed from future selection. ${account ? `${historyCount} linked ledger transactions will NOT be deleted. Delete those separately in Activity if intended.` : 'Existing ledger transactions will remain intact.'}`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
              const next: RedCoinsState = {
                ...state,
                accounts: state.accounts.map((item) => ({ ...item })),
                categories: state.categories.map((item) => ({ ...item, subcategories: [...item.subcategories], subcategoryIcons: { ...(item.subcategoryIcons || {}) } })),
                subcategoryBudgets: { ...state.subcategoryBudgets },
                deletedAccountNames: [...(state.deletedAccountNames || [])],
                deletedSourceAccountIds: [...(state.deletedSourceAccountIds || [])],
                deletedCategoryNames: [...(state.deletedCategoryNames || [])],
                deletedSubcategories: Object.fromEntries(Object.entries(state.deletedSubcategories || {}).map(([key, values]) => [key, [...values]])),
              };
              if (manageOpen === 'account' && editingAccountId) {
                if (account?.sourceAccountId && !next.deletedSourceAccountIds!.includes(account.sourceAccountId)) next.deletedSourceAccountIds!.push(account.sourceAccountId);
                next.accounts = next.accounts.filter((item) => item.id !== editingAccountId);
                if (!next.deletedAccountNames!.some((name) => name.toLocaleLowerCase() === label.toLocaleLowerCase())) next.deletedAccountNames!.push(label);
              } else if (manageOpen === 'category' && editingCategoryId) {
                const removed = next.categories.find((item) => item.id === editingCategoryId);
                next.categories = next.categories.filter((item) => item.id !== editingCategoryId);
                if (!next.deletedCategoryNames!.some((name) => name.toLocaleLowerCase() === label.toLocaleLowerCase())) next.deletedCategoryNames!.push(label);
                if (removed) Object.keys(next.subcategoryBudgets).forEach((key) => { if (key.startsWith(`${removed.name}\u0000`)) delete next.subcategoryBudgets[key]; });
              } else if (manageOpen === 'sub' && parent && editingSubName) {
                const target = next.categories.find((item) => item.id === parent.id);
                if (target) {
                  target.subcategories = target.subcategories.filter((item) => item !== editingSubName);
                  delete target.subcategoryIcons?.[editingSubName];
                  delete next.subcategoryBudgets[budgetKey(target.name, editingSubName)];
                  const categoryKey = target.name.trim().toLocaleLowerCase();
                  const deleted = next.deletedSubcategories![categoryKey] || [];
                  if (!deleted.some((name) => name.toLocaleLowerCase() === editingSubName.toLocaleLowerCase())) next.deletedSubcategories![categoryKey] = [...deleted, editingSubName];
                }
              }
              await persist(next);
              setLedgerRevision((value) => value + 1);
              setManageOpen(null);
              setEditingAccountId(null); setEditingCategoryId(null); setEditingSubName(null);
            } },
          ]);
        }}
      />
      <GuardModal visible={guardEditorOpen} draft={guardDraft} setDraft={setGuardDraft} options={bluecoins?.guardOptions} close={() => setGuardEditorOpen(false)} remove={guardDraft.id ? async () => {
        await saveSpendingGuards((bluecoins?.spendingGuards || []).filter((guard) => guard.id !== guardDraft.id));
        await refreshLiveBluecoins();
        setGuardEditorOpen(false);
      } : undefined} save={async () => {
        const value = Math.max(0, Number(guardDraft.limit) || 0);
        if (!guardDraft.name.trim() || !guardDraft.target || !value) return Alert.alert('Guard incomplete', 'Add a name, target and limit.');
        const guards: SpendingGuard[] = (bluecoins?.spendingGuards || []).map(({ spent, remaining: _r, percent: _p, projected: _pr, level: _l, cycleStart: _cs, cycleEnd: _ce, transactions: _t, breakdown: _b, ...guard }) => guard);
        const next: SpendingGuard = { id: guardDraft.id || `guard_${Date.now()}`, name: guardDraft.name.trim(), scope: guardDraft.scope, target: guardDraft.target, limit: value, cycle: 'salary', thresholds: [50, 70, 85, 100], tone: 'normal', enabled: true };
        const index = guards.findIndex((guard) => guard.id === next.id); if (index >= 0) guards[index] = next; else guards.push(next);
        await saveSpendingGuards(guards);
        await refreshLiveBluecoins();
        setGuardEditorOpen(false);
      }} />
    </SafeAreaView>
  );
}

function BudgetDonut({ segments, spent }: { segments: { name: string; value: number; color: string; percent: number }[]; spent: number }) {
  const themedStyles = useThemeStyles(baseS);
  const { themed, palette } = useTheme();
  const s = useMemo(() => applyHomeAppearance(themedStyles, palette), [themedStyles, palette]);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <View style={s.donutWrap}>
      <Svg width={108} height={108} viewBox="0 0 108 108">
        <Circle cx="54" cy="54" r={radius} stroke={themed("#DED7CC", 'color')} strokeWidth="18" fill="none" />
        {segments.map((segment) => {
          const length = spent ? (segment.value / spent) * circumference : 0;
          const dashOffset = -offset;
          offset += length;
          return <Circle key={segment.name} cx="54" cy="54" r={radius} stroke={segment.color} strokeWidth="18" fill="none" strokeDasharray={`${length} ${circumference}`} strokeDashoffset={dashOffset} rotation="-90" origin="54,54" />;
        })}
      </Svg>
      <View style={s.donutCenter}>
        <Text typographyRole="body" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[s.donutValue, { maxWidth: 86 }]}>{money(spent)}</Text>
        <Text style={s.donutLabel}>SPENT</Text>
      </View>
    </View>
  );
}
function Title({ eyebrow, title, action, onAction }: any) {
  const s = useThemeStyles(baseS);
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
  const s = useThemeStyles(baseS);
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
function Stat({ label, value, color, onPress }: any) {
  const s = useThemeStyles(baseS);
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container style={s.stat} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? `Show report ${label.toLowerCase()} in ledger` : undefined}>
      <Text style={s.statLabel}>{label}{onPress ? ' ↗' : ''}</Text>
      <Text style={[s.statValue, { color }]}>
        {value < 0 ? '− ' : ''}
        {money(value)}
      </Text>
    </Container>
  );
}
function PlanCell({ label, value }: any) {
  const s = useThemeStyles(baseS);
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
  const s = useThemeStyles(baseS);
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
const EntryRow = memo(function EntryRow({ entry, icon, accountBalance, onLong, onPress, selected }: { entry: RedCoinsEntry; icon?: string; accountBalance?: { source: number; destination?: number }; onLong?: () => void; onPress?: () => void; selected?: boolean }) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const rawColor = entry.type === 'transfer' ? C.blue : entry.type === 'income' ? '#18A879' : C.coral;
  const color = themed(rawColor);
  const balanceLabel = (value: number) => `${value < 0 ? '− ' : ''}${money(value)}`;
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLong} delayLongPress={350} style={[s.entry, selected && s.entrySelected]}>
      <View style={[s.entryIcon, { backgroundColor: themed(rawColor, 'backgroundColor') }]}>{selected ? <Ionicons name="checkmark" size={15} color={themed(C.white, 'color')} /> : <Ionicons name={(icon || transactionIcon(entry)) as any} size={14} color={themed(C.white, 'color')} />}</View>
      <View style={s.entryMain}>
        <Text style={s.entryName} numberOfLines={1}>
          {entry.item}
        </Text>
        <Text style={s.entryMeta} numberOfLines={1}>
          {entryTime(entry.date)} · {entry.type === 'transfer' ? `From ${entry.account} → ${entry.toAccount || 'Unknown'}` : entry.subcategory}
        </Text>
        {entry.status === 'reconciled' && <Text style={[s.entryMeta, { color: themed('#168A65', 'color') }]}>RECONCILED</Text>}
        {entry.status === 'pending' && <Text style={s.entryMeta}>PENDING</Text>}
        {entry.status === 'void' && <Text style={s.entryMeta}>VOID · SOURCE STATUS</Text>}
      </View>
      <View style={s.entryRight}>
        <Text style={[s.entryAmount, { color }]} numberOfLines={1}>
          {entry.type === 'income' ? '+' : entry.type === 'transfer' ? '⇄ ' : '− '}
          {money(entry.amount)}
        </Text>
        {entry.type === 'transfer' ? (
          <>
            <Text style={s.entryAccount} numberOfLines={1}>From {entry.account}{accountBalance ? ` · ${balanceLabel(accountBalance.source)}` : ''}</Text>
            <Text style={s.entryAccount} numberOfLines={1}>To {entry.toAccount || 'Unknown'}{accountBalance?.destination != null ? ` · ${balanceLabel(accountBalance.destination)}` : ''}</Text>
          </>
        ) : (
          <Text style={s.entryAccount} numberOfLines={1}>
            {entry.account}{accountBalance ? ` · ${balanceLabel(accountBalance.source)}` : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});
function Field({ label, value, onChange, numeric }: any) {
  const s = useThemeStyles(baseS);
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={numeric ? 'numeric' : 'default'} style={s.fieldInput} />
    </View>
  );
}

const LedgerSearch = memo(function LedgerSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (value !== draft) setDraft(value);
  }, [value]);
  const update = (next: string) => {
    setDraft(next);
    onChange(next);
  };
  return <TextInput value={draft} onChangeText={update} placeholder="Search item, category, account…" placeholderTextColor={themed(C.muted, 'color')} autoCorrect={false} autoCapitalize="none" returnKeyType="search" style={[s.search, { flex: 1 }]} />;
});

function FavoriteAccountsModal({ visible, state, close, save }: { visible: boolean; state: RedCoinsState; close: () => void; save: (ids: string[]) => Promise<void> }) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const [ids, setIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) { setIds(favoriteAccountsForHome(state).map(account => account.id)); setSearch(''); }
  }, [visible]);
  const selected = new Set(ids);
  const accounts = state.accounts.filter(account => `${account.name} ${account.type}`.toLowerCase().includes(search.trim().toLowerCase()));
  const finish = async () => {
    setBusy(true);
    try { await save(ids.filter(id => state.accounts.some(account => account.id === id))); }
    catch { Alert.alert('Could not save favorites', 'Your selection has not been saved. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) close(); }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <Pressable style={[s.sheetShade, { justifyContent: 'center' }]} onPress={() => { if (!busy) close(); }}><Pressable style={[s.selectionSheet, { borderRadius: 28 }]} onPress={() => {}}>
      <View style={s.sheetGrab} />
      <View style={s.filterTitleRow}><Text style={s.sheetTitle}>Favorite accounts</Text><TouchableOpacity disabled={busy} onPress={close} accessibilityLabel="Close favorite accounts"><Ionicons name="close" size={23} color={themed(C.ink, 'color')} /></TouchableOpacity></View>
      <Text style={s.reportSectionHint}>Choose accounts for RedCoins Home. This does not change spendable cash or budgets.</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search accounts…" placeholderTextColor={themed(C.muted, 'color')} style={s.favoriteSearch} autoCorrect={false} />
      <View style={s.filterTitleRow}><Text style={s.reportSectionHint}>{ids.length} selected</Text><TouchableOpacity disabled={busy} onPress={() => setIds([])}><Text style={s.balanceSheetText}>CLEAR ALL</Text></TouchableOpacity></View>
      <ScrollView style={{ maxHeight: 330 }} keyboardShouldPersistTaps="handled">
        {accounts.map(account => <TouchableOpacity key={account.id} disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(account.id) }} style={s.favoriteChoice} onPress={() => setIds(current => current.includes(account.id) ? current.filter(id => id !== account.id) : [...current, account.id])}>
          <Ionicons name={selected.has(account.id) ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={selected.has(account.id) ? themed(C.ink, 'color') : themed(C.muted, 'color')} />
          <View style={{ flex: 1 }}><Text style={s.reportName}>{account.name}</Text><Text style={s.reportSectionHint}>{account.type}</Text></View>
          <Text style={[s.favoriteBalance, account.balance < 0 && { color: themed(C.coral, 'color') }]}>{money(account.balance)}</Text>
        </TouchableOpacity>)}
        {!accounts.length && <Text style={s.reportSectionHint}>No matching accounts.</Text>}
      </ScrollView>
      <TouchableOpacity disabled={busy} style={s.balanceSheetButton} onPress={() => { Keyboard.dismiss(); void finish(); }}><Text style={s.balanceSheetText}>{busy ? 'SAVING…' : 'SAVE FAVORITES'}</Text></TouchableOpacity>
    </Pressable></Pressable>
    </KeyboardAvoidingView>
  </Modal>;
}

function LedgerTotalsModal({ visible, scope, summary, close }: { visible: boolean; scope: string; summary: ReturnType<typeof summarizeLedgerEntries>; close: () => void }) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <Pressable style={s.sheetShade} onPress={close}><Pressable style={s.selectionSheet} onPress={() => {}}>
      <View style={s.sheetGrab} />
      <View style={s.filterTitleRow}><Text style={s.sheetTitle}>Ledger totals</Text><TouchableOpacity onPress={close} accessibilityLabel="Close totals"><Ionicons name="close" size={23} color={themed(C.ink, 'color')} /></TouchableOpacity></View>
      <Text style={s.reportSectionHint}>{scope} · {summary.count} entries</Text>
      {([
        ['Income', summary.income, '#168A65'], ['Expense', summary.expense, C.coral],
        ['Transfer', summary.transfer, C.blue], ['Net · income − expense', summary.net, C.ink],
      ] as const).map(([label, value, color]) => <View key={label} style={s.ledgerTotalRow}><Text style={s.reportName}>{label}</Text><Text style={[s.reportSubAmount, { color }]}>{value < 0 ? '− ' : ''}{money(value)}</Text></View>)}
      <Text style={s.reportSectionHint}>Totals include every matching entry, not just the rows currently loaded. Transfers are counted once and excluded from net.{summary.futureCount ? ` Includes ${summary.futureCount} future-dated entries visible in this list.` : ''}</Text>
    </Pressable></Pressable>
  </Modal>;
}

const LedgerFilterModal = memo(function LedgerFilterModal({
  visible,
  current,
  accounts,
  categories,
  subcategories,
  salarySources,
  close,
  apply,
}: {
  visible: boolean;
  current: {
    types: RedCoinsType[];
    accounts: string[];
    categories: string[];
    subcategories: string[];
    dateMode: FilterDateMode;
    startDay: string;
    endDay: string;
    dateLabel: string;
    salarySourceKey?: string;
  };
  accounts: string[];
  categories: string[];
  subcategories: string[];
  salarySources: SalaryFilterSource[];
  close: () => void;
  apply: (next: { types: RedCoinsType[]; accounts: string[]; categories: string[]; subcategories: string[]; dateMode: FilterDateMode; startDay: string; endDay: string; dateLabel: string; salarySourceKey?: string }) => void;
}) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const [draft, setDraft] = useState(current);
  const [dateOpen, setDateOpen] = useState(false);
  const [datePicker, setDatePicker] = useState<'single' | 'start' | 'end' | null>(null);
  const [salaryKey, setSalaryKey] = useState('');
  const [cycleOffset, setCycleOffset] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [showOtherIncome, setShowOtherIncome] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  useEffect(() => {
    let active = true;
    if (visible) {
      setDraft(current);
      setDateOpen(current.dateMode === 'cycle');
      setDatePicker(null);
      setSourceOpen(false); setSourceSearch(''); setShowOtherIncome(false); setSourceReady(false);
      void AsyncStorage.getItem(SALARY_FILTER_SOURCE_KEY).catch(() => null).then(saved => {
        if (!active) return;
        const source = preferredSalarySource(salarySources, current.salarySourceKey || saved || '');
        setSalaryKey(source?.key || '');
        const dates = source ? [...new Set(source.entries.map(entry => dayKey(entry.date)))].sort() : [];
        const index = current.dateMode === 'cycle' ? dates.indexOf(current.startDay) : -1;
        setCycleOffset(index < 0 ? 0 : dates.length - 1 - index);
        if (current.dateMode === 'cycle' && index < 0) {
          const cycle = source ? salaryFilterCycle(source, 0) : null;
          setDraft(row => ({ ...row, startDay: cycle?.startDay || '', endDay: cycle?.endDay || '', dateLabel: cycle?.dateLabel || '', salarySourceKey: source?.key }));
        }
        setSourceReady(true);
      });
    }
    return () => { active = false; };
  }, [visible]);
  const empty = { types: [] as RedCoinsType[], accounts: [], categories: [], subcategories: [], dateMode: 'all' as FilterDateMode, startDay: '', endDay: '', dateLabel: '' };
  const clear = () => apply(empty);
  const toggle = (key: 'types' | 'accounts' | 'categories' | 'subcategories', value: string) => setDraft((row) => {
    const values = row[key] as string[];
    return { ...row, [key]: values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value] };
  });
  const setDateMode = (mode: FilterDateMode) => {
    const today = dayKey(new Date().toISOString());
    if (mode === 'month') { setDraft(row => ({ ...row, dateMode: mode, ...ledgerMonthPeriod(row.startDay) })); return; }
    setDraft((row) => ({ ...row, dateMode: mode, startDay: mode === 'all' ? '' : row.startDay || today, endDay: mode === 'all' ? '' : row.endDay || today, dateLabel: mode === 'all' ? '' : row.dateLabel }));
  };
  const selectedSalary = preferredSalarySource(salarySources, salaryKey);
  const sourceOptions = visibleSalarySources(salarySources, sourceSearch, showOtherIncome);
  const currentCycle = selectedSalary ? salaryFilterCycle(selectedSalary, cycleOffset) : null;
  const selectCycle = (offset: number, source = selectedSalary) => {
    if (!source) return;
    const cycle = salaryFilterCycle(source, offset);
    if (!cycle) return;
    setCycleOffset(cycle.offset);
    setDraft((row) => ({
      ...row,
      dateMode: 'cycle',
      startDay: cycle.startDay,
      endDay: cycle.endDay,
      dateLabel: cycle.dateLabel,
      salarySourceKey: source.key,
    }));
  };
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <KeyboardAvoidingView style={s.keyboardSheetShade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={s.keyboardSheetFill} onPress={close}>
        <Pressable style={s.selectionSheet} onPress={() => {}}>
          <View style={s.sheetGrab} />
          <View style={s.filterTitleRow}>
            <Text style={s.sheetTitle}>Filter transactions</Text>
            <TouchableOpacity onPress={clear}>
              <Text style={s.clearFilterText}>CLEAR ALL</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.filterListScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
            <View style={s.filterGroup}>
              <TouchableOpacity style={[s.filterDropdownHead, draft.dateMode !== 'all' && s.filterDropdownHeadActive]} onPress={() => setDateOpen((value) => !value)}>
                <View style={{ flex: 1 }}><Text style={s.filterDropdownTitle}>DATE & CYCLE</Text><Text style={s.filterDropdownSummary}>{draft.dateMode === 'all' ? 'All dates' : draft.dateLabel || `${draft.startDay} → ${draft.endDay}`}</Text></View>
                <Ionicons name={dateOpen ? 'chevron-up' : 'chevron-down'} size={18} color={themed(C.ink, 'color')} />
              </TouchableOpacity>
              {dateOpen && <View style={s.filterDropdownBody}>
                {(['all', 'single', 'range', 'month', 'cycle'] as FilterDateMode[]).map((mode) => <TouchableOpacity key={mode} disabled={mode === 'cycle' && !sourceReady} style={s.filterModeRow} onPress={() => { if (mode === 'cycle') { setDraft(row => ({ ...row, dateMode: 'cycle', startDay: '', endDay: '', dateLabel: '' })); selectCycle(0); } else setDateMode(mode); }}>
                  <Ionicons name={draft.dateMode === mode ? 'radio-button-on' : 'radio-button-off'} size={18} color={draft.dateMode === mode ? themed(C.coral, 'color') : themed(C.muted, 'color')} />
                  <Text style={s.filterListText}>{mode === 'all' ? 'All dates' : mode === 'single' ? 'One date' : mode === 'range' ? 'Custom date range' : mode === 'month' ? 'Calendar month' : 'Salary cycle'}</Text>
                </TouchableOpacity>)}
                {draft.dateMode === 'single' && <TouchableOpacity style={s.filterDateButton} onPress={() => setDatePicker('single')}><Text style={s.inputLabel}>DATE</Text><Text style={s.periodDateValue}>{reportDate(localDay(draft.startDay))}</Text></TouchableOpacity>}
                {draft.dateMode === 'month' && <TouchableOpacity style={s.filterDateButton} onPress={() => setDatePicker('single')}><Text style={s.inputLabel}>MONTH · PICK ANY DATE IN THE MONTH</Text><Text style={s.periodDateValue}>{draft.dateLabel}</Text></TouchableOpacity>}
                {draft.dateMode === 'range' && <View style={s.periodDatesRow}>
                  <TouchableOpacity style={s.periodDateButton} onPress={() => setDatePicker('start')}><Text style={s.inputLabel}>FROM</Text><Text style={s.periodDateValue}>{reportDate(localDay(draft.startDay))}</Text></TouchableOpacity>
                  <Ionicons name="arrow-forward" size={16} color={themed(C.muted, 'color')} />
                  <TouchableOpacity style={s.periodDateButton} onPress={() => setDatePicker('end')}><Text style={s.inputLabel}>TO</Text><Text style={s.periodDateValue}>{reportDate(localDay(draft.endDay))}</Text></TouchableOpacity>
                </View>}
                {draft.dateMode === 'cycle' && <>
                  <TouchableOpacity disabled={!sourceReady} style={s.filterDropdownHead} onPress={() => { setSourceOpen(value => !value); setSourceSearch(''); }} accessibilityLabel="Choose salary source">
                    <View style={{ flex: 1 }}><Text style={s.filterDropdownTitle}>SALARY SOURCE</Text><Text style={s.filterDropdownSummary}>{!sourceReady ? 'Loading selection…' : selectedSalary?.label || 'Choose a salary source'}</Text></View>
                    <Ionicons name={sourceOpen ? 'chevron-up' : 'chevron-down'} size={18} color={themed(C.ink, 'color')} />
                  </TouchableOpacity>
                  {sourceOpen && <View style={s.filterListBox}>
                    <TextInput value={sourceSearch} onChangeText={setSourceSearch} placeholder="Search salary source…" style={s.search} autoCorrect={false} accessibilityLabel="Search salary sources" />
                    <TouchableOpacity style={s.filterModeRow} onPress={() => setShowOtherIncome(value => !value)}><Ionicons name={showOtherIncome ? 'checkbox' : 'square-outline'} size={18} color={themed(C.ink, 'color')} /><Text style={s.filterListText}>Show other income</Text></TouchableOpacity>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                      {sourceOptions.map(source => <TouchableOpacity key={source.key} style={[s.salarySourceRow, selectedSalary?.key === source.key && s.salarySourceRowActive]} onPress={() => {
                        setSalaryKey(source.key); selectCycle(0, source); setSourceOpen(false); Keyboard.dismiss();
                        void AsyncStorage.setItem(SALARY_FILTER_SOURCE_KEY, source.key).catch(() => Alert.alert('Selection not remembered', 'The filter works, but your salary source could not be saved.'));
                      }}><Ionicons name={selectedSalary?.key === source.key ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={themed(C.ink, 'color')} /><View style={{ flex: 1 }}><Text style={s.salarySourceName}>{source.label}</Text><Text style={s.periodModeMeta}>{source.entries[0]?.category}</Text></View></TouchableOpacity>)}
                      {!sourceOptions.length && <Empty text={showOtherIncome ? 'No matching income source.' : 'No matching Salary source. Try Show other income.'} />}
                    </ScrollView>
                  </View>}
                  {!selectedSalary && !sourceOpen && <Empty text="Choose a source. Other income is available inside the dropdown." />}
                  {!!currentCycle && <View style={s.filterCycleNav}>
                    <TouchableOpacity disabled={cycleOffset >= currentCycle.count - 1} accessibilityLabel="Previous salary cycle" onPress={() => selectCycle(cycleOffset + 1)}><Ionicons name="chevron-back" size={20} color={cycleOffset >= currentCycle.count - 1 ? themed('#C8C1B5', 'color') : themed(C.ink, 'color')} /></TouchableOpacity>
                    <View style={{ flex: 1 }}><Text style={[s.filterCycleText, { flex: 0 }]}>{currentCycle.month}</Text><Text style={[s.periodModeMeta, { textAlign: 'center' }]}>{draft.startDay} → {draft.endDay}</Text></View>
                    <TouchableOpacity disabled={cycleOffset === 0} onPress={() => selectCycle(cycleOffset - 1)}><Ionicons name="chevron-forward" size={20} color={cycleOffset === 0 ? themed('#C8C1B5', 'color') : themed(C.ink, 'color')} /></TouchableOpacity>
                  </View>}
                </>}
                {datePicker && <DateTimePicker value={localDay(datePicker === 'end' ? draft.endDay : draft.startDay)} mode="date" onChange={(_, selected) => {
                  setDatePicker(null);
                  if (!selected) return;
                  const value = dayKey(selected.toISOString());
                  setDraft((row) => row.dateMode === 'month' ? { ...row, ...ledgerMonthPeriod(value) } : datePicker === 'single'
                    ? { ...row, startDay: value, endDay: value, dateLabel: reportDate(localDay(value)) }
                    : datePicker === 'start'
                      ? { ...row, startDay: value, dateLabel: `${reportDate(localDay(value))} → ${reportDate(localDay(row.endDay))}` }
                      : { ...row, endDay: value, dateLabel: `${reportDate(localDay(row.startDay))} → ${reportDate(localDay(value))}` });
                }} />}
              </View>}
            </View>
            <FilterList title="TYPE" values={['expense', 'income', 'transfer']} selected={draft.types} onSelect={(value) => toggle('types', value)} onAll={() => setDraft((row) => ({ ...row, types: [] }))} />
            <FilterList title="ACCOUNT" values={accounts} selected={draft.accounts} onSelect={(value) => toggle('accounts', value)} onAll={() => setDraft((row) => ({ ...row, accounts: [] }))} />
            <FilterList title="CATEGORY" values={categories} selected={draft.categories} onSelect={(value) => toggle('categories', value)} onAll={() => setDraft((row) => ({ ...row, categories: [] }))} />
            <FilterList title="SUBCATEGORY" values={subcategories} selected={draft.subcategories} onSelect={(value) => toggle('subcategories', value)} onAll={() => setDraft((row) => ({ ...row, subcategories: [] }))} />
          </ScrollView>
          <TouchableOpacity style={s.sheetSave} onPress={() => {
            if (draft.dateMode === 'range' && draft.startDay > draft.endDay) return Alert.alert('Invalid date range', 'The start date must be before the end date.');
            if (draft.dateMode === 'cycle' && (!sourceReady || !selectedSalary || !draft.startDay)) return Alert.alert('Salary cycle required', 'Choose a salary source and cycle first.');
            if (draft.dateMode === 'cycle' && selectedSalary) void AsyncStorage.setItem(SALARY_FILTER_SOURCE_KEY, selectedSalary.key).catch(console.warn);
            Keyboard.dismiss();
            apply(draft);
          }}>
            <Text style={s.sheetSaveText}>APPLY FILTERS</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
});

function FilterList({ title, values, selected, onSelect, onAll }: { title: string; values: readonly string[]; selected: string[]; onSelect: (value: string) => void; onAll: () => void }) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const [open, setOpen] = useState(false);
  const rows = ['all', ...values];
  return (
    <View style={s.filterGroup}>
      <TouchableOpacity style={[s.filterDropdownHead, selected.length > 0 && s.filterDropdownHeadActive]} onPress={() => setOpen((value) => !value)}>
        <View style={{ flex: 1 }}><Text style={s.filterDropdownTitle}>{title}</Text><Text style={s.filterDropdownSummary}>{selected.length ? `${selected.length} selected · ${selected.slice(0, 2).join(', ')}${selected.length > 2 ? '…' : ''}` : `All ${title.toLowerCase()}`}</Text></View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={themed(C.ink, 'color')} />
      </TouchableOpacity>
      {open && <View style={s.filterListBox}>
        {rows.map((value, index) => {
          const active = value === 'all' ? selected.length === 0 : selected.includes(value);
          return (
            <TouchableOpacity key={value} style={[s.filterListRow, index < rows.length - 1 && s.filterListDivider, active && s.filterListRowActive]} onPress={() => value === 'all' ? onAll() : onSelect(value)} activeOpacity={0.7}>
              <Ionicons name={active ? 'checkbox' : 'square-outline'} size={19} color={active ? themed(C.coral, 'color') : themed(C.muted, 'color')} />
              <Text style={[s.filterListText, active && s.filterListTextActive]}>{value === 'all' ? `All ${title.toLowerCase()}` : value}</Text>
            </TouchableOpacity>
          );
        })}
      </View>}
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
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
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
            <Ionicons name={draftMode === 'salary-cycle' ? 'radio-button-on' : 'radio-button-off'} size={20} color={draftMode === 'salary-cycle' ? themed(C.coral, 'color') : themed(C.muted, 'color')} />
            <View style={{ flex: 1 }}><Text style={s.periodModeTitle}>Salary cycle</Text><Text style={s.periodModeMeta}>From one real salary credit to the next.</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={[s.periodModeRow, draftMode === 'custom' && s.periodModeRowActive]} onPress={() => setDraftMode('custom')}>
            <Ionicons name={draftMode === 'custom' ? 'radio-button-on' : 'radio-button-off'} size={20} color={draftMode === 'custom' ? themed(C.coral, 'color') : themed(C.muted, 'color')} />
            <View style={{ flex: 1 }}><Text style={s.periodModeTitle}>Custom range</Text><Text style={s.periodModeMeta}>Any inclusive start and end date.</Text></View>
          </TouchableOpacity>

          {draftMode === 'salary-cycle' ? <View style={s.periodSection}>
            <Text style={s.inputLabel}>SALARY ANCHOR</Text>
            {salarySources.map((source) => <TouchableOpacity key={source.key} style={[s.salarySourceRow, draftSource === source.key && s.salarySourceRowActive]} onPress={() => setDraftSource(source.key)}>
              <Ionicons name={draftSource === source.key ? 'checkmark-circle' : 'ellipse-outline'} size={19} color={draftSource === source.key ? themed('#168A65', 'color') : themed(C.muted, 'color')} />
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
              <Ionicons name="arrow-forward" size={17} color={themed(C.muted, 'color')} />
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
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const [picker, setPicker] = useState<'account' | 'destination' | 'category' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time' | null>(null);
  const [suggestionOpen, setSuggestionOpen] = useState(true);
  const amountRef = useRef<TextInput>(null);
  useEffect(() => {
    if (p.visible) setSuggestionOpen(true);
  }, [p.visible]);
  const cats = useMemo(() => p.visible ? loggerCategories(p.state.categories, p.state.entries, p.type) : [], [p.visible, p.state.categories, p.state.entries, p.type]);
  const openPicker = (value: typeof picker) => {
    setPickerSearch('');
    setPicker(value);
  };
  const chooseTemplate = (entry: any) => {
    p.chooseSuggestion(entry);
    setSuggestionOpen(false);
    requestAnimationFrame(() => amountRef.current?.focus());
  };
  return (
    <Modal visible={p.visible} animationType={p.saving ? 'none' : 'slide'} onRequestClose={p.close}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHead}>
          <TouchableOpacity onPress={p.close}>
            <Ionicons name="arrow-back" size={24} color={themed(C.ink, 'color')} />
          </TouchableOpacity>
          <Text style={s.modalTitle}>{p.schedulingOnly ? (p.editingSchedule ? 'Edit schedule' : 'Create schedule') : p.editing ? 'Edit entry' : 'New entry'}</Text>
          <Text style={s.plusOne}>{p.schedulingOnly ? 'AUTO' : p.editing ? 'EDIT' : '+1'}</Text>
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
                    backgroundColor: x === 'expense' ? themed(C.coral, 'backgroundColor') : x === 'income' ? themed('#379B73', 'backgroundColor') : themed(C.blue, 'backgroundColor'),
                  },
                ]}
              >
                <Text style={[s.typeText, p.type === x && { color: themed(C.white, 'color') }]}>{x.toUpperCase()}</Text>
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
            placeholder="Name"
            placeholderTextColor={themed("#AAA393", 'color')}
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
                    <Text style={s.suggestionMeta}>Last amount logged · {money(x.amount)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={themed(C.muted, 'color')} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {p.schedulingOnly && <Text style={s.inputLabel}>FIRST DUE · DATE & TIME</Text>}
          <TouchableOpacity style={s.entryDateButton} onPress={() => setDatePickerMode('date')} activeOpacity={0.75}>
            <Ionicons name="time-outline" size={15} color={themed(C.ink, 'color')} />
            <Text style={s.entryDateButtonText}>
              {p.entryDate
                .toLocaleString('en-MY', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
                .toUpperCase()}
            </Text>
            <Ionicons name="calendar-outline" size={14} color={themed(C.ink, 'color')} />
          </TouchableOpacity>
          <View style={s.amountWrap}>
            <View
              style={[
                s.amountSign,
                {
                  backgroundColor: p.type === 'expense' ? themed(C.coral, 'backgroundColor') : p.type === 'income' ? themed('#379B73', 'backgroundColor') : themed(C.blue, 'backgroundColor'),
                },
              ]}
            >
              <Text style={s.amountSignText}>{p.type === 'expense' ? '−' : p.type === 'income' ? '+' : '⇄'}</Text>
            </View>
            <TextInput ref={amountRef} style={s.amountBare} value={p.amount} onChangeText={p.setAmount} keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={p.saveEntry} placeholder="0.00" placeholderTextColor={themed("#AAA393", 'color')} />
            <Text style={s.currency}>MYR</Text>
          </View>
          {p.type === 'income' && !p.schedulingOnly && <View style={{ marginBottom: 14 }}>
            <Field label="UNTUK BULAN · YYYY-MM (OPTIONAL)" value={p.incomePeriod} onChange={p.setIncomePeriod} />
            <Text style={s.reportSectionHint}>Blank uses {incomeMonth(p.entryDate)} for duplicate checks. For late EPF logging, use its contribution month. This label never changes the actual transaction date or salary-cycle totals.</Text>
          </View>}
          {p.type !== 'transfer' && <PickerRow icon={ICON_LIBRARY.includes(cats.find((c) => c.name === p.category)?.icon || '') ? cats.find((c) => c.name === p.category)!.icon : 'grid-outline'} label="CATEGORY" value={p.subcategory || p.category || 'Choose category'} onPress={() => openPicker('category')} />}
          <PickerRow icon="wallet-outline" label={p.type === 'transfer' ? 'FROM ACCOUNT' : 'ACCOUNT'} value={p.account || 'Choose account'} onPress={() => openPicker('account')} />
          {p.type === 'transfer' && <PickerRow icon="arrow-forward-circle-outline" label="TRANSFER TO" value={p.toAccount || 'Choose destination'} onPress={() => openPicker('destination')} />}
          {!p.schedulingOnly && <TouchableOpacity style={s.advancedButton} onPress={() => p.setAdvanced(!p.advanced)}>
            <Text style={s.advancedText}>Split · Status · Labels · Repeat</Text>
            <Ionicons name={p.advanced ? 'chevron-up' : 'chevron-down'} size={17} color={themed(C.muted, 'color')} />
          </TouchableOpacity>}
          {(p.schedulingOnly || p.advanced) && (
            <View style={s.advancedBox}>
              <Field label="LABELS" value={p.labels} onChange={p.setLabels} />
              <Text style={s.inputLabel}>{p.schedulingOnly ? 'FREQUENCY' : 'REPEAT'}</Text>
              <View style={s.typeRow}>
                {(p.schedulingOnly ? ['daily', 'weekly', 'monthly', 'yearly'] : ['none', 'daily', 'weekly', 'monthly', 'yearly', 'installment']).map((x) => (
                  <TouchableOpacity key={x} onPress={() => p.setRepeat(x)} style={[s.repeatButton, p.repeat === x && s.repeatActive]}>
                    <Text style={[s.repeatText, p.repeat === x && s.repeatTextActive]}>{x}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {p.repeat && p.repeat !== 'none' && <>
                {p.repeat === 'installment'
                  ? <Field label="TOTAL INSTALMENTS" value={p.installments} onChange={p.setInstallments} numeric />
                  : <Field label={`REPEAT EVERY (${({ daily: 'DAYS', weekly: 'WEEKS', monthly: 'MONTHS', yearly: 'YEARS' } as any)[p.repeat] || 'INTERVALS'})`} value={p.repeatEvery} onChange={p.setRepeatEvery} numeric />}
                {p.schedulingOnly && <Text style={s.reminderExplainerCopy}>For every 22nd: set First due to the 22nd, choose Monthly, then enter 1 above.</Text>}
                <Text style={s.inputLabel}>ENDING</Text>
                <View style={s.typeRow}>
                  {['never', 'date', 'occurrences'].map((x) => <TouchableOpacity key={x} onPress={() => p.setReminderEndType(x)} style={[s.repeatButton, p.reminderEndType === x && s.repeatActive]}><Text style={[s.repeatText, p.reminderEndType === x && s.repeatTextActive]}>{x}</Text></TouchableOpacity>)}
                </View>
                {p.reminderEndType === 'date' && <Field label="END DATE · YYYY-MM-DD" value={p.reminderEndDate} onChange={p.setReminderEndDate} />}
                {p.reminderEndType === 'occurrences' && p.repeat !== 'installment' && <Field label="FUTURE OCCURRENCES" value={p.reminderOccurrences} onChange={p.setReminderOccurrences} numeric />}
                <Text style={s.inputLabel}>WHEN DUE</Text>
                <View style={s.typeRow}>
                  <TouchableOpacity onPress={() => p.setAutomaticLog(false)} style={[s.repeatButton, !p.automaticLog && s.repeatActive]}><Text style={[s.repeatText, !p.automaticLog && s.repeatTextActive]}>REMIND ME</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => p.setAutomaticLog(true)} style={[s.repeatButton, p.automaticLog && s.repeatActive]}><Text style={[s.repeatText, p.automaticLog && s.repeatTextActive]}>AUTO-LOG</Text></TouchableOpacity>
                </View>
                <Text style={s.inputLabel}>WEEKENDS</Text>
                <View style={s.typeRow}>
                  <TouchableOpacity onPress={() => p.setExcludeWeekend(false)} style={[s.repeatButton, !p.excludeWeekend && s.repeatActive]}><Text style={[s.repeatText, !p.excludeWeekend && s.repeatTextActive]}>KEEP DATE</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => p.setExcludeWeekend(true)} style={[s.repeatButton, p.excludeWeekend && s.repeatActive]}><Text style={[s.repeatText, p.excludeWeekend && s.repeatTextActive]}>AVOID WEEKEND</Text></TouchableOpacity>
                  {p.excludeWeekend && <TouchableOpacity onPress={() => p.setWeekendMove(p.weekendMove === 'before' ? 'after' : 'before')} style={[s.repeatButton, s.repeatActive]}><Text style={[s.repeatText, s.repeatTextActive]}>MOVE {p.weekendMove.toUpperCase()}</Text></TouchableOpacity>}
                </View>
              </>}
            </View>
          )}
          <TextInput style={s.noteInput} value={p.note} onChangeText={p.setNote} placeholder="Note" placeholderTextColor={themed(C.muted, 'color')} multiline />
          {!p.schedulingOnly && <RedCoinsReceipts entry={p.receiptEntry} drafts={p.receiptDrafts} onChange={p.setReceiptDrafts} onBusy={p.setReceiptBusy} visible={p.visible} disabled={p.saving} />}
        </ScrollView>
        <View style={s.entryFooter}>
          {p.editing && !p.schedulingOnly && (
            <TouchableOpacity style={s.entryDelete} onPress={p.onDelete} disabled={p.saving || p.receiptBusy}>
              <Text style={s.entryDeleteText}>DELETE</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              s.entrySave,
              {
                flex: 1,
                backgroundColor: p.type === 'expense' ? themed(C.coral, 'backgroundColor') : p.type === 'income' ? themed('#379B73', 'backgroundColor') : themed(C.blue, 'backgroundColor'),
              },
            ]}
            onPress={p.saveEntry}
            disabled={p.saving || p.receiptBusy}
          >
            <Ionicons name="save-outline" size={19} color={themed("#FFF", 'color')} />
            <Text style={s.entrySaveText}>{p.schedulingOnly ? (p.editingSchedule ? 'UPDATE SCHEDULE' : 'SAVE SCHEDULE') : p.editing ? `UPDATE ${p.type.toUpperCase()}` : `SAVE ${p.type.toUpperCase()}`}</Text>
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
                          <View style={[s.categoryIcon, { backgroundColor: p.type === 'income' ? themed('#379B73', 'backgroundColor') : themed(C.coral, 'backgroundColor') }]}>
                            {ICON_LIBRARY.includes(group.subcategoryIcons?.[sub] || group.icon) ? <Ionicons name={(group.subcategoryIcons?.[sub] || group.icon) as any} size={17} color={themed(C.ink, 'color')} /> : <Text>{group.subcategoryIcons?.[sub] || group.icon}</Text>}
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
                    <Text style={[s.accountChoiceBalance, a.balance < 0 && { color: themed(C.coral, 'color') }]}>
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
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  return (
    <TouchableOpacity style={s.pickerRow} onPress={onPress}>
      <View style={s.pickerRowIcon}>
        <Ionicons name={icon} size={19} color={themed(C.ink, 'color')} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.pickerRowLabel}>{label}</Text>
        <Text style={s.pickerRowValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={themed(C.muted, 'color')} />
    </TouchableOpacity>
  );
}
function SelectionSheet({ visible, close, search, setSearch, title, children }: any) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={s.keyboardSheetShade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <Pressable style={s.keyboardSheetFill} onPress={close}>
        <Pressable style={s.selectionSheet} onPress={() => {}}>
          <View style={s.sheetGrab} />
          <View style={s.selectionTop}>
            <TextInput value={search} onChangeText={setSearch} placeholder={`Search ${title.toLowerCase()}…`} placeholderTextColor={themed(C.muted, 'color')} style={s.selectionSearch} />
            <TouchableOpacity style={s.selectionDone} onPress={close}>
              <Text style={s.selectionDoneText}>DONE</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag" contentContainerStyle={s.selectionResults}>{children}</ScrollView>
        </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
function Chip({ text, active, onPress }: any) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && { color: themed(C.white, 'color') }]}>{text}</Text>
    </TouchableOpacity>
  );
}

function ManageModal({ visible, mode, close, draft, save, remove, editing }: any) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
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
          {mode !== 'account' && (mode === 'sub' || !editing) && <>
            <Text style={s.inputLabel}>TRANSACTION TYPE</Text>
            <View style={s.typeRow}>{(['expense', 'income'] as const).map((entryType) => <TouchableOpacity key={entryType}
              style={[s.typeButton, draft.draftCategoryTypes.includes(entryType) && { backgroundColor: entryType === 'income' ? themed('#379B73', 'backgroundColor') : themed(C.coral, 'backgroundColor') }]}
              onPress={() => draft.setDraftCategoryTypes(draft.draftCategoryTypes.includes(entryType) ? draft.draftCategoryTypes.filter((value: string) => value !== entryType) : [...draft.draftCategoryTypes, entryType])}>
              <Text style={[s.typeText, draft.draftCategoryTypes.includes(entryType) && { color: themed(C.white, 'color') }]}>{entryType.toUpperCase()}</Text>
            </TouchableOpacity>)}</View>
          </>}
          <View style={s.iconSearchWrap}>
            <Ionicons name="search" size={17} color={themed(C.muted, 'color')} />
            <TextInput
              value={iconSearch}
              onChangeText={setIconSearch}
              placeholder="Search icons — food, car, home…"
              placeholderTextColor={themed(C.muted, 'color')}
              autoCorrect={false}
              autoCapitalize="none"
              style={s.iconSearchInput}
            />
            {!!iconSearch && <TouchableOpacity onPress={() => setIconSearch('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={themed(C.muted, 'color')} /></TouchableOpacity>}
          </View>
          <ScrollView style={s.iconLibraryScroll} contentContainerStyle={s.iconLibrary} nestedScrollEnabled>
            {visibleIcons.map((icon) => <TouchableOpacity key={icon} accessibilityLabel={icon.replace(/-/g, ' ')} style={[s.iconChoice, draft.draftIcon === icon && s.iconChoiceActive]} onPress={() => draft.setDraftIcon(icon)}><Ionicons name={icon as any} size={19} color={draft.draftIcon === icon ? themed(C.white, 'color') : themed(C.ink, 'color')} /></TouchableOpacity>)}
            {!visibleIcons.length && <Text style={s.empty}>No matching standard icon.</Text>}
          </ScrollView>
          <TouchableOpacity style={s.sheetSave} onPress={save}>
            <Text style={s.sheetSaveText}>SAVE</Text>
          </TouchableOpacity>
          {editing && <TouchableOpacity style={s.guardDelete} onPress={remove}><Text style={s.guardDeleteText}>DELETE {mode === 'sub' ? 'SUBCATEGORY' : mode.toUpperCase()}</Text></TouchableOpacity>}
          </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GuardModal({ visible, draft, setDraft, options, close, save, remove }: any) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const targets = draft.scope === 'account' ? options?.accounts || [] : draft.scope === 'category' ? options?.categories || [] : options?.subcategories || [];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}><KeyboardAvoidingView style={s.keyboardSheetShade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}><Pressable style={s.keyboardSheetFill} onPress={close}><Pressable style={[s.sheet, s.keyboardScrollableSheet]} onPress={() => {}}><View style={s.sheetGrab} /><ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
    <Text style={s.eyebrow}>{draft.id ? 'EDIT SPENDING GUARD' : 'NEW SPENDING GUARD'}</Text><Text style={s.sheetTitle}>Draw a clear boundary.</Text>
    <Field label="NAME" value={draft.name} onChange={(name: string) => setDraft((value: any) => ({ ...value, name }))} />
    <Text style={s.inputLabel}>WATCH</Text><View style={s.typeRow}>{(['account', 'category', 'subcategory'] as GuardScope[]).map((scope) => <TouchableOpacity key={scope} style={[s.repeatButton, draft.scope === scope && s.repeatActive]} onPress={() => setDraft((value: any) => ({ ...value, scope, target: (scope === 'account' ? options?.accounts : scope === 'category' ? options?.categories : options?.subcategories)?.[0] || '' }))}><Text style={[s.repeatText, draft.scope === scope && s.repeatTextActive]}>{scope.toUpperCase()}</Text></TouchableOpacity>)}</View>
    <Text style={s.inputLabel}>TARGET</Text><ScrollView style={{maxHeight: 150}}>{targets.map((target: string) => <TouchableOpacity key={target} style={s.cashSelectRow} onPress={() => setDraft((value: any) => ({ ...value, target }))}><Ionicons name={draft.target === target ? 'radio-button-on' : 'radio-button-off'} size={17} color={draft.target === target ? themed(C.coral, 'color') : themed(C.muted, 'color')} /><Text style={s.cashSelectName}>{target}</Text></TouchableOpacity>)}</ScrollView>
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
  const s = useThemeStyles(baseS);
  const palettes = [['#F4C7B8', '#7D2D2B'], ['#BFE0D4', '#185E50'], ['#C9D8F4', '#274E91'], ['#E8D3A8', '#72531B']];
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return <View style={[s.financeAvatar, round && s.financeAvatarRound, { backgroundColor: palettes[index][0] }]}><Ionicons name={(icon || inferFinanceIcon(name, kind)) as any} size={21} color={palettes[index][1]} /></View>;
}

const baseS = StyleSheet.create({
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
    height: '100%',
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
  repeatTextActive: { color: C.ink },
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
  filterDropdownHead: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#DDD4C5',
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  filterDropdownHeadActive: { borderColor: '#F0A08F', backgroundColor: '#FFF7F2' },
  filterDropdownTitle: { color: C.ink, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  filterDropdownSummary: { color: C.muted, fontSize: 8, marginTop: 3 },
  filterDropdownBody: { marginTop: 5, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: '#DDD4C5', backgroundColor: C.white },
  filterModeRow: { minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, borderRadius: 10 },
  filterDateButton: { marginTop: 8, borderRadius: 12, backgroundColor: C.cream, paddingHorizontal: 12, paddingVertical: 10 },
  filterCycleNav: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, backgroundColor: C.cream, paddingHorizontal: 12, paddingVertical: 10 },
  filterCycleText: { flex: 1, textAlign: 'center', color: C.ink, fontSize: 9, fontWeight: '900' },
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
    height: '100%',
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
    flexShrink: 1,
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
  ledgerSummaryLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 5 },
  ledgerSummaryButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: C.cream, borderRadius: 8 },
  ledgerSummaryButtonText: { color: C.ink, fontSize: 8, fontWeight: '900' },
  ledgerTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E2D9C8' },
  ledgerTools: { flexDirection: 'row', gap: 7 },
  ledgerPeriodBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEE8D8', borderRadius: 11, marginTop: 7, minHeight: 49 },
  ledgerPeriodArrow: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  ledgerPeriodLabel: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  ledgerPeriodMode: { color: C.muted, fontSize: 7, letterSpacing: .7, fontWeight: '900' },
  ledgerPeriodTitle: { color: C.ink, fontSize: 11, fontWeight: '900', marginTop: 2 },
  ledgerPeriodMeta: { color: C.muted, fontSize: 7, marginTop: 3 },
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
  favoriteSearch: { borderWidth: 1, borderColor: '#DDD8CB', borderRadius: 14, padding: 14, color: C.ink, marginVertical: 12 },
  favoriteChoice: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E9E4D8' },
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
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E8DFD0' },
  reminderMark: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  reminderName: { color: C.ink, fontSize: 11, fontWeight: '900' },
  reminderMeta: { color: C.muted, fontSize: 7, marginTop: 2 },
  reminderAction: { minWidth: 30, height: 30, borderRadius: 10, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  reminderActionText: { color: C.ink, fontSize: 7, fontWeight: '900' },
  reminderDelete: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, borderColor: '#F2B6AA', alignItems: 'center', justifyContent: 'center' },
  automationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.paper, borderRadius: 21, borderWidth: 1, borderColor: '#DDD3C1', padding: 15 },
  automationIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  automationTitle: { color: C.ink, fontFamily: 'serif', fontSize: 18, fontWeight: '800' },
  automationCopy: { color: C.muted, fontSize: 8, marginTop: 4 },
  reminderScreen: { flex: 1, backgroundColor: '#F8F0DF' },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 17, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#E4D9C6' },
  reminderScreenTitle: { color: C.ink, fontFamily: 'serif', fontSize: 25, fontWeight: '800', marginTop: 2 },
  reminderAdd: { width: 43, height: 43, borderRadius: 15, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  reminderScreenBody: { padding: 17, paddingBottom: 50, gap: 12 },
  reminderExplainer: { backgroundColor: C.ink, borderRadius: 22, padding: 18 },
  reminderExplainerTitle: { color: C.paper, fontFamily: 'serif', fontSize: 20, fontWeight: '800' },
  reminderExplainerCopy: { color: '#8792A5', fontSize: 9, lineHeight: 15, marginTop: 6 },
  reminderFullCard: { backgroundColor: C.paper, borderRadius: 20, borderWidth: 1, borderColor: '#DDD3C1', paddingHorizontal: 14, paddingTop: 3, overflow: 'hidden' },
  reminderState: { backgroundColor: '#DDF1E7', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 5 },
  reminderStatePaused: { backgroundColor: '#EEE5D6' },
  reminderStateText: { color: C.ink, fontSize: 6, fontWeight: '900', letterSpacing: 0.7 },
  reminderDue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E8DFD0', paddingVertical: 10 },
  reminderDueLabel: { color: C.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  reminderDueValue: { color: C.ink, fontSize: 9, fontWeight: '800' },
  reminderControls: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 12 },
  reminderControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 34, borderRadius: 11, backgroundColor: C.cream, paddingHorizontal: 10 },
  reminderControlText: { color: C.ink, fontSize: 7, fontWeight: '900' },
  reminderControlPrimary: { height: 34, borderRadius: 11, backgroundColor: C.mint, justifyContent: 'center', paddingHorizontal: 11 },
  reminderControlPrimaryText: { color: C.ink, fontSize: 7, fontWeight: '900' },
  reminderControlDanger: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: '#F2B6AA', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  reminderEmpty: { backgroundColor: C.paper, borderRadius: 20, borderWidth: 1, borderColor: '#DDD3C1', padding: 25, alignItems: 'center' },
  reminderEmptyTitle: { color: C.ink, fontFamily: 'serif', fontSize: 19, fontWeight: '800', marginTop: 9 },
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
