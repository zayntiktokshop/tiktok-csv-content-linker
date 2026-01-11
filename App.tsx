
import React, { useState, useMemo } from 'react';
import { Upload, ExternalLink, Search, Video, Users, User, Tag, X, Layers, TrendingUp, Filter, BarChart3, ShoppingBag, Check, Trophy, Sparkles } from 'lucide-react';
import { CsvRow, ProcessedData } from './types';

type ViewMode = 'video' | 'creator' | 'sku';

const parseCsv = (text: string): ProcessedData => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string) => {
    const result = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => h.trim().replace(/\uFEFF/g, ""));

  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const obj: CsvRow = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || "").trim();
    });
    return obj;
  });

  return { headers, rows };
};

const App: React.FC = () => {
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('video');
  const [searchTerm, setSearchTerm] = useState('');
  const [filesCount, setFilesCount] = useState(0);
  const [activeSkuFilters, setActiveSkuFilters] = useState<Set<string>>(new Set());

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    let combinedRows: CsvRow[] = [];
    let detectedHeaders: string[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const text = await files[i].text();
        const { headers: fileHeaders, rows: fileRows } = parseCsv(text);
        if (i === 0) detectedHeaders = fileHeaders;
        combinedRows = [...combinedRows, ...fileRows];
      } catch (err) {
        console.error("CSV 解析失败:", err);
      }
    }

    setHeaders(detectedHeaders);
    setAllRows(combinedRows);
    setFilesCount(files.length);
  };

  const globalMetrics = useMemo(() => {
    if (allRows.length === 0) return { orders: 0, qty: 0, creators: 0, contents: 0 };
    const orderKey = headers.find(h => h.includes("订单 ID")) || "订单 ID";
    const qtyKey = headers.find(h => h.includes("下单件数")) || "下单件数";
    const creatorKey = headers.find(h => h.includes("达人用户名")) || "达人用户名";
    const idKey = headers.find(h => h.includes("内容ID")) || "内容ID";

    const orderSet = new Set();
    const creatorSet = new Set();
    const contentSet = new Set();
    let totalQty = 0;

    allRows.forEach(row => {
      if (row[orderKey]) orderSet.add(row[orderKey]);
      if (row[creatorKey]) creatorSet.add(row[creatorKey]);
      if (row[idKey]) contentSet.add(row[idKey]);
      totalQty += parseInt(row[qtyKey] || "0") || 0;
    });

    return { orders: orderSet.size, qty: totalQty, creators: creatorSet.size, contents: contentSet.size };
  }, [allRows, headers]);

  const filteredRows = useMemo(() => {
    if (activeSkuFilters.size === 0) return allRows;
    const sellerSkuKey = headers.find(h => h.includes("Seller Sku")) || "Seller Sku";
    return allRows.filter(row => activeSkuFilters.has(row[sellerSkuKey] || "未设置SKU"));
  }, [allRows, activeSkuFilters, headers]);

  const aggregatedStats = useMemo(() => {
    const idKey = headers.find(h => h.includes("内容ID")) || "内容ID";
    const orderKey = headers.find(h => h.includes("订单 ID")) || "订单 ID";
    const creatorKey = headers.find(h => h.includes("达人用户名")) || "达人用户名";
    const skuNameKey = headers.find(h => h.includes("商品名称")) || "商品名称";
    const qtyKey = headers.find(h => h.includes("下单件数")) || "下单件数";
    const sellerSkuKey = headers.find(h => h.includes("Seller Sku")) || "Seller Sku";

    const vMap: any = {};
    const cMap: any = {};
    const sMap: any = {}; 

    filteredRows.forEach((row, idx) => {
      const vid = row[idKey] || "未知内容";
      const creator = row[creatorKey] || "未知达人";
      const sSku = row[sellerSkuKey] || "未设置SKU";
      const orderId = row[orderKey] || `row-${idx}`;
      const qty = parseInt(row[qtyKey] || "0") || 0;
      const skuName = row[skuNameKey] || "未命名商品";

      if (!vMap[vid]) vMap[vid] = { id: vid, creator, orderIds: new Set(), totalQty: 0, skus: {} };
      vMap[vid].orderIds.add(orderId);
      vMap[vid].totalQty += qty;
      if (!vMap[vid].skus[sSku]) vMap[vid].skus[sSku] = { count: 0 };
      vMap[vid].skus[sSku].count += qty;

      if (!cMap[creator]) cMap[creator] = { id: creator, orderIds: new Set(), totalQty: 0, videoIds: new Set(), skuStats: {}, videoStats: {} };
      cMap[creator].orderIds.add(orderId);
      cMap[creator].totalQty += qty;
      cMap[creator].videoIds.add(vid);
      if (!cMap[creator].skuStats[sSku]) cMap[creator].skuStats[sSku] = 0;
      cMap[creator].skuStats[sSku] += qty;
      if (!cMap[creator].videoStats[vid]) cMap[creator].videoStats[vid] = 0;
      cMap[creator].videoStats[vid] += qty;

      if (!sMap[skuName]) sMap[skuName] = { id: skuName, orderIds: new Set(), totalQty: 0, variants: {}, topVideos: {} };
      sMap[skuName].orderIds.add(orderId);
      sMap[skuName].totalQty += qty;
      if (!sMap[skuName].variants[sSku]) sMap[skuName].variants[sSku] = { id: sSku, qty: 0 };
      sMap[skuName].variants[sSku].qty += qty;
      if (!sMap[skuName].topVideos[vid]) sMap[skuName].topVideos[vid] = 0;
      sMap[skuName].topVideos[vid] += qty;
    });

    const sortFn = (a: any, b: any) => b.totalQty - a.totalQty;
    return {
      video: Object.values(vMap).sort(sortFn),
      creator: Object.values(cMap).sort(sortFn).map((c: any) => ({
        ...c,
        rankedSkus: Object.entries(c.skuStats).map(([id, qty]) => ({ id, qty })).sort((a: any, b: any) => b.qty - a.qty).slice(0, 3),
        rankedVideos: Object.entries(c.videoStats).map(([id, qty]) => ({ id, qty })).sort((a: any, b: any) => b.qty - a.qty).slice(0, 3)
      })),
      sku: Object.values(sMap).sort(sortFn).map((s: any) => ({
        ...s,
        rankedVideos: Object.entries(s.topVideos).map(([id, qty]) => ({ id, qty })).sort((a: any, b: any) => b.qty - a.qty).slice(0, 3)
      }))
    };
  }, [filteredRows, headers]);

  const displayData = useMemo(() => {
    const base = aggregatedStats[viewMode];
    if (!searchTerm) return base;
    const lowSearch = searchTerm.toLowerCase();
    return base.filter((item: any) => item.id.toLowerCase().includes(lowSearch));
  }, [aggregatedStats, viewMode, searchTerm]);

  const toggleSku = (sku: string) => {
    const next = new Set(activeSkuFilters);
    if (next.has(sku)) next.delete(sku);
    else next.add(sku);
    setActiveSkuFilters(next);
  };

  const toggleProduct = (product: any) => {
    const variantIds = Object.keys(product.variants);
    const next = new Set(activeSkuFilters);
    const allIn = variantIds.every(id => next.has(id));
    if (allIn) variantIds.forEach(id => next.delete(id));
    else variantIds.forEach(id => next.add(id));
    setActiveSkuFilters(next);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-none mb-1 italic uppercase tracking-tight">Attribution Dashboard</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">{filesCount} 报表已就绪</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer bg-slate-900 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl transition-all flex items-center gap-2 font-black text-sm shadow-xl group">
              <Upload size={18} className="group-hover:bounce" /> 载入本地 CSV
              <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="hidden" />
            </label>
            {allRows.length > 0 && (
              <button onClick={() => { setAllRows([]); setFilesCount(0); setActiveSkuFilters(new Set()); }} className="p-3 text-slate-300 hover:text-rose-500 transition-colors" title="清除所有数据">
                <X size={20} />
              </button>
            )}
          </div>
        </div>
        {allRows.length > 0 && (
          <div className="bg-slate-900 text-white border-t border-white/5 py-4 overflow-x-auto">
            <div className="max-w-[1600px] mx-auto px-10 flex justify-around items-center divide-x divide-white/10 min-w-[800px]">
              <GlobalMetricItem label="全盘订单量" value={globalMetrics.orders} icon={<BarChart3 size={18}/>} />
              <GlobalMetricItem label="累计销售件数" value={globalMetrics.qty} icon={<ShoppingBag size={18}/>} />
              <GlobalMetricItem label="覆盖视频 ID" value={globalMetrics.contents} icon={<Video size={18}/>} />
              <GlobalMetricItem label="合作达人总数" value={globalMetrics.creators} icon={<Users size={18}/>} />
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[1600px] mx-auto w-full p-6 space-y-6">
        {allRows.length === 0 ? (
          <div className="py-60 flex flex-col items-center justify-center text-center">
            <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 mb-8 rotate-3">
              <Layers size={80} className="text-indigo-600" />
            </div>
            <h2 className="text-5xl font-black text-slate-900 mb-4 italic uppercase tracking-tighter">Matrix Attribution</h2>
            <p className="text-slate-400 font-bold max-w-md uppercase tracking-[0.2em] text-xs">本地处理，隐私安全。直接载入 TikTok 成交报表开启深度归因。</p>
          </div>
        ) : (
          <>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Filter size={18} strokeWidth={3} />
                  <span className="text-[11px] font-black uppercase tracking-widest">当前 SKU 筛选池 ({activeSkuFilters.size})</span>
                </div>
                {activeSkuFilters.size > 0 && (
                  <button onClick={() => setActiveSkuFilters(new Set())} className="text-[10px] font-black text-rose-500 hover:underline uppercase">清除过滤器</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {activeSkuFilters.size === 0 ? (
                  <p className="text-slate-300 text-[11px] font-bold italic py-2">显示全盘数据。点击下方任何 SKU 或商品可激活联动筛选。</p>
                ) : (
                  Array.from(activeSkuFilters as Set<string>).map(s => (
                    <span key={s} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-lg shadow-indigo-100 animate-in fade-in zoom-in duration-200">
                      {s} <X size={14} className="cursor-pointer hover:text-white/70" onClick={() => toggleSku(s)} />
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-5 items-center">
              <div className="bg-white p-1.5 rounded-[2rem] border border-slate-200 flex gap-1 w-full lg:w-fit shadow-sm">
                <NavTab active={viewMode === 'video'} onClick={() => setViewMode('video')} icon={<Video size={18}/>} label="内容分析" badge={aggregatedStats.video.length} />
                <NavTab active={viewMode === 'creator'} onClick={() => setViewMode('creator')} icon={<Users size={18}/>} label="达人矩阵" badge={aggregatedStats.creator.length} />
                <NavTab active={viewMode === 'sku'} onClick={() => setViewMode('sku')} icon={<ShoppingBag size={18}/>} label="商品/SKU 策略" badge={aggregatedStats.sku.length} />
              </div>
              <div className="relative flex-1 w-full">
                <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="搜索 ID、达人或商品名称..." 
                  className="w-full pl-16 pr-8 py-5 rounded-[2.5rem] border border-slate-200 focus:outline-none focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all font-black text-slate-700 shadow-sm"
                />
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-100 overflow-hidden">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest w-[32%]">主体详情</th>
                    <th className="px-6 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center w-[12%]">订单</th>
                    <th className="px-6 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center w-[12%]">件数</th>
                    <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest w-[44%]">归因结构与深度透视</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayData.map((item: any) => (
                    <tr key={item.id} className="group hover:bg-slate-50/30 transition-all duration-300">
                      <td className="px-10 py-10">
                        <div className="flex items-start gap-6">
                          {viewMode === 'sku' ? (
                            <button onClick={() => toggleProduct(item)} className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all relative shadow-lg ${Object.keys(item.variants).every(v => activeSkuFilters.has(v)) ? 'bg-indigo-600 text-white scale-105' : 'bg-white border border-slate-100 text-slate-400 hover:border-indigo-600'}`}>
                              <ShoppingBag size={28}/>
                              {Object.keys(item.variants).some(v => activeSkuFilters.has(v)) && <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-1 border-2 border-white shadow-lg"><Check size={10} strokeWidth={4}/></div>}
                            </button>
                          ) : (
                            <div className="flex-shrink-0 w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 shadow-inner">
                              {viewMode === 'video' ? <Video size={28}/> : <User size={28}/>}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            {viewMode === 'video' ? (
                              <a href={`https://www.tiktok.com/@/video/${item.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-indigo-600 leading-tight mb-2 truncate hover:underline flex items-center gap-2 group/link">
                                https://www.tiktok.com/@/video/{item.id} <ExternalLink size={14} className="opacity-0 group-hover/link:opacity-100 transition-opacity"/>
                              </a>
                            ) : (
                              <span className="text-lg font-black text-slate-900 leading-tight mb-2 truncate group-hover:text-indigo-600 transition-colors block">
                                {item.id}
                              </span>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {viewMode === 'video' && <span className="text-[10px] font-black bg-purple-600 text-white px-3 py-1 rounded-lg uppercase shadow-md shadow-purple-100">{item.creator}</span>}
                              {viewMode === 'creator' && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.videoIds.size} 条成交视频链路</span>}
                              {viewMode === 'sku' && <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{Object.keys(item.variants).length} 个 SKU 规格变体</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-10 text-center">
                        <span className="text-3xl font-black text-slate-800 tracking-tighter italic">{item.orderIds ? item.orderIds.size : item.orders}</span>
                      </td>
                      <td className="px-6 py-10 text-center">
                        <div className="inline-flex flex-col items-center bg-emerald-50 px-7 py-3 rounded-[1.5rem] border border-emerald-100 shadow-sm">
                          <span className="text-3xl font-black text-emerald-600 tracking-tighter italic">{item.totalQty}</span>
                        </div>
                      </td>
                      <td className="px-10 py-10">
                        {viewMode === 'creator' ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-indigo-600 rounded-[2rem] p-5 shadow-xl border border-white/10">
                              <div className="flex items-center gap-2 mb-4 text-indigo-100">
                                <ShoppingBag size={14} strokeWidth={3} />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">TOP 带货 SKU</span>
                              </div>
                              <div className="space-y-2">
                                {item.rankedSkus.map((sku: any) => (
                                  <div key={sku.id} onClick={() => toggleSku(sku.id)} className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${activeSkuFilters.has(sku.id) ? 'bg-white text-indigo-600' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                    <span className="text-[10px] font-black truncate max-w-[100px] font-mono">{sku.id}</span>
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${activeSkuFilters.has(sku.id) ? 'bg-indigo-100' : 'bg-white/20'}`}>{sku.qty}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="bg-slate-900 rounded-[2rem] p-5 shadow-xl border border-white/5">
                              <div className="flex items-center gap-2 mb-4 text-amber-400">
                                <Trophy size={14} strokeWidth={3} />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">爆款内容透视</span>
                              </div>
                              <div className="space-y-2">
                                {item.rankedVideos.map((vid: any) => (
                                  <div key={vid.id} className="flex items-center justify-between bg-white/5 hover:bg-white/10 p-2.5 rounded-xl transition-colors group/vlink">
                                    <a href={`https://www.tiktok.com/@/video/${vid.id}`} target="_blank" className="text-[10px] font-black text-white hover:text-indigo-400 truncate flex items-center gap-2">
                                      Video Link <ExternalLink size={10} />
                                    </a>
                                    <span className="text-emerald-400 text-[10px] font-black tabular-nums">{vid.qty} 件</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : viewMode === 'sku' ? (
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap gap-2">
                              {Object.values(item.variants).map((variant: any) => (
                                <div key={variant.id} onClick={() => toggleSku(variant.id)} className={`cursor-pointer px-4 py-2.5 rounded-2xl border-2 transition-all flex items-center gap-3 shadow-sm ${activeSkuFilters.has(variant.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-600'}`}>
                                  <span className="text-[11px] font-black font-mono">{variant.id}</span>
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${activeSkuFilters.has(variant.id) ? 'bg-white/20' : 'bg-slate-900 text-white'}`}>{variant.qty}</span>
                                </div>
                              ))}
                            </div>
                            {item.rankedVideos && item.rankedVideos.length > 0 && (
                              <div className="bg-slate-900 rounded-[2rem] p-5 shadow-xl border border-white/5">
                                <div className="flex items-center gap-2 mb-4 text-amber-400">
                                  <Sparkles size={16} strokeWidth={3} />
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">主力贡献视频透视</span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {item.rankedVideos.map((vid: any) => (
                                    <div key={vid.id} className="flex items-center justify-between bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-colors group/vlink">
                                      <a href={`https://www.tiktok.com/@/video/${vid.id}`} target="_blank" className="text-[11px] font-black text-white hover:text-indigo-400 truncate flex items-center gap-2 group/textlink">
                                        https://www.tiktok.com/@/video/{vid.id} <ExternalLink size={12} className="opacity-0 group-hover/vlink:opacity-100" />
                                      </a>
                                      <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-lg">{vid.qty} 件</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {Object.entries(item.skus).map(([sSku, data]: any) => (
                              <div key={sSku} onClick={() => toggleSku(sSku)} className={`cursor-pointer px-4 py-2.5 rounded-2xl border-2 flex items-center gap-3 transition-all shadow-sm ${activeSkuFilters.has(sSku) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 hover:border-indigo-600'}`}>
                                <span className="text-[11px] font-black font-mono">{sSku}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${activeSkuFilters.has(sSku) ? 'bg-white/20' : 'bg-slate-900 text-white'}`}>{data.count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const GlobalMetricItem = ({ label, value, icon }: any) => (
  <div className="flex items-center gap-6 px-10">
    <div className="text-white/20 scale-125">{icon}</div>
    <div className="flex flex-col">
      <span className="text-white/40 text-[10px] font-black uppercase tracking-widest leading-none mb-1.5">{label}</span>
      <span className="text-2xl font-black italic leading-none tabular-nums tracking-tighter">{value.toLocaleString()}</span>
    </div>
  </div>
);

const NavTab = ({ active, onClick, icon, label, badge }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-[13px] font-black transition-all border ${active ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200 scale-105' : 'text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600'}`}>
    {icon} {label}
    <span className={`text-[10px] px-2.5 py-1 rounded-xl ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>{badge}</span>
  </button>
);

export default App;
