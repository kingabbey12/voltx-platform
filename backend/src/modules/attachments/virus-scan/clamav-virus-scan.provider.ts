import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'node:net';
import { VirusScanProvider, VirusScanResult } from './virus-scan-provider.interface';

const CHUNK_SIZE = 64 * 1024;
const SCAN_TIMEOUT_MS = 30000;

/**
 * Real ClamAV scanning over the clamd INSTREAM protocol (TCP) — not a
 * mock. Requires a reachable clamd daemon (CLAMAV_HOST/CLAMAV_PORT); a
 * standard `clamav/clamav-daemon` container works out of the box. See
 * https://docs.clamav.net/manual/Usage/Scanning.html#instream for the
 * wire protocol this implements.
 */
@Injectable()
export class ClamAvVirusScanProvider implements VirusScanProvider {
  readonly name = 'clamav';
  private readonly host: string;
  private readonly port: number;

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.get<string>('attachments.virusScan.clamavHost', '');
    this.port = this.configService.get<number>('attachments.virusScan.clamavPort', 3310);
  }

  async scan(buffer: Buffer): Promise<VirusScanResult> {
    const reply = await this.sendInstream(buffer);
    return parseClamdReply(reply);
  }

  /**
   * Called only by VirusScanModule's production boot check — confirms
   * clamd is actually reachable and responding, rather than deferring
   * that discovery to the first real upload in production.
   */
  async ping(): Promise<void> {
    const reply = await this.sendCommand('zPING\0');
    if (!reply.replace(/\0/g, '').trim().endsWith('PONG')) {
      throw new Error(`Unexpected ClamAV PING reply: "${reply}"`);
    }
  }

  private sendCommand(command: string): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        fn();
      };

      socket.setTimeout(SCAN_TIMEOUT_MS);
      socket.once('timeout', () => finish(() => reject(new Error('ClamAV ping timed out'))));
      socket.once('error', (error) => finish(() => reject(error)));
      socket.once('close', () => {
        if (!settled) {
          finish(() => resolvePromise(Buffer.concat(chunks).toString('utf-8')));
        }
      });
      socket.on('data', (data: Buffer) => chunks.push(data));

      socket.connect({ host: this.host, port: this.port }, () => {
        socket.write(command);
      });
    });
  }

  private sendInstream(buffer: Buffer): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        fn();
      };

      socket.setTimeout(SCAN_TIMEOUT_MS);
      socket.once('timeout', () => finish(() => reject(new Error('ClamAV scan timed out'))));
      socket.once('error', (error) => finish(() => reject(error)));
      socket.once('close', () => {
        if (!settled) {
          finish(() => resolvePromise(Buffer.concat(chunks).toString('utf-8')));
        }
      });
      socket.on('data', (data: Buffer) => chunks.push(data));

      socket.connect({ host: this.host, port: this.port }, () => {
        socket.write('zINSTREAM\0');

        for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
          const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
          const sizeHeader = Buffer.alloc(4);
          sizeHeader.writeUInt32BE(chunk.length, 0);
          socket.write(sizeHeader);
          socket.write(chunk);
        }

        const zeroChunk = Buffer.alloc(4);
        socket.write(zeroChunk);
      });
    });
  }
}

function parseClamdReply(reply: string): VirusScanResult {
  const cleaned = reply.replace(/\0/g, '').trim();

  if (/OK$/.test(cleaned)) {
    return { clean: true, skipped: false };
  }

  const foundMatch = /FOUND$/.exec(cleaned);
  if (foundMatch) {
    const threat = cleaned.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '');
    return { clean: false, threat, skipped: false };
  }

  throw new Error(`Unexpected ClamAV reply: "${cleaned}"`);
}
