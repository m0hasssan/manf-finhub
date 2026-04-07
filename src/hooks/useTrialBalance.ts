import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  currency: string;
  exchangeRate: number;
  debitOpening: number;
  creditOpening: number;
  debitMovement: number;
  creditMovement: number;
  debitClosing: number;
  creditClosing: number;
  // Foreign currency equivalents (debit/credit ÷ exchangeRate)
  fcDebitOpening: number;
  fcCreditOpening: number;
  fcDebitMovement: number;
  fcCreditMovement: number;
  fcDebitClosing: number;
  fcCreditClosing: number;
}

export function useTrialBalance() {
  return useQuery({
    queryKey: ["trial_balance"],
    queryFn: async () => {
      // Fetch all data sources in parallel
      const [
        { data: accounts },
        { data: customers },
        { data: suppliers },
        { data: bankAccounts },
        { data: inventoryItems },
      ] = await Promise.all([
        supabase.from("accounts").select("*").eq("is_active", true).order("code"),
        supabase.from("customers").select("id, name, code, opening_balance, account_id"),
        supabase.from("suppliers").select("id, name, code, opening_balance, account_id"),
        supabase.from("bank_accounts").select("id, name, current_balance, opening_balance, account_id"),
        supabase.from("inventory_items").select("id, name, code, current_stock, cost_price, account_id").eq("is_active", true),
      ]);

      // Fetch ALL journal entry lines with pagination to avoid 1000 row limit
      const journalEntryLines: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const { data: batch } = await supabase
          .from("journal_entry_lines")
          .select("account_id, debit, credit, journal_entry_id, journal_entries!inner(status)")
          .eq("journal_entries.status", "posted")
          .range(from, from + PAGE_SIZE - 1);
        if (!batch || batch.length === 0) break;
        journalEntryLines.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (!accounts) return [];

      // Build account currency map for exchange rate lookups
      const accountCurrencyMap: Record<string, { currency: string; rate: number }> = {};
      for (const acc of accounts) {
        accountCurrencyMap[acc.id] = { currency: acc.currency, rate: Number(acc.exchange_rate) || 1 };
      }

      // Build a map of account balances: { accountId: { debit, credit } }
      const balanceMap: Record<string, { debitMovement: number; creditMovement: number; openingBalance: number }> = {};

      const ensureAccount = (accountId: string) => {
        if (!balanceMap[accountId]) {
          balanceMap[accountId] = { debitMovement: 0, creditMovement: 0, openingBalance: 0 };
        }
      };

      // --- Customer balances (customers are asset/receivable accounts) ---
      // Each customer's opening_balance represents what they owe us (in original currency)
      for (const customer of customers || []) {
        if (customer.account_id) {
          ensureAccount(customer.account_id);
          const rawOB = Number(customer.opening_balance || 0);
          // opening_balance is already stored in EGP, no need to multiply by rate
          balanceMap[customer.account_id].openingBalance += rawOB;
        }
      }

      // --- Supplier balances (suppliers are liability/payable accounts) ---
      // Each supplier's opening_balance represents what we owe them (already in EGP)
      for (const supplier of suppliers || []) {
        if (supplier.account_id) {
          ensureAccount(supplier.account_id);
          const rawOB = Number(supplier.opening_balance || 0);
          // opening_balance is already stored in EGP, no need to multiply by rate
          balanceMap[supplier.account_id].openingBalance += rawOB;
        }
      }

      // --- Bank account balances ---
      for (const bank of bankAccounts || []) {
        if (bank.account_id) {
          ensureAccount(bank.account_id);
          balanceMap[bank.account_id].openingBalance += Number(bank.opening_balance || 0);
        }
      }

      // --- Inventory balances ---
      for (const item of inventoryItems || []) {
        if (item.account_id) {
          ensureAccount(item.account_id);
          balanceMap[item.account_id].openingBalance += Number((item as any).opening_stock || 0) * Number(item.cost_price || 0);
        }
      }


      // --- Journal Entry Lines (all posted entries - includes cash, invoices, manual entries) ---

      // --- Journal Entry Lines (manual journal entries including party entries) ---
      for (const line of journalEntryLines) {
        if (line.account_id) {
          ensureAccount(line.account_id);
          balanceMap[line.account_id].debitMovement += Number(line.debit || 0);
          balanceMap[line.account_id].creditMovement += Number(line.credit || 0);
        }
      }

      // --- Build trial balance rows from ALL accounts ---
      const rows: TrialBalanceRow[] = [];

      for (const acc of accounts) {
        const balance = balanceMap[acc.id] || { debitMovement: 0, creditMovement: 0, openingBalance: 0 };

        const obRate = Number(acc.exchange_rate) || 1;
        const accOpeningDebit = Number((acc as any).opening_balance_debit || 0) * obRate;
        const accOpeningCredit = Number((acc as any).opening_balance_credit || 0) * obRate;
        
        // Add linked entity opening balances (customers/suppliers/banks/inventory) based on account type
        let debitOpening = accOpeningDebit;
        let creditOpening = accOpeningCredit;
        
        const linkedOB = balance.openingBalance;
        if (linkedOB > 0) {
          if (acc.type === "asset" || acc.type === "expense") {
            debitOpening += linkedOB;
          } else {
            creditOpening += linkedOB;
          }
        } else if (linkedOB < 0) {
          if (acc.type === "asset" || acc.type === "expense") {
            creditOpening += Math.abs(linkedOB);
          } else {
            debitOpening += Math.abs(linkedOB);
          }
        }

        const debitMovement = balance.debitMovement;
        const creditMovement = balance.creditMovement;

        // Calculate closing balance
        let netClosing: number;
        if (acc.type === "asset" || acc.type === "expense") {
          netClosing = debitOpening - creditOpening + debitMovement - creditMovement;
        } else {
          netClosing = creditOpening - debitOpening + creditMovement - debitMovement;
        }

        let debitClosing = 0;
        let creditClosing = 0;
        if (acc.type === "asset" || acc.type === "expense") {
          if (netClosing >= 0) debitClosing = netClosing;
          else creditClosing = Math.abs(netClosing);
        } else {
          if (netClosing >= 0) creditClosing = netClosing;
          else debitClosing = Math.abs(netClosing);
        }

        const accCurrency = acc.currency || "EGP";
        const accRate = Number(acc.exchange_rate) || 1;
        const isForeign = accCurrency !== "EGP";

        rows.push({
          code: acc.code,
          name: acc.name,
          type: acc.type,
          currency: accCurrency,
          exchangeRate: accRate,
          debitOpening,
          creditOpening,
          debitMovement,
          creditMovement,
          debitClosing,
          creditClosing,
          fcDebitOpening: isForeign ? debitOpening / accRate : 0,
          fcCreditOpening: isForeign ? creditOpening / accRate : 0,
          fcDebitMovement: isForeign ? debitMovement / accRate : 0,
          fcCreditMovement: isForeign ? creditMovement / accRate : 0,
          fcDebitClosing: isForeign ? debitClosing / accRate : 0,
          fcCreditClosing: isForeign ? creditClosing / accRate : 0,
        });
      }

      // Sort by code
      rows.sort((a, b) => a.code.localeCompare(b.code));

      return rows;
    },
  });
}
