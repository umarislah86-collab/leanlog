import { requireOptionalNativeModule } from 'expo';

type BluecoinsDriveReaderModule = {
  listFydbFilesAsync(treeUri: string): Promise<Array<{
    uri: string;
    name: string;
    lastModified: number;
    size: number;
  }>>;
  copyContentUriToFileAsync(sourceUri: string, destinationUri: string): Promise<number>;
};

export default requireOptionalNativeModule<BluecoinsDriveReaderModule>('BluecoinsDriveReader');
