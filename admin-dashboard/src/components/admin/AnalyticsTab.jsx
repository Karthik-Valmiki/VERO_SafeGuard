import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export default function AnalyticsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboards/admin/analytics")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading analytics...</div>

  const formatCurrency = (val) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val)

  return (
    <div className="p-8 pb-24">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold">Financial Analytics</h2>
        <p className="text-gray-400 mt-1">Geospatial risk modeling and pool liquidity</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Premium vs Payout Chart */}
        <div className="card">
          <h3 className="text-lg font-bold font-display mb-6">Premium vs Payout by City</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.city_stats} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                <XAxis dataKey="city" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                  cursor={{fill: '#27272a'}}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px' }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Bar dataKey="premium" name="Premium" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payout" name="Payout" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Trend Chart */}
        <div className="card">
          <h3 className="text-lg font-bold font-display mb-6">7-Day Payout Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly_trend} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                  cursor={{fill: '#27272a'}}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px' }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Bar dataKey="amount" name="Daily Payout" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Zone Risk Table */}
      <div className="card overflow-hidden p-0">
        <div className="p-6 border-b border-dark-600">
          <h3 className="text-lg font-bold font-display">Zone Risk Actuarial Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-900 border-b border-dark-600 text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Zone & City</th>
                <th className="px-6 py-4 font-medium">Risk Multiplier</th>
                <th className="px-6 py-4 font-medium">Map Density</th>
                <th className="px-6 py-4 font-medium">Active Policies</th>
                <th className="px-6 py-4 font-medium">Triggers MTD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {(data.zone_table || []).map((z, i) => (
                <tr key={i} className="hover:bg-dark-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{z.zone_name}</p>
                    <p className="text-xs text-brand-400">{z.city}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${z.risk_multiplier > 1.15 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {z.risk_multiplier}x
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono">{z.total_riders} riders</td>
                  <td className="px-6 py-4 font-mono">{z.active_policies}</td>
                  <td className="px-6 py-4 font-mono">{z.trigger_events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
