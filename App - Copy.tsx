
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CreditCard, Upload, Plus, Trash2, Calendar, DollarSign, Activity, 
  CheckCircle, ArrowRight, BrainCircuit, LayoutDashboard, X, 
  Image as ImageIcon, ClipboardList, Loader2, Sparkles, ChevronRight, 
  PencilLine, Keyboard, Images, Download, RefreshCw, Save, Settings, 
  PieChart as PieChartIcon, ExternalLink, AlertTriangle, Tag, PlusCircle,
  ShoppingBasket, ShoppingBag, Car, Utensils, Zap, Film, HeartPulse, Wallet
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';

import { Account, Transaction, TabType, StatementInfo, RewardRule, Benefits } from './types.ts';
import { INITIAL_ACCOUNTS, INITIAL_TRANSACTIONS, CATEGORIES } from './constants.ts';
import { fmt, getDueDateDistance, getGoogleCalendarLink } from './utils.ts';
import { Card, Button } from './components/UI.tsx';
import { getSpendingInsights, extractFromImage, extractFromText } from './services/geminiService.ts';

// Helper for category icons
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Groceries': return <ShoppingBasket size={14} />;
    case 'Shopping': return <ShoppingBag size={14} />;
    case 'Transport': return <Car size={14} />;
    case 'Dining': return <Utensils size={14} />;
    case 'Utilities': return <Zap size={14} />;
    case 'Entertainment': return <Film size={14} />;
    case 'Health': return <HeartPulse size={14} />;
    default: return <Wallet size={14} />;
  }
};

export default function CreditMind() {
  // --- Tab & Global State ---
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [importMode, setImportMode] = useState<'screenshot' | 'text' | 'manual'>('screenshot');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- Data Persistence ---
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem('cm_accounts_v4');
      if (!saved) return INITIAL_ACCOUNTS;
      const parsed = JSON.parse(saved);
      return parsed.length > 0 ? parsed : INITIAL_ACCOUNTS;
    } catch { return INITIAL_ACCOUNTS; }
  });
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('cm_transactions_v4');
      if (!saved) return INITIAL_TRANSACTIONS;
      return JSON.parse(saved);
    } catch { return INITIAL_TRANSACTIONS; }
  });

  useEffect(() => {
    localStorage.setItem('cm_accounts_v4', JSON.stringify(accounts));
    localStorage.setItem('cm_transactions_v4', JSON.stringify(transactions));
  }, [accounts, transactions]);

  // --- UI Logic States ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [detectedData, setDetectedData] = useState<StatementInfo | null>(null);
  const [targetAccountId, setTargetAccountId] = useState(accounts[0]?.id || 1);
  const [importStatus, setImportStatus] = useState({ msg: "", type: "" });
  const [aiInsights, setAiInsights] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  
  // Modals
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [manualTx, setManualTx] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split('T')[0],
    description: "",
    amount: 0,
    category: "General",
    accountId: accounts[0]?.id || 1
  });

  // --- Derived Analytics ---
  const stats = useMemo(() => {
    const totalDebt = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const categoryData = CATEGORIES.map(cat => ({
      name: cat,
      value: transactions.filter(t => t.category === cat).reduce((sum, t) => sum + (t.amount || 0), 0)
    })).filter(d => d.value > 0);
    
    return { totalDebt, categoryData };
  }, [accounts, transactions]);

  // --- Handlers ---
  const handleSaveManualTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTx.description || !manualTx.amount || !manualTx.accountId) return;

    const newTransaction: Transaction = {
      id: Date.now(),
      date: manualTx.date || new Date().toISOString().split('T')[0],
      description: manualTx.description,
      amount: Number(manualTx.amount),
      category: manualTx.category || "General",
      accountId: Number(manualTx.accountId)
    };

    setTransactions(prev => [newTransaction, ...prev]);
    setAccounts(prev => prev.map(acc => {
      if (acc.id === newTransaction.accountId) {
        return { ...acc, balance: (acc.balance || 0) + newTransaction.amount };
      }
      return acc;
    }));

    setIsAddingTransaction(false);
    setManualTx({
      date: new Date().toISOString().split('T')[0],
      description: "",
      amount: 0,
      category: "General",
      accountId: accounts[0]?.id || 1
    });
  };

  /**
   * Fix: Use globalThis.Blob to explicitly refer to the browser's Blob constructor,
   * avoiding potential shadowing issues from library type definitions.
   */
  const handleBackup = () => {
    const data = JSON.stringify({ accounts, transactions });
    const backupBlob = new globalThis.Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(backupBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `creditmind_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    // Cleanup the URL to avoid memory leaks
    URL.revokeObjectURL(url);
  };

  /**
   * Fix: Ensure reader.onload handles the result as a string explicitly.
   */
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') return;
        const data = JSON.parse(result);
        if (data && data.accounts && data.transactions) {
          setAccounts(data.accounts);
          setTransactions(data.transactions);
          alert("Backup restored!");
        }
      } catch { alert("Invalid backup file."); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const deleteTransaction = (id: number) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    if (confirm("Delete this transaction?")) {
      setTransactions(prev => prev.filter(t => t.id !== id));
      setAccounts(prev => prev.map(acc => {
        if (acc.id === tx.accountId) return { ...acc, balance: acc.balance - tx.amount };
        return acc;
      }));
    }
  };

  // --- Sub-Components ---

  const TransactionModal = () => {
    if (!isAddingTransaction) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
        <Card className="max-w-xl w-full p-8 border-none shadow-3xl animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-slate-900">New Transaction</h3>
            <button onClick={() => setIsAddingTransaction(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X/></button>
          </div>
          
          <form onSubmit={handleSaveManualTx} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Target Account</label>
                <select 
                  required 
                  value={manualTx.accountId} 
                  onChange={e => setManualTx({...manualTx, accountId: Number(e.target.value)})}
                  className="w-full p-3 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({fmt(acc.balance)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Description</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Tag size={18}/></div>
                  <input 
                    type="text" required placeholder="Where did you spend?"
                    value={manualTx.description} 
                    onChange={e => setManualTx({...manualTx, description: e.target.value})} 
                    className="w-full p-3 pl-10 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Amount</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">RM</div>
                    <input 
                      type="number" step="0.01" required 
                      value={manualTx.amount} 
                      onChange={e => setManualTx({...manualTx, amount: Number(e.target.value)})} 
                      className="w-full p-3 pl-10 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Date</label>
                  <input 
                    type="date" required 
                    value={manualTx.date} 
                    onChange={e => setManualTx({...manualTx, date: e.target.value})} 
                    className="w-full p-3 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat} type="button"
                      onClick={() => setManualTx({...manualTx, category: cat})}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 border-2 ${manualTx.category === cat ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {getCategoryIcon(cat)} {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full py-4 text-lg font-black shadow-xl" icon={Plus}>Add to Ledger</Button>
          </form>
        </Card>
      </div>
    );
  };

  const CardEditorModal = () => {
    if (!editingAccount) return null;
    const colors = ["bg-blue-600", "bg-emerald-600", "bg-indigo-600", "bg-rose-600", "bg-amber-500", "bg-slate-700", "bg-orange-500", "bg-yellow-500"];
    
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
        <Card className="max-w-xl w-full max-h-[90vh] overflow-y-auto p-8 border-none shadow-3xl animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-slate-900">Edit Card Rules</h3>
            <button onClick={() => setEditingAccount(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X/></button>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            setAccounts(prev => prev.map(a => a.id === editingAccount.id ? editingAccount : a));
            setEditingAccount(null);
          }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Card Display Name</label>
                <input type="text" required value={editingAccount.name} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Card Theme</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map(c => (
                    <button key={c} type="button" onClick={() => setEditingAccount({...editingAccount, color: c})} className={`w-8 h-8 rounded-full ${c} ${editingAccount.color === c ? 'ring-4 ring-slate-200 scale-110' : ''} transition-all`}/>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Credit Limit</label>
                <input type="number" required value={editingAccount.limit} onChange={e => setEditingAccount({...editingAccount, limit: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Due Day (1-31)</label>
                <input type="number" min="1" max="31" required value={editingAccount.dueDay} onChange={e => setEditingAccount({...editingAccount, dueDay: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl space-y-4 border border-slate-100">
               <div className="flex justify-between items-center">
                 <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Reward Strategy</h4>
                 <select value={editingAccount.benefits.type} onChange={e => setEditingAccount({...editingAccount, benefits: {...editingAccount.benefits, type: e.target.value as any}})} className="bg-white border text-[10px] font-black p-1 rounded-lg">
                    <option value="cashback">Cashback (%)</option>
                    <option value="points">Points (x)</option>
                 </select>
               </div>
               
               <div className="grid grid-cols-2 gap-4 border-b pb-4">
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Base Rate</label>
                    <input type="number" step="0.1" value={editingAccount.benefits.baseRate} onChange={e => setEditingAccount({...editingAccount, benefits: {...editingAccount.benefits, baseRate: Number(e.target.value)}})} className="w-full p-2 border rounded-lg font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Monthly Reward Cap</label>
                    <input type="number" value={editingAccount.benefits.cap} onChange={e => setEditingAccount({...editingAccount, benefits: {...editingAccount.benefits, cap: Number(e.target.value)}})} className="w-full p-2 border rounded-lg font-bold text-sm" placeholder="0 = Unlimited" />
                  </div>
               </div>

               <div className="space-y-3">
                 <div className="flex justify-between items-center">
                   <label className="text-[10px] font-black text-slate-400 uppercase block tracking-widest">Category Multipliers</label>
                   <button type="button" onClick={() => {
                     setEditingAccount({...editingAccount, benefits: {...editingAccount.benefits, rules: [...editingAccount.benefits.rules, {category: "Dining", rate: 5}]}});
                   }} className="text-blue-600 text-[10px] font-black flex items-center gap-1"><Plus size={12}/> ADD RULE</button>
                 </div>
                 {editingAccount.benefits.rules.map((rule, idx) => (
                   <div key={idx} className="flex gap-2 animate-in slide-in-from-left-2">
                     <select value={rule.category} onChange={e => {
                        const rules = [...editingAccount.benefits.rules];
                        rules[idx].category = e.target.value;
                        setEditingAccount({...editingAccount, benefits: {...editingAccount.benefits, rules}});
                     }} className="flex-1 p-2 border rounded-lg text-xs font-bold bg-white">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <input type="number" step="0.1" value={rule.rate} onChange={e => {
                        const rules = [...editingAccount.benefits.rules];
                        rules[idx].rate = Number(e.target.value);
                        setEditingAccount({...editingAccount, benefits: {...editingAccount.benefits, rules}});
                     }} className="w-20 p-2 border rounded-lg font-bold text-xs bg-white text-center" />
                     <button type="button" onClick={() => {
                        const rules = editingAccount.benefits.rules.filter((_, i) => i !== idx);
                        setEditingAccount({...editingAccount, benefits: {...editingAccount.benefits, rules}});
                     }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
                   </div>
                 ))}
               </div>
            </div>

            <Button type="submit" className="w-full py-4 font-black shadow-xl" icon={Save}>Apply Card Changes</Button>
          </form>
        </Card>
      </div>
    );
  };

  const DashboardView = () => (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Overview</h2>
          <p className="text-slate-500 font-medium">Monitoring {accounts.length} active lines.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon={PlusCircle} onClick={() => setIsAddingTransaction(true)}>Add Transaction</Button>
          <Button icon={Plus} onClick={() => setActiveTab('analysis')}>Sync Bill</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 bg-slate-900 text-white border-none shadow-2xl relative group overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:rotate-12 transition-all duration-700"><DollarSign size={120}/></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Utilization</p>
          <div className="text-4xl font-black tracking-tight">{fmt(stats.totalDebt)}</div>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-400"><Activity size={14}/> {transactions.length} Records</div>
        </Card>

        <Card className="p-8 border-l-8 border-l-blue-500 shadow-xl flex flex-col justify-between">
           <div>
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Next Payment Due</p>
             <div className="text-2xl font-black text-slate-800">
                {accounts.length > 0 ? accounts.sort((a,b) => getDueDateDistance(a.dueDay) - getDueDateDistance(b.dueDay))[0].name : "N/A"}
             </div>
           </div>
           {accounts.length > 0 && (
             <a href={getGoogleCalendarLink(accounts[0].name, accounts[0].balance, accounts[0].dueDay)} target="_blank" className="text-blue-600 font-black text-[10px] flex items-center gap-1 mt-4 hover:underline uppercase tracking-widest">
               <Calendar size={14}/> Entry to Google Calendar
             </a>
           )}
        </Card>

        <Card className="p-8 border-l-8 border-l-emerald-500 shadow-xl">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">AI Optimization</p>
           <div className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-2">
             Strategy <Sparkles className="text-emerald-500" size={24}/>
           </div>
           <p className="text-xs text-slate-400 font-medium mt-2">Active based on rewards rules</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-8">
           <div className="flex justify-between items-center mb-8">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><PieChartIcon className="text-blue-500" size={20}/> Spend Analysis</h3>
             <Button variant="ghost" onClick={() => setActiveTab('analysis')} className="text-xs font-bold text-blue-600">Sync More</Button>
           </div>
           <div className="h-80">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={stats.categoryData} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                   {stats.categoryData.map((_, i) => <Cell key={i} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5]} />)}
                 </Pie>
                 <Tooltip formatter={(v: number) => fmt(v)}/>
                 <Legend verticalAlign="bottom" height={36} iconType="circle" />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </Card>

        <Card className="p-8">
           <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><Activity className="text-orange-500" size={20}/> Recent Ledger</h3>
           <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
             {transactions.slice(0, 8).map(tx => (
               <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group relative overflow-hidden border border-slate-100">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-white rounded-lg shadow-sm text-blue-500">{getCategoryIcon(tx.category)}</div>
                   <div>
                     <div className="text-xs font-black text-slate-800 truncate max-w-[120px]">{tx.description}</div>
                     <div className="text-[8px] font-black text-slate-400 uppercase">{tx.date}</div>
                   </div>
                 </div>
                 <div className="text-right">
                   <div className="text-xs font-black text-slate-900">{fmt(tx.amount)}</div>
                   <button onClick={() => deleteTransaction(tx.id)} className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                 </div>
               </div>
             ))}
             {transactions.length === 0 && <div className="text-center py-10 text-slate-400 font-bold text-xs uppercase tracking-widest">No entries yet</div>}
           </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-80 bg-slate-900 shrink-0 lg:fixed lg:h-screen p-10 flex flex-col gap-10 z-[60]">
        <div className="flex items-center gap-4 text-white group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="p-3 bg-blue-600 rounded-2xl shadow-2xl group-hover:rotate-12 transition-all">
            <CreditCard size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">CreditMind</h1>
        </div>
        
        <nav className="flex flex-col gap-2">
          {[
            { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
            { id: 'accounts', label: 'Portfolio', icon: CreditCard },
            { id: 'analysis', label: 'Sync Bill', icon: Upload },
            { id: 'ai-insights', label: 'Strategy', icon: BrainCircuit },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)} 
              className={`p-4 rounded-2xl font-black flex items-center justify-between transition-all duration-300 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <div className="flex items-center gap-4">
                <item.icon size={20} /> <span className="text-sm">{item.label}</span>
              </div>
              <ChevronRight size={14} className={activeTab === item.id ? 'rotate-90' : 'opacity-0'} />
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-80 p-8 lg:p-16 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <DashboardView />}
          
          {activeTab === 'accounts' && (
            <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
              <header className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Portfolio</h2>
                  <p className="text-slate-500 font-medium">Manage assets and reward rules.</p>
                </div>
                <Button onClick={() => alert("Card creation logic follows portfolio templates.")} icon={Plus}>Add New Card</Button>
              </header>

              <div className="grid grid-cols-1 gap-8">
                {accounts.map(acc => (
                  <Card key={acc.id} className="p-8 group relative overflow-hidden">
                     <div className="flex flex-col md:flex-row gap-10">
                       <div className="w-full md:w-80 shrink-0">
                          <div className={`aspect-[1.6/1] rounded-3xl p-8 flex flex-col justify-between text-white shadow-2xl ${acc.color} group-hover:scale-105 transition-transform duration-500 relative overflow-hidden`}>
                            <div className="absolute top-0 right-0 p-4 opacity-10"><CreditCard size={100}/></div>
                            <div className="flex justify-between items-start relative z-10">
                              <Wallet size={32} />
                              <div className="text-right">
                                <div className="text-[8px] font-black uppercase opacity-60">Limit {fmt(acc.limit)}</div>
                                <div className="font-black text-xs tracking-tighter">Due Day {acc.dueDay}</div>
                              </div>
                            </div>
                            <div className="relative z-10">
                              <div className="text-[10px] font-black opacity-60 uppercase mb-1">{acc.name}</div>
                              <div className="text-2xl font-black tracking-tighter">{fmt(acc.balance)}</div>
                            </div>
                          </div>
                       </div>
                       <div className="flex-1 space-y-6">
                          <div className="flex justify-between border-b pb-4 items-center">
                             <h4 className="text-xl font-black text-slate-800">Benefit Profile</h4>
                             <Button variant="ghost" icon={PencilLine} onClick={() => setEditingAccount(acc)} className="text-blue-500 hover:bg-blue-50">Edit Rules</Button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="p-3 bg-slate-50 rounded-xl">
                               <p className="text-[8px] font-black text-slate-400 uppercase">Base Rate</p>
                               <p className="text-sm font-black">{acc.benefits.baseRate}{acc.benefits.type === 'cashback' ? '%' : 'x'}</p>
                             </div>
                             <div className="p-3 bg-slate-50 rounded-xl">
                               <p className="text-[8px] font-black text-slate-400 uppercase">Monthly Cap</p>
                               <p className="text-sm font-black">{acc.benefits.cap > 0 ? fmt(acc.benefits.cap) : "No Limit"}</p>
                             </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {acc.benefits.rules.map((rule, ri) => (
                              <div key={ri} className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2">
                                 <span className="text-[8px] font-black text-blue-400 uppercase">{rule.category}</span>
                                 <span className="text-xs font-black text-blue-600">{rule.rate}{acc.benefits.type === 'cashback' ? '%' : 'x'}</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-2">
                            <a href={getGoogleCalendarLink(acc.name, acc.balance, acc.dueDay)} target="_blank" className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest">
                               <Calendar size={14}/> Auto-Reminder to Google Calendar
                            </a>
                          </div>
                       </div>
                     </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
              <header>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Sync Billing</h2>
                <p className="text-slate-500 font-bold">Import bank statements automatically via Gemini AI.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                  <Card className="p-6">
                     <label className="text-[10px] font-black text-slate-400 uppercase mb-4 block tracking-widest">Target Account</label>
                     <div className="space-y-2">
                       {accounts.map(acc => (
                         <button key={acc.id} onClick={() => setTargetAccountId(acc.id)} className={`w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${targetAccountId === acc.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-100 bg-white'}`}>
                           <div className="text-left">
                             <div className="font-black text-slate-800 text-sm">{acc.name}</div>
                             <div className="text-[10px] text-slate-400 font-bold uppercase">{fmt(acc.balance)}</div>
                           </div>
                           {targetAccountId === acc.id && <CheckCircle size={18} className="text-blue-500" />}
                         </button>
                       ))}
                     </div>
                  </Card>
                </div>

                <div className="md:col-span-2 space-y-6">
                  {!detectedData ? (
                    <Card className="p-10 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                       {importMode === 'screenshot' ? (
                         <div className="w-full space-y-6">
                            <div className="p-8 bg-blue-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto text-blue-600"><Images size={40}/></div>
                            <p className="font-black text-slate-800 text-xl">Upload Statement Pages</p>
                            <input type="file" multiple accept="image/*" onChange={e => {
                              const files = Array.from(e.target.files || []);
                              files.forEach(f => {
                                const r = new FileReader();
                                r.onload = ev => setPreviewImages(p => [...p, ev.target?.result as string]);
                                r.readAsDataURL(f);
                              });
                            }} className="hidden" ref={fileInputRef} />
                            <div className="flex gap-4 justify-center">
                              <Button onClick={() => fileInputRef.current?.click()} variant="secondary" icon={Plus}>Select Images</Button>
                              {previewImages.length > 0 && <Button onClick={async () => {
                                setIsProcessing(true);
                                try {
                                  const res = await extractFromImage(previewImages.map(img => img.split(',')[1]));
                                  setDetectedData(res);
                                } catch { alert("Extraction failed."); }
                                finally { setIsProcessing(false); }
                              }} disabled={isProcessing} icon={Sparkles}>{isProcessing ? "AI Working..." : `Analyze ${previewImages.length} Pages`}</Button>}
                            </div>
                            <div className="grid grid-cols-4 gap-2 mt-4">
                              {previewImages.map((img, i) => (
                                <div key={i} className="relative aspect-square border rounded-lg overflow-hidden group">
                                   <img src={img} className="w-full h-full object-cover" />
                                   <button onClick={() => setPreviewImages(p => p.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><X/></button>
                                </div>
                              ))}
                            </div>
                         </div>
                       ) : (
                         <div className="w-full space-y-6">
                            <h4 className="font-black text-slate-800">Paste Billing Text</h4>
                            <textarea value={pastedText} onChange={e => setPastedText(e.target.value)} placeholder="Paste text from PDF/Bank Portal..." className="w-full h-64 p-4 border rounded-2xl bg-slate-50 font-mono text-xs focus:ring-4 outline-none" />
                            <Button onClick={async () => {
                               setIsProcessing(true);
                               try {
                                 const res = await extractFromText(pastedText);
                                 setDetectedData(res);
                               } catch { alert("Parsing failed."); }
                               finally { setIsProcessing(false); }
                            }} disabled={isProcessing || !pastedText} className="w-full" icon={Sparkles}>{isProcessing ? "Analyzing..." : "Process Text with Gemini"}</Button>
                         </div>
                       )}
                    </Card>
                  ) : (
                    <Card className="overflow-hidden border-none shadow-3xl animate-in slide-in-from-bottom-6">
                       <div className="bg-slate-900 p-8 text-white">
                         <div className="flex justify-between items-center mb-6">
                           <h4 className="text-xl font-black">Verify Data</h4>
                           <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setDetectedData(null)} icon={X}>Cancel</Button>
                         </div>
                         <div className="grid grid-cols-2 gap-8">
                           <div>
                             <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Closing Balance</p>
                             <div className="text-3xl font-black text-emerald-400">{fmt(detectedData.statementBalance || 0)}</div>
                           </div>
                           <div>
                             <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Due Date</p>
                             <div className="text-3xl font-black text-blue-400">{detectedData.dueDate || "N/A"}</div>
                           </div>
                         </div>
                       </div>
                       <div className="p-8 space-y-6 bg-white">
                         <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Transactions Found ({detectedData.transactions?.length || 0})</h5>
                         <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                           {detectedData.transactions?.map((tx, idx) => (
                             <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                               <div className="text-left">
                                 <div className="font-black text-slate-800 text-xs truncate max-w-[200px]">{tx.description}</div>
                                 <div className="text-[8px] font-black text-blue-500 uppercase">{tx.category}</div>
                               </div>
                               <div className="font-black text-sm">{fmt(tx.amount || 0)}</div>
                             </div>
                           ))}
                         </div>
                         <Button onClick={() => {
                            const newEntries = (detectedData.transactions || []).map(t => ({
                              id: Date.now() + Math.random(),
                              date: t.date || new Date().toISOString().split('T')[0],
                              description: t.description || "Unknown",
                              amount: t.amount || 0,
                              category: t.category || "General",
                              accountId: targetAccountId
                            } as Transaction));
                            setTransactions(prev => [...newEntries, ...prev]);
                            setAccounts(prev => prev.map(a => {
                              if (a.id === targetAccountId) {
                                return { ...a, balance: detectedData.statementBalance || a.balance };
                              }
                              return a;
                            }));
                            setDetectedData(null);
                            setPreviewImages([]);
                            setPastedText("");
                            alert("Synced successfully!");
                         }} className="w-full py-5 text-xl font-black shadow-2xl" icon={CheckCircle}>Confirm & Sync with Card</Button>
                       </div>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai-insights' && (
             <div className="max-w-2xl mx-auto text-center space-y-12 animate-in zoom-in-95 duration-500">
                <div className="p-16 bg-white rounded-[3rem] shadow-2xl border border-slate-100">
                  <div className="w-24 h-24 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                    <BrainCircuit size={48} />
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Strategy Optimizer</h2>
                  <p className="text-slate-500 text-lg font-medium">Gemini will analyze your rules vs. spending to find the best reward paths.</p>
                  <Button onClick={async () => {
                    setIsGeneratingAi(true);
                    try {
                      const res = await getSpendingInsights(transactions, accounts);
                      setAiInsights(res || "");
                    } catch { setAiInsights("Connection failed."); }
                    finally { setIsGeneratingAi(false); }
                  }} className="w-full mt-10 py-6 text-xl font-black shadow-2xl" disabled={isGeneratingAi}>
                    {isGeneratingAi ? "Thinking..." : "Optimize Rewards"}
                  </Button>
                </div>
                {aiInsights && (
                  <Card className="p-10 text-left shadow-2xl border-none ring-1 ring-slate-100">
                    <div className="prose prose-slate max-w-none font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{aiInsights}</div>
                  </Card>
                )}
             </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-10 animate-in zoom-in-95 duration-500">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight text-center">Settings</h2>
              <Card className="p-10 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-800">Export Ledger</h4>
                    <p className="text-xs text-slate-500 font-medium">Download local JSON backup.</p>
                  </div>
                  <Button icon={Download} onClick={handleBackup}>Export JSON</Button>
                </div>
                <div className="border-t pt-8 flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-800">Restore Data</h4>
                    <p className="text-xs text-slate-500 font-medium">Upload a previous JSON backup.</p>
                  </div>
                  <div className="relative">
                    <input type="file" onChange={handleRestore} className="absolute inset-0 opacity-0 cursor-pointer" accept=".json" />
                    <Button variant="secondary" icon={RefreshCw}>Restore</Button>
                  </div>
                </div>
                <div className="border-t pt-8">
                  <Button variant="danger" className="w-full" onClick={() => {
                    if(confirm("WIPE ALL DATA?")) { localStorage.clear(); window.location.reload(); }
                  }} icon={Trash2}>Reset All Local Storage</Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <TransactionModal />
      <CardEditorModal />
    </div>
  );
}
