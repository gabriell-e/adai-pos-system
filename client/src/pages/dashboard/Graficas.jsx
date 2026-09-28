import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const formatGs = n => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`

const COLORES = ['#059669', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#84cc16']

const Tarjeta = ({ titulo, children, vacio }) => (
  <div className="bg-white rounded-xl shadow-sm p-4">
    <p className="font-medium text-gray-700 text-sm mb-3">{titulo}</p>
    <div className="h-64">
      {vacio ? <p className="h-full flex items-center justify-center text-sm text-gray-400">Sin datos</p> : children}
    </div>
  </div>
)

const TooltipFmt = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{formatGs(p.value)}</strong>
        </p>
      ))}
    </div>
  )
}

const Graficas = ({ datos }) => {
  const { serieDiaria, datosPago, datosHora, datosProductos, periodo } = datos

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Tarjeta titulo={`Ventas y gastos por día · ${periodo}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serieDiaria}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} width={45} />
            <Tooltip content={<TooltipFmt />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#059669" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Tarjeta>

      <Tarjeta titulo="Medios de pago" vacio={datosPago.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datosPago}
              dataKey="value"
              nameKey="name"
              cx="50%" cy="50%"
              outerRadius={85}
              innerRadius={50}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
              style={{ fontSize: 11 }}
            >
              {datosPago.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
            </Pie>
            <Tooltip formatter={v => formatGs(v)} />
          </PieChart>
        </ResponsiveContainer>
      </Tarjeta>

      <Tarjeta titulo="Top 8 productos por facturación" vacio={datosProductos.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datosProductos} layout="vertical" margin={{ left: 10, right: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
            <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={140} />
            <Tooltip formatter={v => formatGs(v)} />
            <Bar dataKey="monto" fill="#059669" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Tarjeta>

      <Tarjeta titulo="Ventas por hora" vacio={datosHora.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datosHora}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="hora" tick={{ fontSize: 11 }} interval={1} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} width={45} />
            <Tooltip formatter={v => formatGs(v)} />
            <Bar dataKey="monto" name="Ventas" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Tarjeta>
    </div>
  )
}

export default Graficas
