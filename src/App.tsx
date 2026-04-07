import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { NotificationBadgesProvider } from "@/hooks/useNotificationBadges";
import { PermissionsProvider } from "@/hooks/usePermissions";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Welcome from "./pages/Welcome";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Treasury from "./pages/Treasury";
import Custody from "./pages/Custody";
import Employees from "./pages/Employees";
import Inventory from "./pages/Inventory";
import InventoryItems from "./pages/InventoryItems";
import InventoryTrialBalance from "./pages/reports/InventoryTrialBalance";
import NewRequest from "./pages/NewRequest";
import ManageRequests from "./pages/ManageRequests";
import ManageInvoiceRequests from "./pages/ManageInvoiceRequests";
import ConfirmedSalesInvoices from "./pages/ConfirmedSalesInvoices";
import ConfirmedPurchaseInvoices from "./pages/ConfirmedPurchaseInvoices";
import TrialBalance from "./pages/reports/TrialBalance";
import PartyTrialBalance from "./pages/reports/PartyTrialBalance";
import PartyStatement from "./pages/reports/PartyStatement";
import IncomeStatement from "./pages/reports/IncomeStatement";
import BalanceSheet from "./pages/reports/BalanceSheet";
import CashFlow from "./pages/reports/CashFlow";
import Journal from "./pages/reports/Journal";
import AccountLedgerReport from "./pages/reports/AccountLedgerReport";
import PartyEntries from "./pages/PartyEntries";
import ActionLogs from "./pages/ActionLogs";
import UsersPage from "./pages/Users";
import WorkOrders from "./pages/manufacturing/WorkOrders";
import CostReport from "./pages/manufacturing/CostReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PermissionsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ThemeProvider>
          <NotificationBadgesProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/change-password" element={<ProtectedRoute><ForcePasswordChange /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/chart-of-accounts" element={<ProtectedRoute><ChartOfAccounts /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
            <Route path="/treasury" element={<ProtectedRoute><Treasury /></ProtectedRoute>} />
            <Route path="/treasury/cash" element={<ProtectedRoute><Treasury /></ProtectedRoute>} />
            <Route path="/treasury/banks" element={<ProtectedRoute><Treasury /></ProtectedRoute>} />
            <Route path="/treasury/checks" element={<ProtectedRoute><Treasury /></ProtectedRoute>} />
            <Route path="/custody" element={<ProtectedRoute><Custody /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><InventoryItems /></ProtectedRoute>} />
            <Route path="/inventory/items" element={<ProtectedRoute><InventoryItems /></ProtectedRoute>} />
            <Route path="/inventory/new-request" element={<ProtectedRoute><NewRequest /></ProtectedRoute>} />
            <Route path="/inventory/requests" element={<ProtectedRoute><ManageRequests /></ProtectedRoute>} />
            <Route path="/inventory/movements" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/inventory/trial-balance" element={<ProtectedRoute><InventoryTrialBalance /></ProtectedRoute>} />
            <Route path="/invoices/manage" element={<ProtectedRoute><ManageInvoiceRequests /></ProtectedRoute>} />
            <Route path="/invoices/confirmed-sales" element={<ProtectedRoute><ConfirmedSalesInvoices /></ProtectedRoute>} />
            <Route path="/invoices/confirmed-purchases" element={<ProtectedRoute><ConfirmedPurchaseInvoices /></ProtectedRoute>} />
            <Route path="/reports/trial-balance" element={<ProtectedRoute><TrialBalance /></ProtectedRoute>} />
            <Route path="/reports/party-trial-balance" element={<ProtectedRoute><PartyTrialBalance /></ProtectedRoute>} />
            <Route path="/reports/party-statement" element={<ProtectedRoute><PartyStatement /></ProtectedRoute>} />
            <Route path="/reports/income-statement" element={<ProtectedRoute><IncomeStatement /></ProtectedRoute>} />
            <Route path="/reports/balance-sheet" element={<ProtectedRoute><BalanceSheet /></ProtectedRoute>} />
            <Route path="/reports/cash-flow" element={<ProtectedRoute><CashFlow /></ProtectedRoute>} />
            <Route path="/reports/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
            <Route path="/reports/account-ledger" element={<ProtectedRoute><AccountLedgerReport /></ProtectedRoute>} />
            <Route path="/party-entries" element={<ProtectedRoute><PartyEntries /></ProtectedRoute>} />
            <Route path="/manufacturing/orders" element={<ProtectedRoute><WorkOrders /></ProtectedRoute>} />
            <Route path="/manufacturing/costs" element={<ProtectedRoute><CostReport /></ProtectedRoute>} />
            <Route path="/action-logs" element={<ProtectedRoute><ActionLogs /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </NotificationBadgesProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
      </PermissionsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
