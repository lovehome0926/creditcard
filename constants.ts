
import { Account, Transaction } from './types.ts';

export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 1,
    name: "Maybank 2 Cards Gold",
    type: "credit",
    limit: 20000,
    statementDay: 21,
    dueDay: 10,
    benefits: {
      type: "cashback",
      baseRate: 0.5,
      rules: [
        { category: "Dining", rate: 5 },
        { category: "Shopping", rate: 5 }
      ],
      cap: 50,
      minSpend: 0
    },
    balance: 450.50,
    color: "bg-yellow-500"
  },
  {
    id: 2,
    name: "ShopeePayLater",
    type: "bnpl",
    limit: 3000,
    statementDay: 1,
    dueDay: 10,
    benefits: {
      type: "points",
      baseRate: 1,
      rules: [{ category: "Shopping", rate: 5 }],
      cap: 0,
      minSpend: 0
    },
    balance: 1200.00,
    color: "bg-orange-500"
  },
  {
    id: 3,
    name: "Public Bank Quantum",
    type: "credit",
    limit: 15000,
    statementDay: 15,
    dueDay: 5,
    benefits: {
      type: "cashback",
      baseRate: 0.2,
      rules: [{ category: "Online", rate: 5 }],
      cap: 30,
      minSpend: 0
    },
    balance: 0.00,
    color: "bg-red-600"
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 101, date: "2024-03-25", description: "Village Grocer", amount: 150.00, category: "Groceries", accountId: 1 },
  { id: 102, date: "2024-03-26", description: "Shopee Order", amount: 240.00, category: "Shopping", accountId: 2 },
  { id: 103, date: "2024-03-27", description: "Shell Petrol", amount: 80.00, category: "Transport", accountId: 1 },
  { id: 104, date: "2024-03-28", description: "Uniqlo Midvalley", amount: 129.90, category: "Shopping", accountId: 3 },
];

export const CATEGORIES = [
  "Groceries",
  "Shopping",
  "Transport",
  "Dining",
  "Utilities",
  "Entertainment",
  "Health",
  "General"
];
