import StreamZip from 'node-stream-zip';
import {getMessage} from './messages';

export class DecoratedStreamZip {
    private readonly streamZip: StreamZip.StreamZipAsync;
    private readonly file: string;

    public constructor(config: StreamZip.StreamZipOptions) {
        this.streamZip = new StreamZip.async(config);
        this.file = config.file || /* istanbul ignore next - Not worth testing */ '';
    }

    public async entries(): Promise<{ [name: string]: StreamZip.ZipEntry }> {
        try {
            return await this.streamZip.entries();
        } catch (e) {
            const reason = e instanceof Error ? e.message : /* istanbul ignore next */ e as string;
            throw new Error(getMessage('CouldNotGetZipEntries', this.file, reason));
        }
    }

    public async entryData(entry: string | StreamZip.ZipEntry): Promise<Buffer> {
        try {
            return await this.streamZip.entryData(entry);
        } catch (e) {
            const reason = e instanceof Error ? e.message : e as string;
            const entryName: string = typeof entry === 'string' ? entry : /* istanbul ignore next */ entry.name;
            throw new Error(getMessage('CouldNotReadZipEntry', entryName, this.file, reason));
        }
    }

    public async extract(entry: string | StreamZip.ZipEntry | null, outPath: string): Promise<number | undefined> {
        try {
            return await this.streamZip.extract(entry, outPath);
        } catch (e) /* istanbul ignore next - Hard to make a ZIP that can do everything except extract */ {
            const reason = e instanceof Error ? e.message : /* istanbul ignore next */ e as string;
            throw new Error(getMessage('CouldNotExtractZip', this.file, reason));
        }
    }

    public close(): Promise<void> {
        return this.streamZip.close();
    }
}