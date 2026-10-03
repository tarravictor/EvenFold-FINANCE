import { addDays, Bill, dayLabel, Entry, Goal, GroupSplit, money, monthLabel, weekLabel } from "./finance-utils";

type Report = { period: "week" | "month" | "year"; weekStart: string; monthStart: string; entries: Entry[]; allLoans: Entry[]; groupSplits: GroupSplit[]; budgetCents: number | null; bills: Bill[]; goals: Goal[] };
const ink = "#182b34", muted = "#71858a", green = "#d8f2b2";
function block(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 14) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function label(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 22, weight = 400, color = ink) {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px Arial, sans-serif`; ctx.fillText(value, x, y);
}
function shorten(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}
function right(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 22, weight = 700, color = ink) {
  ctx.textAlign = "right"; label(ctx, value, x, y, size, weight, color); ctx.textAlign = "left";
}
export function renderReport(data: Report) {
  const expenses = data.entries.filter(e => e.kind === "expense");
  const spent = expenses.reduce((total, e) => total + e.amountCents, 0);
  const openLoans = data.allLoans.filter(e => e.kind === "loan" && !e.settled);
  const groupShares = data.groupSplits.filter(split => split.payer === "You").flatMap(split => split.shares.filter(share => share.name !== "You" && !share.paid).map(share => ({ split, share })));
  const groupDebts = data.groupSplits.filter(split => split.payer !== "You").flatMap(split => split.shares.filter(share => share.name === "You" && !share.paid).map(share => ({ split, share })));
  const outstanding = openLoans.reduce((total, e) => total + e.amountCents, 0) + groupShares.reduce((total, item) => total + item.share.amountCents, 0);
  const borrowers = new Map<string, number>();
  openLoans.forEach(e => borrowers.set(e.borrower || "Unknown", (borrowers.get(e.borrower || "Unknown") || 0) + e.amountCents));
  const categories = Object.entries(expenses.reduce<Record<string, number>>((totals, e) => { totals[e.category] = (totals[e.category] || 0) + e.amountCents; return totals; }, {})).sort((a,b)=>b[1]-a[1]);
  const rows = data.entries.filter(e => e.kind !== "income").sort((a,b)=>a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
  const visibleBills = [...data.bills].sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const height = Math.max(2600, 2600 + rows.length*65 + categories.length*52 + borrowers.size*50 + groupShares.length*50 + groupDebts.length*50 + visibleBills.length*51 + data.goals.length*51);
  if (height > 28000) throw new Error("This report is too large for an image. Choose a shorter period or export all transactions as CSV.");
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Report drawing is unavailable.");
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,1200,height);
  ctx.fillStyle = ink; ctx.fillRect(0,0,1200,24);
  block(ctx,70,75,58,58,green); label(ctx,"E",89,117,38,800);
  label(ctx,"EVENFOLD / FINANCE",151,103,20,800); label(ctx,`${data.period === "week" ? "Weekly" : data.period === "year" ? "Yearly" : "Monthly"} report`,151,132,18,400,muted);
  const periodName = data.period === "week" ? weekLabel(data.weekStart) : data.period === "year" ? data.monthStart.slice(0, 4) : monthLabel(data.monthStart);
  label(ctx,periodName,70,220,43,800); label(ctx,"Spending, loans, bills and savings goals",70,258,19,400,muted);
  const stats = [["SPENDING",money(spent)],["TO COLLECT",money(outstanding)],["TRANSACTIONS",String(rows.length)]];
  stats.forEach(([name,value],index)=>{ const x=70+index*360; block(ctx,x,305,340,128,index===0?"#e5f2cd":"#f0f5f3");label(ctx,name,x+17,343,15,800,muted);label(ctx,value,x+17,395,27,800); });
  let y=495;
  if(data.period === "week" && data.budgetCents !== null){label(ctx,`Weekly budget: ${money(data.budgetCents)}     Remaining: ${money(data.budgetCents-spent)}`,70,y,20,600);y+=52;}
  label(ctx,data.period === "week"?"Spending by day":"Spending by date range",70,y,28,800);y+=32;
  const periods = data.period === "year" ? Array.from({ length: 12 }, (_, i) => { const month = `${data.monthStart.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`; return { title: monthLabel(`${month}-01`), amount: expenses.filter(e => e.date.startsWith(month)).reduce((n, e) => n + e.amountCents, 0) }; }) : data.period === "week"
    ? Array.from({length:5},(_,i)=>{const date=addDays(data.weekStart,i);return{title:dayLabel(date),amount:expenses.filter(e=>e.date===date).reduce((total,e)=>total+e.amountCents,0)};})
    : Array.from({length:5},(_,i)=>({title:`Days ${1+i*7}–${Math.min((i+1)*7,new Date(Date.UTC(Number(data.monthStart.slice(0,4)),Number(data.monthStart.slice(5,7)),0)).getUTCDate())}`,amount:expenses.filter(e=>{const day=Number(e.date.slice(8,10));return day>i*7 && day<=Math.min((i+1)*7,31);}).reduce((total,e)=>total+e.amountCents,0)}));
  periods.forEach(item=>{y+=52;label(ctx,item.title,70,y,20,500);right(ctx,money(item.amount),1130,y,20,700);ctx.fillStyle="#e8eeee";ctx.fillRect(70,y+14,1060,1);});
  y+=81;label(ctx,"Spending categories",70,y,28,800);y+=42;
  if(!categories.length){label(ctx,"No spending recorded.",70,y,20,400,muted);y+=44;}
  else categories.forEach(([name,amount])=>{label(ctx,shorten(ctx,name,720),70,y,20,600);right(ctx,`${money(amount)}   ·   ${Math.round(amount/spent*100)}%`,1130,y,20,700);y+=48;});
  y+=35;label(ctx,"Transactions",70,y,28,800);y+=47;
  if(!rows.length){label(ctx,"No entries recorded for this period.",70,y,20,400,muted);y+=52;}
  else rows.forEach(e=>{ctx.font="700 20px Arial";label(ctx,shorten(ctx,`${e.description}${e.kind==="loan"?` · ${e.borrower}`:""}`,700),70,y,20,700);label(ctx,`${dayLabel(e.date)} · ${e.kind==="loan"?(e.settled?"Repaid loan":"Money lent"):e.category}`,70,y+24,16,400,muted);right(ctx,money(e.amountCents),1130,y+5,21,700);ctx.fillStyle="#e8eeee";ctx.fillRect(70,y+38,1060,1);y+=64;});
  y+=28;label(ctx,"Outstanding by person",70,y,28,800);y+=42;
  if(!borrowers.size){label(ctx,"Nothing outstanding.",70,y,20,400,muted);y+=45;}
  else for(const [name,amount] of borrowers){label(ctx,shorten(ctx,name,760),70,y,20,600);right(ctx,money(amount),1130,y,20,700);y+=47;}
  y+=35;label(ctx,"Group shares to collect · current snapshot",70,y,28,800);y+=42;
  if(!groupShares.length){label(ctx,"No group shares outstanding.",70,y,20,400,muted);y+=45;}
  else groupShares.forEach(({split,share})=>{label(ctx,shorten(ctx,`${share.name} · ${split.title}`,760),70,y,19,600);right(ctx,money(share.amountCents),1130,y,19,700);y+=47;});
  y+=35;label(ctx,"You owe on group bills · current snapshot",70,y,28,800);y+=42;
  if(!groupDebts.length){label(ctx,"No group shares owed.",70,y,20,400,muted);y+=45;}
  else groupDebts.forEach(({split,share})=>{label(ctx,shorten(ctx,`${split.payer} · ${split.title}`,760),70,y,19,600);right(ctx,money(share.amountCents),1130,y,19,700);y+=47;});
  y+=35;label(ctx,"Bills · current snapshot",70,y,28,800);y+=42;
  if(!visibleBills.length){label(ctx,"No bills tracked.",70,y,20,400,muted);y+=45;}
  else visibleBills.forEach(b=>{label(ctx,shorten(ctx,`${b.name} · ${dayLabel(b.dueDate)} · ${b.paid?"Paid":"Unpaid"}`,770),70,y,19,600);right(ctx,money(b.amountCents),1130,y,19,700);y+=47;});
  y+=35;label(ctx,"Savings goals · current snapshot",70,y,28,800);y+=42;
  if(!data.goals.length){label(ctx,"No savings goals tracked.",70,y,20,400,muted);y+=45;}
  else data.goals.forEach(g=>{label(ctx,shorten(ctx,g.name,660),70,y,19,600);right(ctx,`${money(g.savedCents)} / ${money(g.targetCents)}`,1130,y,19,700);y+=47;});
  label(ctx,"Loans and savings are separate from spending. Bills are reminders until recorded as expenses.",70,height-96,17,400,muted);
  label(ctx,"Generated from EvenFold FINANCE",70,height-62,17,400,muted);
  return canvas;
}
function download(blob:Blob,filename:string){return{url:URL.createObjectURL(blob),filename};}
export async function downloadReport(data:Report,format:"jpg"|"pdf"){
  const canvas=renderReport(data);
  const filename=`finance-${data.period}-${data.period==="week"?data.weekStart:data.monthStart}`;
  if(format==="jpg"){
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.94));
    if(!blob)throw new Error("Could not create the JPG report.");
    return download(blob,`${filename}.jpg`);
  }
  const{jsPDF}=await import("jspdf");const pdf=new jsPDF({unit:"pt",format:"a4",compress:true});
  const pageWidth=pdf.internal.pageSize.getWidth(),pageHeight=pdf.internal.pageSize.getHeight();
  const sliceHeight=Math.floor(canvas.width*pageHeight/pageWidth);
  for(let offset=0,page=0;offset<canvas.height;offset+=sliceHeight,page++){
    if(page)pdf.addPage();const slice=document.createElement("canvas");slice.width=canvas.width;slice.height=Math.min(sliceHeight,canvas.height-offset);
    const context=slice.getContext("2d");if(!context)throw new Error("Could not create the PDF page.");
    context.fillStyle="#fff";context.fillRect(0,0,slice.width,slice.height);context.drawImage(canvas,0,offset,canvas.width,slice.height,0,0,canvas.width,slice.height);
    pdf.addImage(slice.toDataURL("image/jpeg",.92),"JPEG",0,0,pageWidth,slice.height*pageWidth/canvas.width);
  }
  return download(pdf.output("blob"),`${filename}.pdf`);
}
