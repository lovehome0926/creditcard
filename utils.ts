
export const fmt = (num: number) => 
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(num);

export const parseDateString = (dateStr: string): Date => {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  const parts = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (parts) return new Date(`${parts[3]}-${parts[2]}-${parts[1]}`);
  
  return new Date();
};

export const getDueDateDistance = (dueDay: number): number => {
  const today = new Date();
  const currentDay = today.getDate();
  let dist = dueDay - currentDay;
  if (dist < 0) dist += 30; // Approximation of days until next cycle
  return dist;
};

export const getGoogleCalendarLink = (cardName: string, amount: number, dueDay: number) => {
  const now = new Date();
  let targetMonth = now.getMonth();
  let targetYear = now.getFullYear();
  
  // If the due day has already passed this month, set for next month
  if (now.getDate() > dueDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }
  
  const dueDate = new Date(targetYear, targetMonth, dueDay);
  const dateStr = dueDate.toISOString().replace(/-|:|\.\d\d\d/g, "").split('T')[0];
  
  const title = encodeURIComponent(`Bill Due: ${cardName} (${fmt(amount)})`);
  const details = encodeURIComponent(`CreditMind Auto-Reminder: Please pay your ${cardName} statement by today.`);
  
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}&sf=true&output=xml`;
};
