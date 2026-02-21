"use client"

import { useEffect, useState } from "react"
import { createClient, Session } from "@supabase/supabase-js"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import jsPDF from "jspdf"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [target, setTarget] = useState<number>(1000000)

  const [form, setForm] = useState({
    date: "",
    instrument: "",
    type: "BUY",
    entry: "",
    exit: "",
    lot: "",
    screenshot: null as File | null,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchTrades()
    })
  }, [])

  async function fetchTrades() {
    const { data } = await supabase.from("trades").select("*").order("date")
    if (data) setTrades(data)
  }

  async function handleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    })
  }

  async function handleAddTrade() {
    if (!session) return

    const profit =
      (Number(form.exit) - Number(form.entry)) *
      Number(form.lot) *
      (form.type === "BUY" ? 1 : -1)

    await supabase.from("trades").insert([
      {
        user_id: session.user.id,
        ...form,
        profit,
      },
    ])

    fetchTrades()
  }

  function totalProfit() {
    return trades.reduce((acc, t) => acc + (t.profit || 0), 0)
  }

  function exportPDF() {
    const doc = new jsPDF()
    doc.text("Trading Journal Report", 20, 20)
    doc.text("Total Profit: " + totalProfit(), 20, 30)
    doc.save("report.pdf")
  }

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Trading Journal Pro</h1>
        <button onClick={handleLogin}>Login with Google</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Trading Journal Pro</h1>

      <h3>Total Profit: {totalProfit()}</h3>
      <h4>Target: {target}</h4>

      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Date"
          type="date"
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <input
          placeholder="Instrument"
          onChange={(e) => setForm({ ...form, instrument: e.target.value })}
        />
        <select
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option>BUY</option>
          <option>SELL</option>
        </select>
        <input
          placeholder="Entry"
          type="number"
          onChange={(e) => setForm({ ...form, entry: e.target.value })}
        />
        <input
          placeholder="Exit"
          type="number"
          onChange={(e) => setForm({ ...form, exit: e.target.value })}
        />
        <input
          placeholder="Lot"
          type="number"
          onChange={(e) => setForm({ ...form, lot: e.target.value })}
        />
        <button onClick={handleAddTrade}>Add Trade</button>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={trades}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="profit" />
        </LineChart>
      </ResponsiveContainer>

      <button onClick={exportPDF} style={{ marginTop: 20 }}>
        Export PDF
      </button>
    </div>
  )
}