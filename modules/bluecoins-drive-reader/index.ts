import { requireOptionalNativeModule } from 'expo';

type BluecoinsDriveReaderModule = {
  copyContentUriToFileAsync(sourceUri: string, destinationUri: string): Promise<number>;
};

export default requireOptionalNativeModule<BluecoinsDriveReaderModule>('BluecoinsDriveReader');
