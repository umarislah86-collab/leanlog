import { requireOptionalNativeModule } from 'expo';

type BluecoinsDriveReaderModule = {
  replaceRedCoinsAlarmsAsync(json: string): Promise<boolean>;
  canScheduleRedCoinsExactAlarmsAsync(): Promise<boolean>;
  redCoinsNotificationsEnabledAsync(): Promise<boolean>;
  openRedCoinsAlarmSettingsAsync(): Promise<void>;
  listFydbFilesAsync(treeUri: string): Promise<Array<{
    uri: string;
    name: string;
    lastModified: number;
    size: number;
  }>>;
  copyContentUriToFileAsync(sourceUri: string, destinationUri: string): Promise<number>;
  isNotificationAccessEnabledAsync(): Promise<boolean>;
  openNotificationAccessSettingsAsync(): Promise<void>;
  getTransactionDetectionsAsync(): Promise<TransactionDetection[]>;
  dismissTransactionDetectionAsync(id: string): Promise<void>;
  createTestTransactionDetectionAsync(): Promise<TransactionDetection>;
};

export type TransactionDetection = {
  id: string;
  merchant: string;
  amount: number;
  accountHint: string;
  source: string;
  createdAt: number;
};

export default requireOptionalNativeModule<BluecoinsDriveReaderModule>('BluecoinsDriveReader');
