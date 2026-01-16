
export type AccountType = 'credit' | 'bnpl';
export type BenefitType = 'cashback' | 'points';

export interface RewardRule {
  category: string;
  rate: number; // Percentage for cashback or multiplier for points
}

export interface Benefits {
  type: BenefitType;
  baseRate: number;
  rules: RewardRule[];
  cap: number; // Monthly maximum reward
  minSpend: number; // Minimum spend to trigger reward
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  limit: number;
  statementDay: number;
  dueDay: number;
  benefits: Benefits;
  balance: number;
  color: string;
  lastSyncDate?: string;
}

export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  accountId: number;
}

export interface StatementInfo {
  dueDate?: string;
  statementBalance?: number;
  transactions: Partial<Transaction>[];
}

export type TabType = 'dashboard' | 'accounts' | 'analysis' | 'ai-insights' | 'settings';
