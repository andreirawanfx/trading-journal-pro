"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts"
import jsPDF from "jspdf"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [session, setSession] = useState(null)
  const [trades, setTrades] = useState([])
  const [target, setTarget] = useState(1000000)

  const [form, setForm] = useState({
    date: "",
    instrument: "",
    type: "BUY",
    entry: "",
    exit: "",
    lot: "",
    screenshot: null,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchTrades()
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchTrades()
    })
  }, [])

  async function fetchTrades() {
    const { data } = await supabase
      .from("trades")
      .select("*")
      .order("date", { ascending: true })

    setTrades(data || [])
  }

  async function login() {
    const email = prompt("Masukkan Email")
    await supabase.auth.signInWithOtp({ email })
    alert("Cek email untuk login link")
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
  }

  async function uploadScreenshot(file) {
    const fileName = `${Date.now()}-${file.name}`
    await supabase.storage.from("screenshots").upload(fileName, file)
    const { data } = supabase.storage.from("screenshots").getPublicUrl(fileName)
    return data.publicUrl
  }

  async function addTrade() {
    let screenshotUrl = null

    if (form.screenshot) {
      screenshotUrl = await uploadScreenshot(form.screenshot)
    }

    await supabase.from("trades").insert([
      {
        ...form,
        screenshot: screenshotUrl,
      },
    ])

    fetchTrades()
  }

  function calculatePnL(trade) {
    const entry = parseFloat(trade.entry)
    const exit = parseFloat(trade.exit)
    const lot = parseFloat(trade.lot)
    if (!entry || !exit || !lot) return 0

    return trade.type === "BUY"
      ? (exit - entry) * lot * 100
      : (entry - exit) * lot * 100
  }

  const totalPnL = trades.reduce((sum, t) => sum + calculatePnL(t), 0)
  const wins = trades.filter((t) => calculatePnL(t) > 0).length
  const losses = trades.filter((t) => calculatePnL(t) < 0).length
  const winRate = trades.length ? (wins / trades.length) * 100 : 0
  const expectancy = trades.length ? totalPnL / trades.length : 0

  let cumulative = 0
  const equityData = trades.map((trade) => {
    cumulative += calculatePnL(trade)
    return { date: trade.date, equity: cumulative }
  })

  function exportPDF() {
    const doc = new jsPDF()
    doc.text("Trading Journal Report", 20, 20)
    doc.text(`Total PnL: Rp ${totalPnL}`, 20, 30)
    doc.text(`Win Rate: ${winRate.toFixed(2)}%`, 20, 40)
    doc.text(`Expectancy: ${expectancy.toFixed(2)}`, 20, 50)
    doc.save("report.pdf")
  }

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Trading Journal PRO</h1>
        <button onClick={login}>Login via Email</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, background: "#0f172a", minHeight: "100vh", color: "white" }}>
      <h1>Trading Journal PRO – LEVEL 5</h1>
      <button onClick={logout}>Logout</button>

      <h3>Monthly Target: Rp {target.toLocaleString()}</h3>
      <input
        type="number"
        placeholder="Set Target"
        onChange={(e) => setTarget(Number(e.target.value))}
      />

      <p>Total PnL: Rp {totalPnL.toLocaleString()}</p>
      <p>Win Rate: {winRate.toFixed(2)}%</p>
      <p>Expectancy: {expectancy.toFixed(2)}</p>

      <input type="date" onChange={(e) => setForm({ ...form, date: e.target.value })} />
      <input placeholder="Instrument" onChange={(e) => setForm({ ...form, instrument: e.target.value })} />
      <select onChange={(e) => setForm({ ...form, type: e.target.value })}>
        <option>BUY</option>
        <option>SELL</option>
      </select>
      <input placeholder="Entry" onChange={(e) => setForm({ ...form, entry: e.target.value })} />
      <input placeholder="Exit" onChange={(e) => setForm({ ...form, exit: e.target.value })} />
      <input placeholder="Lot" onChange={(e) => setForm({ ...form, lot: e.target.value })} />
      <input type="file" onChange={(e) => setForm({ ...form, screenshot: e.target.files[0] })} />

      <br /><br />
      <button onClick={addTrade} style={{ background: "green", padding: 10 }}>
        Add Trade
      </button>

      <button onClick={exportPDF} style={{ marginLeft: 20 }}>
        Export PDF
      </button>

      <h2 style={{ marginTop: 40 }}>Equity Curve</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={equityData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="equity" stroke="#22c55e" />
        </LineChart>
      </ResponsiveContainer>

      <h2 style={{ marginTop: 40 }}>Trade List</h2>
      {trades.map((trade) => (
        <div key={trade.id} style={{ background: "#1e293b", padding: 10, marginBottom: 10 }}>
          {trade.date} — {trade.instrument} ({trade.type})<br />
          PnL: Rp {calculatePnL(trade).toLocaleString()} <br />
          {trade.screenshot && (
            <img src={trade.screenshot} width="200" />
          )}
        </div>
      ))}
    </div>
  )
}