import React, { useState, useEffect, useRef } from 'react';
import { BillGrid, BillGridLine } from '../components/BillGrid.js';
import { TotalsAndPaymentPanel } from '../components/TotalsAndPaymentPanel.js';
import { FunctionKeysBar } from '../components/FunctionKeysBar.js';
import { BatchSelectDialog } from '../components/dialogs/BatchSelectDialog.js';
import { CustomerDialog } from '../components/dialogs/CustomerDialog.js';
import { SubstitutesDialog } from '../components/dialogs/SubstitutesDialog.js';
import { HeldBillsDialog } from '../components/dialogs/HeldBillsDialog.js';
import { ReceiptPrintDialog } from '../components/dialogs/ReceiptPrintDialog.js';
import { calculateInvoiceTotals, generateUUIDv7 } from '@algions/domain';
import { api } from '../api/client.js';
import { offlineEngine } from '../offline/engine.js';
import { AuthSessionUser } from '@algions/contracts';

interface POSScreenProps {
  user: AuthSessionUser;
  isOffline: boolean;
  storeProfile: any;
  onRefreshSyncCount: () => void;
}

export const POSScreen: React.FC<POSScreenProps> = ({
  user,
  isOffline,
  storeProfile,
  onRefreshSyncCount,
}) => {
  const [lines, setLines] = useState<BillGridLine[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [customer, setCustomer] = useState<{ id?: string; name: string; phone: string; balancePaise: number } | null>(null);
  const [billDiscountPercent, setBillDiscountPercent] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK' | 'CREDIT'>('CASH');
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');

  // Search state
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Dialogs
  const [showBatchDialog, setShowBatchDialog] = useState<boolean>(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState<boolean>(false);
  const [showSubstitutesDialog, setShowSubstitutesDialog] = useState<boolean>(false);
  const [showHeldDialog, setShowHeldDialog] = useState<boolean>(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState<boolean>(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState<any | null>(null);
  const [heldBills, setHeldBills] = useState<any[]>([]);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load held bills on mount
  useEffect(() => {
    const fetchHeld = async () => {
      try {
        const res = await api.getHeldBills();
        setHeldBills(res.heldBills || []);
      } catch {
        // fallback
      }
    };
    fetchHeld();
  }, []);

  // Search autocomplete
  useEffect(() => {
    if (searchInput.trim().length >= 2) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        try {
          const res = await api.searchProducts(searchInput.trim());
          setSearchResults(res.results || []);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 120);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchInput]);

  // Calculate totals
  const totals = calculateInvoiceTotals({
    lines: lines.map((l) => ({
      productId: l.productId,
      batchId: l.batchId,
      quantity: l.quantity,
      unitsPerPack: l.unitsPerPack,
      saleRatePaise: l.saleRatePaise,
      mrpPaise: l.mrpPaise,
      discountPercent: l.discountPercent,
      taxRatePercent: l.taxRatePercent,
    })),
    billDiscountPercent,
  });

  const focusedLine = lines[focusedIndex] ?? null;

  // Add Item to bill (Barcode scan or select result)
  const handleSelectSearchResult = (result: any) => {
    const p = result.product;
    const batches = result.batches || [];
    if (batches.length === 0) {
      setErrorMessage(`No stock available for ${p.brandName}.`);
      return;
    }

    // FEFO: earliest non-expired batch is first
    const primaryBatch = batches[0];

    const newLine: BillGridLine = {
      id: generateUUIDv7(),
      productId: p.id,
      productName: p.brandName,
      genericName: p.genericName,
      strength: p.strength,
      dosageForm: p.dosageForm,
      batchId: primaryBatch.id,
      batchNumber: primaryBatch.batchNumber,
      expiryDate: primaryBatch.expiryDate,
      mrpPaise: primaryBatch.mrpPaise,
      saleRatePaise: primaryBatch.saleRatePaise,
      quantity: Math.min(10, primaryBatch.quantity), // default 1 strip / 10 tabs
      unitsPerPack: p.unitsPerPack,
      packUnitLabel: p.packUnitLabel,
      looseUnitLabel: p.looseUnitLabel,
      discountPercent: 0,
      taxRatePercent: p.taxRatePercent,
      availableStock: primaryBatch.quantity,
      rackLocation: primaryBatch.rackLocation,
    };

    setLines((prev) => [...prev, newLine]);
    setFocusedIndex(lines.length);
    setSearchInput('');
    setSearchResults([]);
    setErrorMessage(null);
  };

  const handleBarcodeScan = (barcode: string) => {
    // Search by barcode
    api.searchProducts(barcode).then((res) => {
      if (res.results && res.results.length > 0) {
        handleSelectSearchResult(res.results[0]);
      } else {
        setErrorMessage(`Barcode ${barcode} not found in medicine master.`);
      }
    });
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
    if (focusedIndex >= idx && focusedIndex > 0) {
      setFocusedIndex(focusedIndex - 1);
    }
  };

  const handleQuantityChange = (idx: number, qty: number) => {
    setLines((prev) => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], quantity: Math.max(1, qty) };
      }
      return updated;
    });
  };

  const handleDiscountChange = (idx: number, disc: number) => {
    setLines((prev) => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], discountPercent: Math.min(100, Math.max(0, disc)) };
      }
      return updated;
    });
  };

  // Hold Bill (F5)
  const handleHoldBill = async () => {
    if (lines.length === 0) return;
    const holdPayload = {
      id: generateUUIDv7(),
      customerName: customer?.name || 'Walk-in',
      customerPhone: customer?.phone || '',
      heldAt: new Date().toISOString(),
      lines: lines.map((l) => ({
        productId: l.productId,
        batchId: l.batchId,
        quantity: l.quantity,
        unitsPerPack: l.unitsPerPack,
        saleRatePaise: l.saleRatePaise,
        mrpPaise: l.mrpPaise,
        discountPercent: l.discountPercent,
        taxRatePercent: l.taxRatePercent,
      })),
    };

    try {
      await api.saveHeldBill(holdPayload);
      setHeldBills((prev) => [holdPayload, ...prev]);
      setLines([]);
      setCustomer(null);
      setErrorMessage(null);
    } catch {
      // fallback
    }
  };

  // Resume Bill (F6)
  const handleResumeBill = async (bill: any) => {
    setLines([]);
    // Restore lines
    for (const l of bill.lines || []) {
      const prodRes = await api.searchProducts('');
      const p = prodRes.results?.find((r) => r.product.id === l.productId);
      if (p) {
        handleSelectSearchResult(p);
      }
    }
    if (bill.customerName) {
      setCustomer({
        name: bill.customerName,
        phone: bill.customerPhone || '',
        balancePaise: 0,
      });
    }
    await api.deleteHeldBill(bill.id);
    setHeldBills((prev) => prev.filter((b) => b.id !== bill.id));
  };

  // Save & Print (F10 / Ctrl+Enter)
  const handleSaveAndPrint = async () => {
    if (lines.length === 0) {
      setErrorMessage('Add at least one medicine before checkout.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const idempotencyKey = `pos-${Date.now()}-${generateUUIDv7()}`;
    const payload = {
      lines: lines.map((l) => ({
        productId: l.productId,
        batchId: l.batchId,
        quantity: l.quantity,
        unitsPerPack: l.unitsPerPack,
        saleRatePaise: l.saleRatePaise,
        mrpPaise: l.mrpPaise,
        discountPercent: l.discountPercent,
        taxRatePercent: l.taxRatePercent,
      })),
      customerId: customer?.id,
      customerName: customer?.name,
      customerPhone: customer?.phone,
      billDiscountPercent,
      payments: [
        {
          mode: paymentMode,
          amountPaise: totals.grandTotalPaise,
        },
      ],
      idempotencyKey,
    };

    try {
      let savedInvoice: any;

      if (isOffline) {
        // Offline Mode: Atomic local commit via Offline Engine!
        savedInvoice = await offlineEngine.commitOfflineSale(payload, {
          id: user.id,
          name: user.name,
          storeId: user.storeId,
          deviceId: user.deviceId,
        });
        onRefreshSyncCount();
      } else {
        // Online Mode: Atomic Cloud POS Transaction with Row Locking
        savedInvoice = await api.createSale(payload, idempotencyKey);
      }

      setLastSavedInvoice(savedInvoice);
      setShowReceiptDialog(true);

      // Clear current bill
      setLines([]);
      setCustomer(null);
      setBillDiscountPercent(0);
      setCashReceivedInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete sale transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {errorMessage && (
        <div className="bg-red-500 text-white px-4 py-2 text-xs font-bold flex items-center justify-between select-none">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Main 60/40 Split Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left 60%: Bill Grid */}
        <BillGrid
          lines={lines}
          focusedIndex={focusedIndex}
          searchInput={searchInput}
          searchResults={searchResults}
          isSearching={isSearching}
          onSearchChange={setSearchInput}
          onSelectSearchResult={handleSelectSearchResult}
          onLineClick={setFocusedIndex}
          onQuantityChange={handleQuantityChange}
          onDiscountChange={handleDiscountChange}
          onRemoveLine={handleRemoveLine}
          onBarcodeScanSubmit={handleBarcodeScan}
        />

        {/* Right 40%: Customer, Totals & Payment */}
        <TotalsAndPaymentPanel
          customer={customer}
          focusedLine={focusedLine}
          totals={totals}
          billDiscountPercent={billDiscountPercent}
          paymentMode={paymentMode}
          cashReceivedInput={cashReceivedInput}
          onSelectCustomerClick={() => setShowCustomerDialog(true)}
          onBillDiscountChange={setBillDiscountPercent}
          onPaymentModeChange={setPaymentMode}
          onCashReceivedChange={setCashReceivedInput}
          onQuickCashAmount={(amt) => setCashReceivedInput((amt / 100).toString())}
        />
      </div>

      {/* Bottom Bar: Function Keys */}
      <FunctionKeysBar
        onF2Search={() => {}}
        onF3Customer={() => setShowCustomerDialog(true)}
        onF4Batch={() => setShowBatchDialog(true)}
        onF5Hold={handleHoldBill}
        onF6Resume={() => setShowHeldDialog(true)}
        onF7Discount={() => {}}
        onF8PaymentSplit={() => {}}
        onF9Substitutes={() => setShowSubstitutesDialog(true)}
        onF10SavePrint={handleSaveAndPrint}
        onEscClear={() => {
          if (lines.length > 0 && window.confirm('Clear current bill items?')) {
            setLines([]);
            setCustomer(null);
          }
        }}
        isSaving={isSaving}
      />

      {/* Dialogs */}
      {showBatchDialog && focusedLine && (
        <BatchSelectDialog
          productName={focusedLine.productName}
          batches={[]} // will load batches
          selectedBatchId={focusedLine.batchId}
          onSelectBatch={(b) => {
            setLines((prev) => {
              const updated = [...prev];
              if (updated[focusedIndex]) {
                updated[focusedIndex] = {
                  ...updated[focusedIndex],
                  batchId: b.id,
                  batchNumber: b.batchNumber,
                  expiryDate: b.expiryDate,
                  mrpPaise: b.mrpPaise,
                  saleRatePaise: b.saleRatePaise,
                  availableStock: b.quantity,
                  rackLocation: b.rackLocation,
                };
              }
              return updated;
            });
          }}
          onClose={() => setShowBatchDialog(false)}
        />
      )}

      {showCustomerDialog && (
        <CustomerDialog
          onSelectCustomer={setCustomer}
          onClose={() => setShowCustomerDialog(false)}
        />
      )}

      {showSubstitutesDialog && focusedLine && (
        <SubstitutesDialog
          productName={focusedLine.productName}
          genericName={focusedLine.genericName}
          strength={focusedLine.strength}
          substitutes={[]}
          onSelectSubstitute={() => {}}
          onClose={() => setShowSubstitutesDialog(false)}
        />
      )}

      {showHeldDialog && (
        <HeldBillsDialog
          heldBills={heldBills}
          onResume={handleResumeBill}
          onDiscard={async (id) => {
            await api.deleteHeldBill(id);
            setHeldBills((prev) => prev.filter((b) => b.id !== id));
          }}
          onClose={() => setShowHeldDialog(false)}
        />
      )}

      {showReceiptDialog && lastSavedInvoice && (
        <ReceiptPrintDialog
          invoice={lastSavedInvoice}
          store={storeProfile}
          onClose={() => setShowReceiptDialog(false)}
        />
      )}
    </div>
  );
};
