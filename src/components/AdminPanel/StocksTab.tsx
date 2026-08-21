export default function StocksTab() {
 return (
 <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
 <h2 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-[#16161c] pb-3">Blood Bank Live Stocks</h2>

 <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
 <span className="text-sm leading-none">⚠️</span>
 <p className="text-xs font-medium leading-relaxed">
 <span className="font-semibold">Demo Data</span> — Blood bank stock integration coming soon
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="p-4 bg-[#070709] rounded-lg border border-[#1a1a20] space-y-3">
 <div className="flex justify-between items-center text-xs">
 <span className="font-semibold text-white">Central AIIMS Blood Bank</span>
 <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-medium">Govt Verified</span>
 </div>
 <div className="space-y-2 text-xs">
 <div className="flex justify-between text-zinc-400">
 <span>O-Negative</span>
 <span className="text-rose-400 font-semibold">12 Units</span>
 </div>
 <div className="w-full bg-[#141418] h-1.5 rounded-full overflow-hidden">
 <div className="bg-rose-500 h-full rounded-full" style={{ width: '30%' }} />
 </div>

 <div className="flex justify-between text-zinc-400">
 <span>B-Positive</span>
 <span className="text-emerald-400 font-semibold">48 Units</span>
 </div>
 <div className="w-full bg-[#141418] h-1.5 rounded-full overflow-hidden">
 <div className="bg-emerald-500 h-full rounded-full" style={{ width: '80%' }} />
 </div>
 </div>
 </div>

 <div className="p-4 bg-[#070709] rounded-lg border border-[#1a1a20] space-y-3">
 <div className="flex justify-between items-center text-xs">
 <span className="font-semibold text-white">Red Cross Regional Center</span>
 <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-medium">NGO Verified</span>
 </div>
 <div className="space-y-2 text-xs">
 <div className="flex justify-between text-zinc-400">
 <span>A-Positive</span>
 <span className="text-emerald-400 font-semibold">34 Units</span>
 </div>
 <div className="w-full bg-[#141418] h-1.5 rounded-full overflow-hidden">
 <div className="bg-emerald-500 h-full rounded-full" style={{ width: '65%' }} />
 </div>

 <div className="flex justify-between text-zinc-400">
 <span>AB-Negative</span>
 <span className="text-amber-400 font-semibold">5 Units</span>
 </div>
 <div className="w-full bg-[#141418] h-1.5 rounded-full overflow-hidden">
 <div className="bg-amber-500 h-full rounded-full" style={{ width: '15%' }} />
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
