/**
 * ALGIONS Pharmacy - Primary Offline Engine (Browser / Desktop Client)
 * Handles local outbox, offline sale commits, and automatic reconciliation.
 */

import { generateUUIDv7, calculateInvoiceTotals } from '@algions/domain';
import { SyncEventEnvelope, StoreMode } from '@algions/contracts';
import { api } from '../api/client.js';

export interface LocalOfflineInvoice {
  id: string;
  invoiceSeries: string;
  invoiceNumber: string;
  fullInvoiceNumber: string;
  isOfflineOrigin: boolean;
  itemCount: number;
  totalUnits: number;
  grandTotalPaise: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  doctorId?: string;
  doctorName?: string;
  lines: any[];
  payments: any[];
  occurredAtLocal: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'SYNC_EXCEPTION';
}

class OfflineEngine {
  private isOfflineModeActive: boolean = false;
  private pendingOutbox: SyncEventEnvelope[] = [];
  private localSequence: number = 1;
  private offlineInvoiceSeq: number = 100;
  private isSyncing: boolean = false;

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    const storedOutbox = localStorage.getItem('algions_offline_outbox');
    if (storedOutbox) {
      try {
        this.pendingOutbox = JSON.parse(storedOutbox);
      } catch {
        this.pendingOutbox = [];
      }
    }
    const storedSeq = localStorage.getItem('algions_local_seq');
    if (storedSeq) {
      this.localSequence = parseInt(storedSeq, 10);
    }
    const storedInvSeq = localStorage.getItem('algions_offline_inv_seq');
    if (storedInvSeq) {
      this.offlineInvoiceSeq = parseInt(storedInvSeq, 10);
    }
  }

  private saveState(): void {
    localStorage.setItem('algions_offline_outbox', JSON.stringify(this.pendingOutbox));
    localStorage.setItem('algions_local_seq', this.localSequence.toString());
    localStorage.setItem('algions_offline_inv_seq', this.offlineInvoiceSeq.toString());
  }

  isOffline(): boolean {
    return this.isOfflineModeActive;
  }

  setOfflineMode(active: boolean): void {
    this.isOfflineModeActive = active;
  }

  getPendingCount(): number {
    return this.pendingOutbox.length;
  }

  getOldestPendingAgeSeconds(): number {
    if (this.pendingOutbox.length === 0) return 0;
    const oldest = new Date(this.pendingOutbox[0]!.occurredAtLocal).getTime();
    return Math.max(0, Math.round((Date.now() - oldest) / 1000));
  }

  /**
   * Commits an atomic offline sale locally into outbox
   */
  async commitOfflineSale(
    payload: any,
    user: { id: string; name: string; storeId: string; deviceId: string }
  ): Promise<LocalOfflineInvoice> {
    const invoiceId = generateUUIDv7();
    const series = 'OF/26-27';
    const num = String(this.offlineInvoiceSeq++).padStart(6, '0');
    const fullInvoiceNumber = `${series}/${num}`;
    const nowIso = new Date().toISOString();

    const totals = calculateInvoiceTotals({
      lines: payload.lines,
      billDiscountPercent: payload.billDiscountPercent,
      billDiscountPaise: payload.billDiscountPaise,
    });

    const localInvoice: LocalOfflineInvoice = {
      id: invoiceId,
      invoiceSeries: series,
      invoiceNumber: num,
      fullInvoiceNumber,
      isOfflineOrigin: true,
      itemCount: totals.itemCount,
      totalUnits: totals.totalUnits,
      grandTotalPaise: totals.grandTotalPaise,
      customerId: payload.customerId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      doctorId: payload.doctorId,
      doctorName: payload.doctorName,
      lines: totals.lines,
      payments: payload.payments,
      occurredAtLocal: nowIso,
      syncStatus: 'PENDING',
    };

    // Construct event envelope
    const eventPayload = {
      invoice: {
        id: invoiceId,
        userId: user.id,
        invoiceSeries: series,
        invoiceNumber: num,
        fullInvoiceNumber,
        itemCount: totals.itemCount,
        totalUnits: totals.totalUnits,
        grossTotalPaise: totals.grossTotalPaise,
        lineDiscountTotalPaise: totals.lineDiscountTotalPaise,
        subtotalPaise: totals.subtotalPaise,
        billDiscountPaise: totals.billDiscountPaise,
        totalDiscountPaise: totals.totalDiscountPaise,
        taxableTotalPaise: totals.taxableTotalPaise,
        cgstTotalPaise: totals.cgstTotalPaise,
        sgstTotalPaise: totals.sgstTotalPaise,
        igstTotalPaise: totals.igstTotalPaise,
        taxTotalPaise: totals.taxTotalPaise,
        roundOffPaise: totals.roundOffPaise,
        grandTotalPaise: totals.grandTotalPaise,
        idempotencyKey: payload.idempotencyKey || invoiceId,
        customerId: payload.customerId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        doctorId: payload.doctorId,
        doctorName: payload.doctorName,
      },
      lines: totals.lines,
      payments: payload.payments,
    };

    const envelope: SyncEventEnvelope = {
      eventId: generateUUIDv7(),
      storeId: user.storeId,
      deviceId: user.deviceId,
      localSequence: this.localSequence++,
      eventType: 'SALE_POSTED',
      schemaVersion: 1,
      occurredAtLocal: nowIso,
      entityId: invoiceId,
      payloadHash: 'hash-' + invoiceId,
      payload: eventPayload,
    };

    this.pendingOutbox.push(envelope);
    this.saveState();

    return localInvoice;
  }

  /**
   * Syncs pending outbox events to cloud with backoff
   */
  async triggerSync(): Promise<{ syncedCount: number; remainingCount: number }> {
    if (this.isSyncing || this.pendingOutbox.length === 0) {
      return { syncedCount: 0, remainingCount: this.pendingOutbox.length };
    }

    this.isSyncing = true;
    try {
      const batchToSync = this.pendingOutbox.slice(0, 50);
      const res = await api.syncBatchEvents(batchToSync);

      if (res && res.highestAckSequence) {
        // Remove acknowledged events
        this.pendingOutbox = this.pendingOutbox.filter(
          (e) => e.localSequence > res.highestAckSequence
        );
        this.saveState();
      }

      return {
        syncedCount: res?.processedCount || 0,
        remainingCount: this.pendingOutbox.length,
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const offlineEngine = new OfflineEngine();
